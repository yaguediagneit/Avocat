import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "./session";

/** Champs d'un tenant exposables au superadmin (jamais `databaseUrl` ni `schemaName`). */
export const TENANT_PUBLIC_SELECT = {
  id: true,
  slug: true,
  raisonSociale: true,
  adresse: true,
  identifiantFiscal: true,
  logoUrl: true,
  domaine: true,
  planId: true,
  modeAbonnement: true,
  debutAbonnement: true,
  finAbonnement: true,
  actif: true,
  configuration: true,
  createdAt: true,
} as const;

export function sanitizeTenant<T extends Record<string, unknown>>(tenant: T) {
  const { databaseUrl: _db, schemaName: _schema, ...safe } = tenant as T & { databaseUrl?: unknown; schemaName?: unknown };
  return safe;
}

export const uuidSchema = z.string().uuid();

function getSuperAdminEmails(): Set<string> {
  return new Set(
    (process.env.SUPERADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function isSuperAdmin(email: string): Promise<boolean> {
  return getSuperAdminEmails().has(email.toLowerCase());
}

export async function guardSuperAdmin(req: NextRequest): Promise<true | NextResponse> {
  const res = new NextResponse();
  const session = await getSessionFromRequest(req, res);

  if (!session.userId || !session.mfaVerified) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const email = (session.email || "").toLowerCase();
  if (!(await isSuperAdmin(email))) {
    return NextResponse.json({ error: "Accès réservé au superadmin" }, { status: 403 });
  }

  return true;
}
