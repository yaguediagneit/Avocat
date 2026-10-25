import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { getSessionFromRequest } from "@/lib/session";
import { getTenantPrisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { publicPrisma } from "@/lib/prisma";

const resetSchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export async function POST(req: NextRequest) {
  const res = new NextResponse();
  const session = await getSessionFromRequest(req, res);

  try {
    const body = await req.json();
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      const msg =
        parsed.error.flatten().fieldErrors?.confirmPassword?.[0] ||
        parsed.error.flatten().formErrors?.[0] ||
        "Données invalides";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const pending = session.mfaResetPending;
    if (!pending || !pending.verified) {
      return NextResponse.json(
        { error: "Vérification MFA requise. Veuillez recommencer." },
        { status: 401 }
      );
    }

    if (Date.now() > pending.expiresAt) {
      session.mfaResetPending = undefined;
      await session.save();
      return NextResponse.json(
        { error: "La demande a expiré. Veuillez recommencer." },
        { status: 401 }
      );
    }

    const tenantPrisma = await getTenantPrisma(pending.tenantId);

    const passwordHash = await hashPassword(parsed.data.password);
    await tenantPrisma.user.update({
      where: { id: pending.userId },
      data: { passwordHash },
    });

    // Invalidation de la demande
    session.mfaResetPending = undefined;
    await session.save();

    await logAudit(
      tenantPrisma,
      pending.userId,
      "password_reset_completed",
      "user",
      pending.userId
    );
    await logAudit(
      publicPrisma,
      pending.userId,
      "password_reset_completed",
      "user",
      pending.userId
    );

    return NextResponse.json(
      { ok: true, isClient: pending.isClient },
      { headers: res.headers }
    );
  } catch (error) {
    console.error("Forgot password reset error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
