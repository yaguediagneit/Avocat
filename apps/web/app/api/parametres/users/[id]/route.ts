import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { uploadDocument } from "@/lib/s3";

const userUpdateSchema = z.object({
  prenom: z.string().min(1).optional(),
  nom: z.string().min(1).optional(),
  email: z.string().email().optional(),
  roleId: z.string().uuid().optional(),
  titre: z.string().optional(),
  specialite: z.string().optional(),
  actif: z.boolean().optional(),
  password: z.string().min(8).optional(),
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "users", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = userUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.email) {
      const existing = await ctx.prisma.user.findFirst({
        where: { email: parsed.data.email, id: { not: params.id } },
      });
      if (existing) {
        return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 });
      }
    }

    const data: any = { ...parsed.data };
    delete data.signature;
    if (parsed.data.password) {
      data.passwordHash = await hashPassword(parsed.data.password);
      delete data.password;
    }

    const signatureKey = await saveSignature(params.id, parsed.data.signature);
    if (signatureKey) {
      data.signatureKey = signatureKey;
    }

    const user = await ctx.prisma.user.update({
      where: { id: params.id },
      data,
      include: { role: { select: { id: true, nom: true } } },
    });

    await logAudit(ctx.prisma, ctx.userId, "user_updated", "user", user.id);
    return NextResponse.json({
      id: user.id,
      prenom: user.prenom,
      nom: user.nom,
      titre: user.titre,
      specialite: user.specialite,
      email: user.email,
      roleId: user.roleId,
      role: user.role,
      actif: user.actif,
      signatureKey: user.signatureKey,
    });
  } catch (error) {
    console.error("Update user error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "users", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Seul un administrateur peut supprimer un utilisateur" }, { status: 403 });
  }

  if (ctx.userId === params.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas supprimer votre propre compte." },
      { status: 409 }
    );
  }

  try {
    // Désactivation (soft delete) : le compte est conservé pour l'auditabilité.
    await ctx.prisma.user.update({ where: { id: params.id }, data: { actif: false } });
    await logAudit(ctx.prisma, ctx.userId, "user_deactivated", "user", params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete user error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
