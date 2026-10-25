import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getTenantFromRequest } from "@/lib/tenant-request";
import { getTenantPrisma } from "@/lib/prisma";
import { getRoleByName } from "@/lib/rbac";
import { searchAll, SearchScope } from "@/lib/search";

const VALID_SCOPES: SearchScope[] = [
  "dossiers",
  "documents",
  "taches",
  "missions",
  "factures",
  "evenements",
];

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session.userId || !session.isClient) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const tenantId = await getTenantFromRequest(req);
  const prisma = await getTenantPrisma(tenantId);

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const rawScopes = searchParams.get("scopes");
  const scopes = rawScopes
    ? (rawScopes.split(",").filter((s) => VALID_SCOPES.includes(s as SearchScope)) as SearchScope[])
    : undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 100);

  if (!q.trim()) {
    return NextResponse.json({
      dossiers: [],
      documents: [],
      taches: [],
      missions: [],
      factures: [],
      clients: [],
      charges: [],
      users: [],
      evenements: [],
    });
  }

  let role = null;
  if (session.role) {
    role = await getRoleByName(prisma, session.role);
  }
  if (!role) {
    return NextResponse.json({ error: "Rôle inconnu" }, { status: 403 });
  }

  try {
    const results = await searchAll(
      {
        prisma,
        userId: session.userId,
        role,
        isClient: true,
        clientId: session.clientId || undefined,
      },
      { q, scopes, limit }
    );
    return NextResponse.json(results);
  } catch (error) {
    console.error("Client search error:", error);
    return NextResponse.json({ error: "Erreur de recherche" }, { status: 500 });
  }
}
