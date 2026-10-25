import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { tableSearchWhere } from "@/lib/search";
import { logAudit } from "@/lib/audit";
import { bienSchema } from "@/lib/transactions-schemas";

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const nature = searchParams.get("nature") || "";

  const biens = await ctx.prisma.bien.findMany({
    where: {
      ...(nature ? { nature } : {}),
      ...tableSearchWhere(q, [
        "designation",
        "referenceBien",
        "adresse",
        "quartier",
        "commune",
        "referenceDroit",
        "proprietaire.nom",
        "proprietaire.raisonSociale",
        "parcelle.nicad",
        "parcelle.titreFoncier",
      ]),
    },
    include: {
      proprietaire: { select: { id: true, nom: true, prenoms: true, raisonSociale: true } },
      parcelle: { select: { id: true, nicad: true, titreFoncier: true, commune: true } },
      _count: { select: { transactions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return NextResponse.json(biens);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const parsed = bienSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const bien = await ctx.prisma.bien.create({ data: parsed.data });
    await logAudit(ctx.prisma, ctx.userId, "bien_created", "bien", bien.id, {
      designation: bien.designation,
    }, req);
    return NextResponse.json(bien, { status: 201 });
  } catch (error) {
    console.error("Create bien error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
