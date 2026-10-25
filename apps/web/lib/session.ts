import { getIronSession, IronSession } from "iron-session";
import { NextRequest, NextResponse } from "next/server";
import { SessionData, sessionOptions } from "./session-options";

export async function getSession(): Promise<IronSession<SessionData>> {
  const { cookies } = await import("next/headers");
  const cookieStore = cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getSessionFromRequest(req: NextRequest, res?: NextResponse): Promise<IronSession<SessionData>> {
  const response = res || new NextResponse();
  return getIronSession<SessionData>(req, response, sessionOptions);
}

export async function requireAuth(): Promise<IronSession<SessionData>> {
  const session = await getSession();

  if (!session.userId || !session.mfaVerified) {
    throw new Error("Non authentifié");
  }

  return session;
}

export async function requireAuthFromRequest(req: NextRequest): Promise<IronSession<SessionData & { userId: string }>> {
  const session = await getSessionFromRequest(req);

  if (!session.userId || !session.mfaVerified) {
    throw new Error("Non authentifié");
  }

  return session as IronSession<SessionData & { userId: string }>;
}
