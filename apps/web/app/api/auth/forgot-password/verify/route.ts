import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { publicPrisma, getTenantPrisma } from "@/lib/prisma";
import { MfaRateLimitError, verifyMfaCode } from "@/lib/mfa-email";
import { enforceAuthRateLimit, tooManyRequests } from "@/lib/rate-limit";

const verifySchema = z.object({
  token: z.string().length(6),
});

export async function POST(req: NextRequest) {
  const res = new NextResponse();
  const session = await getSessionFromRequest(req, res);

  try {
    const body = await req.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Code invalide" }, { status: 400 });
    }

    const pending = session.mfaResetPending;
    if (!pending) {
      return NextResponse.json(
        { error: "Aucune demande de réinitialisation en cours. Veuillez recommencer." },
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

    const limited = await enforceAuthRateLimit(req, "reset-verify", pending.email);
    if (limited) return limited;

    const tenantPrisma = await getTenantPrisma(pending.tenantId);
    let valid: boolean;
    try {
      valid = await verifyMfaCode(tenantPrisma, pending.email, parsed.data.token, "password-reset");
    } catch (e) {
      if (e instanceof MfaRateLimitError) return tooManyRequests({ ok: false, remaining: 0, retryAfter: e.retryAfter });
      throw e;
    }
    if (!valid) {
      await logAudit(
        publicPrisma,
        pending.userId,
        "password_reset_mfa_failed",
        "user",
        pending.userId
      );
      return NextResponse.json({ error: "Code invalide ou expiré" }, { status: 401 });
    }

    session.mfaResetPending = { ...pending, verified: true };
    await session.save();

    await logAudit(
      publicPrisma,
      pending.userId,
      "password_reset_mfa_verified",
      "user",
      pending.userId
    );

    return NextResponse.json({ ok: true }, { headers: res.headers });
  } catch (error) {
    console.error("Forgot password verify error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
