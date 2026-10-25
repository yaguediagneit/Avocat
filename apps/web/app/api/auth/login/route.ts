import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getTenantPrisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";
import { createAndSendMfaCode } from "@/lib/mfa-email";
import { enforceAuthRateLimit, resetAuthRateLimit } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenant: z.string().optional(),
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
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const limited = await enforceAuthRateLimit(req, "login", parsed.data.email);
    if (limited) return limited;

    const result = await verifyUser(parsed.data.email, parsed.data.password, parsed.data.tenant);
    if (!result) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }
    await resetAuthRateLimit(req, "login", parsed.data.email);

    let tenantPrisma;
    try {
      tenantPrisma = await getTenantPrisma(result.tenantId);
    } catch (e) {
      console.error("[auth/login] getTenantPrisma failed for tenant", result.tenantId, e);
      return NextResponse.json(
        { error: "Échec de connexion à la base de données", detail: devError(e) },
        { status: 500 }
      );
    }

    await logAudit(tenantPrisma, result.userId, "login_success", "user", result.userId, undefined, req);

    let session;
    try {
      session = await getSessionFromRequest(req, res);
    } catch (e) {
      console.error("[auth/login] getSessionFromRequest failed", e);
      return NextResponse.json(
        { error: "Échec de création de session", detail: devError(e) },
        { status: 500 }
      );
    }

    if (result.requiresMfa) {
      try {
        await createAndSendMfaCode(tenantPrisma, result.email, "login");
      } catch (e) {
        console.error("[auth/login] send MFA email failed", e);
      }
      session.mfaPending = {
        userId: result.userId,
        email: result.email,
        role: result.role,
        tenantId: result.tenantId,
        isClient: result.isClient,
        clientId: result.clientId,
      };
      try {
        await session.save();
      } catch (e) {
        console.error("[auth/login] session.save (mfa) failed", e);
        return NextResponse.json(
          { error: "Échec de sauvegarde de session MFA", detail: devError(e) },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { requiresMfa: true, email: result.email, mfaMethod: "email" },
        { headers: res.headers }
      );
    }

    session.userId = result.userId;
    session.email = result.email;
    session.role = result.role;
    session.tenantId = result.tenantId;
    session.isClient = result.isClient;
    session.clientId = result.clientId;
    session.mfaVerified = true;

    try {
      await session.save();
    } catch (e) {
      console.error("[auth/login] session.save failed", e);
      return NextResponse.json(
        { error: "Échec de sauvegarde de session", detail: devError(e) },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        userId: result.userId,
        role: result.role,
        isClient: result.isClient,
      },
      { headers: res.headers }
    );
  } catch (e) {
    console.error("[auth/login] unexpected error", e);
    return NextResponse.json({ error: "Erreur serveur", detail: devError(e) }, { status: 500 });
  }
}
