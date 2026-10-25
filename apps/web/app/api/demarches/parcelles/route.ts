import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { tableSearchWhere } from "@/lib/search";
import { parcelleSchema, parcelleData } from "@/lib/demarches-schemas";

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  const parcelles = await ctx.prisma.parcelle.findMany({
    where: tableSearchWhere(q, [
      "nicad",
      "titreFoncier",
      "referenceDroit",
      "commune",
      "quartier",
      "departement",
      "region",
      "adresse",
      "numeroParcelle",
    ]),
    orderBy: { updatedAt: "desc" },
    take: 300,
  });
  return NextResponse.json(parcelles);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "demarches", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const parsed = parcelleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const parcelle = await ctx.prisma.parcelle.create({
      data: parcelleData(parsed.data) as any,
    });
    return NextResponse.json(parcelle, { status: 201 });
  } catch (error) {
    console.error("Create parcelle error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
