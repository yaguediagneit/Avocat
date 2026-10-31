import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTenantPrisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { verifyInvitation } from "@/lib/invitation";
import { passwordSchema } from "@/lib/password-policy";
import { logAudit } from "@/lib/audit";
import { enforceAuthRateLimit, resetAuthRateLimit } from "@/lib/rate-limit";

/**
 * GET ?token=… — vérifie qu'un lien d'invitation est encore valide et renvoie
 * les informations d'identité à afficher sur la page (sans le mot de passe).
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") || "";
    const tenantId =
      req.nextUrl.searchParams.get("t") ||
      req.headers.get("x-tenant-id") ||
      process.env.DEFAULT_TENANT_ID ||
      "";
    if (!token || !tenantId) {
      return NextResponse.json({ error: "Lien invalide" }, { status: 400 });
    }
    const prisma = await getTenantPrisma(tenantId);
    const invitation = await verifyInvitation(prisma, token);
    if (!invitation || !invitation.user.actif) {
      return NextResponse.json(
        { error: "Ce lien d'invitation est invalide ou a expiré." },
        { status: 410 }
      );
    }
    return NextResponse.json({
      ok: true,
      prenom: invitation.user.prenom,
      nom: invitation.user.nom,
      email: invitation.user.email,
      isClient: false,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error("Invitation GET error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

const acceptSchema = z
  .object({
    token: z.string().min(20),
    tenant: z.string().optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

/** POST — définit le mot de passe du nouvel utilisateur (usage unique). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = acceptSchema.safeParse(body);
    if (!parsed.success) {
      const msg =
        parsed.error.flatten().fieldErrors?.password?.[0] ||
        parsed.error.flatten().fieldErrors?.confirmPassword?.[0] ||
        "Données invalides";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const tenantId =
      parsed.data.tenant ||
      req.headers.get("x-tenant-id") ||
      process.env.DEFAULT_TENANT_ID ||
      "";
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant introuvable" }, { status: 400 });
    }

    const rateKey = `invite:${parsed.data.token.slice(0, 24)}`;
    const limited = await enforceAuthRateLimit(req, "invitation", rateKey);
    if (limited) return limited;

    const prisma = await getTenantPrisma(tenantId);
    const invitation = await verifyInvitation(prisma, parsed.data.token);
    if (!invitation || !invitation.user.actif) {
      return NextResponse.json(
        { error: "Ce lien d'invitation est invalide, déjà utilisé ou expiré." },
        { status: 410 }
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: invitation.userId },
        data: { passwordHash, passwordChangeRequired: false },
      }),
      prisma.userInvitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      }),
      // Invalide toute autre invitation encore active du compte.
      prisma.userInvitation.updateMany({
        where: { userId: invitation.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    await resetAuthRateLimit(req, "invitation", rateKey);
    await logAudit(prisma, invitation.userId, "invitation_accepted", "user", invitation.userId);

    const role = await prisma.role.findUnique({
      where: { id: invitation.user.roleId },
      select: { estClient: true },
    });
    return NextResponse.json({ ok: true, isClient: role?.estClient || false });
  } catch (error) {
    console.error("Invitation POST error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
