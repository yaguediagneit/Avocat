import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/session";
import { getTenantPrisma } from "@/lib/prisma";
import { MfaRateLimitError, verifyMfaCode } from "@/lib/mfa-email";
import { enforceAuthRateLimit, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().length(6),
});

function devError(error: unknown) {
  if (process.env.NODE_ENV === "production") return "Erreur serveur";
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export async function POST(req: NextRequest) {
  const res = new NextResponse();

  try {
    const session = await getSessionFromRequest(req, res);
    const pending = session.mfaPending;
    if (!pending) {
      return NextResponse.json({ error: "Aucune vérification MFA en attente" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Code invalide" }, { status: 400 });
    }

    const limited = await enforceAuthRateLimit(req, "verify-mfa", pending.email);
    if (limited) return limited;

    const tenantPrisma = await getTenantPrisma(pending.tenantId);
    let valid: boolean;
    try {
      valid = await verifyMfaCode(tenantPrisma, pending.email, parsed.data.token, "login");
    } catch (e) {
      if (e instanceof MfaRateLimitError) return tooManyRequests({ ok: false, remaining: 0, retryAfter: e.retryAfter });
      throw e;
    }
    if (!valid) {
      return NextResponse.json({ error: "Code incorrect ou expiré" }, { status: 401 });
    }

    session.userId = pending.userId;
    session.email = pending.email;
    session.role = pending.role;
    session.tenantId = pending.tenantId;
    session.isClient = pending.isClient;
    session.clientId = pending.clientId;
    session.mfaVerified = true;
    delete session.mfaPending;

    await session.save();

    return NextResponse.json(
      {
        ok: true,
        userId: pending.userId,
        role: pending.role,
        isClient: pending.isClient,
      },
      { headers: res.headers }
    );
  } catch (e) {
    console.error("[auth/verify-mfa] unexpected error", e);
    return NextResponse.json({ error: "Erreur serveur", detail: devError(e) }, { status: 500 });
  }
}
