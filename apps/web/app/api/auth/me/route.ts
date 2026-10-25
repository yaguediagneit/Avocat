import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

export async function GET(req: NextRequest) {
  const res = new NextResponse();
  const session = await getSessionFromRequest(req, res);

  if (!session.userId || !session.mfaVerified) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  return NextResponse.json(
    {
      userId: session.userId,
      email: session.email,
      role: session.role,
      tenantId: session.tenantId,
      isClient: session.isClient,
    },
    { headers: res.headers }
  );
}
