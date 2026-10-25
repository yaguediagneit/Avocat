import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const dossiers = await ctx.prisma.dossier.findMany({
    where: {
      statut: { notIn: ["Clôturé", "Archivé", "Cloturé", "Archive"] },
    },
    select: {
      id: true,
      referenceInterne: true,
      statut: true,
      client: { select: { raisonSociale: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json(dossiers);
}
