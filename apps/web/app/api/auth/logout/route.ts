import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { getTenantPrisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const res = new NextResponse();
  const session = await getSessionFromRequest(req, res);

  try {
    if (session.userId && session.tenantId) {
      const tenantPrisma = await getTenantPrisma(session.tenantId);
      await logAudit(tenantPrisma, session.userId, "logout", "user", session.userId, undefined, req);
    }
    session.destroy();
    return NextResponse.json({ ok: true }, { headers: res.headers });
  } catch (error) {
    console.error("Logout error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
