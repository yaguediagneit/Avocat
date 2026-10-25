import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { getTenantFromRequest } from "@/lib/tenant-request";
import { getTenantPrisma } from "@/lib/prisma";
import { clientDossierFilter } from "@/lib/client-access";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session.userId || !session.isClient || !session.clientId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const tenantId = await getTenantFromRequest(req);
  const prisma = await getTenantPrisma(tenantId);
  const dossiers = await prisma.dossier.findMany({
    where: clientDossierFilter(session.userId, session.clientId),
    take: 100,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      referenceInterne: true,
      typeAffaire: true,
      statut: true,
      createdAt: true,
    },
  });
  return NextResponse.json(dossiers);
}
