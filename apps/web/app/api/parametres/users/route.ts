import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { uploadDocument } from "@/lib/s3";
import { ensureTiersAccount } from "@/lib/tiers";
import { estIntervenantExterne, type RoleInfo } from "@/lib/rbac";

const userCreateSchema = z.object({
  prenom: z.string().min(1),
  nom: z.string().min(1),
  email: z.string().email(),
  roleId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  titre: z.string().optional(),
  specialite: z.string().optional(),
  password: z.string().min(8),
  signature: z.string().optional(),
});

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  try {
    return { buffer: Buffer.from(match[2], "base64"), contentType: match[1] };
  } catch {
    return null;
  }
}

async function saveSignature(userId: string, dataUrl?: string): Promise<string | undefined> {
  if (!dataUrl || !dataUrl.startsWith("data:")) return undefined;
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return undefined;
  const key = `signatures/${userId}`;
  await uploadDocument(key, parsed.buffer, parsed.contentType);
  return key;
}

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "users", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const users = await ctx.prisma.user.findMany({
    include: { role: { select: { id: true, nom: true } } },
    orderBy: { nom: "asc" },
    take: 500,
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      prenom: u.prenom,
      nom: u.nom,
      titre: u.titre || "",
      specialite: u.specialite || "",
      email: u.email,
      roleId: u.roleId,
      role: u.role,
      actif: u.actif,
      signatureKey: u.signatureKey,
    }))
  );
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "users", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = userCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await ctx.prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const user = await ctx.prisma.user.create({
      data: {
        prenom: parsed.data.prenom,
        nom: parsed.data.nom,
        email: parsed.data.email,
        passwordHash,
        roleId: parsed.data.roleId,
        clientId: parsed.data.clientId,
        titre: parsed.data.titre,
        specialite: parsed.data.specialite,
        actif: true,
      },
      include: { role: { select: { id: true, nom: true } } },
    });

    // Création automatique du compte auxiliaire tiers pour les
    // collaborateurs externes (SYSCOHADA révisé).
    try {
      const role = await ctx.prisma.role.findUnique({ where: { id: user.roleId } });
      if (role) {
        const roleInfo: RoleInfo = {
          id: role.id,
          nom: role.nom,
          estAdmin: role.estAdmin,
          estClient: role.estClient,
          niveauConfidentialiteMax: role.niveauConfidentialiteMax,
          permissions: (role.permissions as Record<string, string[]>) || {},
        };
        if (estIntervenantExterne(roleInfo)) {
          const name = [user.titre, user.prenom, user.nom].filter(Boolean).join(" ");
          await ensureTiersAccount(ctx.prisma, "collaborateur", name);
        }
      }
    } catch (tiersError) {
      console.error("Compte tiers collaborateur:", tiersError);
    }

    const signatureKey = await saveSignature(user.id, parsed.data.signature);
    if (signatureKey) {
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { signatureKey },
      });
    }

    await logAudit(ctx.prisma, ctx.userId, "user_created", "user", user.id);
    return NextResponse.json(
      {
        id: user.id,
        prenom: user.prenom,
        nom: user.nom,
        titre: user.titre,
        specialite: user.specialite,
        email: user.email,
        roleId: user.roleId,
        role: user.role,
        actif: user.actif,
        signatureKey,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create user error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
