import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { publicPrisma, getTenantPrisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { createAndSendMfaCode, MfaRateLimitError } from "@/lib/mfa-email";
import { enforceAuthRateLimit } from "@/lib/rate-limit";

const forgotSchema = z.object({
  email: z.string().email(),
});

// Durée de validité de la demande de réinitialisation (15 minutes)
const RESET_TTL_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const res = new NextResponse();
  const session = await getSessionFromRequest(req, res);

  try {
    const body = await req.json();
    const parsed = forgotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();

    const limited = await enforceAuthRateLimit(req, "forgot-password", email, {
      perIp: { limit: 10, windowMs: 15 * 60 * 1000 },
      perIdentifier: { limit: 3, windowMs: 15 * 60 * 1000 },
    });
    if (limited) return limited;

    // Résolution du tenant : env d'abord, sinon premier tenant actif
    let tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      const tenant = await publicPrisma.tenant.findFirst({
        where: { actif: true },
        select: { id: true },
      });
      tenantId = tenant?.id;
    }

    // Pour ne pas fuiter d'information sur l'existence des comptes,
    // on renvoie toujours une réponse positive générique.
    const genericOk = NextResponse.json(
      { ok: true, message: "Si ce compte existe et dispose d'un MFA, un code vous a été demandé." },
      { headers: res.headers }
    );

    if (!tenantId) {
      return genericOk;
    }

    let tenantPrisma;
    try {
      tenantPrisma = await getTenantPrisma(tenantId);
    } catch {
      return genericOk;
    }

    const user = await tenantPrisma.user.findUnique({
      where: { email },
      include: { role: { select: { estClient: true } } },
    });

    // Compte inexistant, inactif ou sans MFA -> pas de réinitialisation possible.
    // On garde la réponse générique pour éviter le user enumeration.
    if (!user || !user.actif || !user.mfaEnabled) {
      return genericOk;
    }

    try {
      await createAndSendMfaCode(tenantPrisma, user.email, "password-reset");
    } catch (e) {
      if (e instanceof MfaRateLimitError) return genericOk;
      console.error("Forgot password send MFA email error", e);
      return NextResponse.json({ error: "Erreur lors de l'envoi du code" }, { status: 500 });
    }

    session.mfaResetPending = {
      userId: user.id,
      email: user.email,
      tenantId,
      isClient: user.role.estClient,
      verified: false,
      expiresAt: Date.now() + RESET_TTL_MS,
    };
    // On nettoie toute session authentifiée précédente pour éviter les états hybrides.
    session.userId = undefined;
    session.mfaVerified = undefined;
    session.mfaPending = undefined;
    await session.save();

    await logAudit(publicPrisma, user.id, "password_reset_requested", "user", user.id);

    return NextResponse.json(
      { ok: true, requiresMfa: true, email: user.email, mfaMethod: "email" },
      { headers: res.headers }
    );
  } catch (error) {
    console.error("Forgot password error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
