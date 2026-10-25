import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/lib/auth";
import { getSessionFromRequest } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { getTenantPrisma } from "@/lib/prisma";
import { enforceAuthRateLimit, resetAuthRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function devError(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return "Erreur serveur";
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

export async function POST(req: NextRequest) {
  const res = new NextResponse();

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const limited = await enforceAuthRateLimit(req, "client-login", parsed.data.email);
    if (limited) return limited;

    const result = await verifyUser(parsed.data.email, parsed.data.password);
    if (!result || !result.isClient || !result.clientId) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    await resetAuthRateLimit(req, "client-login", parsed.data.email);

    let session;
    try {
      session = await getSessionFromRequest(req, res);
    } catch (e) {
      console.error("[client/login] getSessionFromRequest failed", e);
      return NextResponse.json(
        { error: "Échec de création de session", detail: devError(e) },
        { status: 500 }
      );
    }

    session.userId = result.userId;
    session.email = result.email;
    session.role = result.role;
    session.tenantId = result.tenantId;
    session.isClient = true;
    session.clientId = result.clientId;
    session.mfaVerified = true;

    try {
      await session.save();
    } catch (e) {
      console.error("[client/login] session.save failed", e);
      return NextResponse.json(
        { error: "Échec de sauvegarde de session", detail: devError(e) },
        { status: 500 }
      );
    }

    const tenantPrisma = await getTenantPrisma(result.tenantId);
    await logAudit(tenantPrisma, result.userId, "client_login_success", "user", result.userId, { isClient: true }, req);

    return NextResponse.json(
      { ok: true, userId: result.userId, role: result.role },
      { headers: res.headers }
    );
  } catch (e) {
    console.error("[client/login] unexpected error", e);
    return NextResponse.json({ error: "Erreur serveur", detail: devError(e) }, { status: 500 });
  }
}
