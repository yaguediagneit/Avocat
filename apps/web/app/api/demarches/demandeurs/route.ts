import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { tableSearchWhere } from "@/lib/search";
import { demandeurSchema, demandeurData } from "@/lib/demarches-schemas";

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  const demandeurs = await ctx.prisma.demandeur.findMany({
    where: tableSearchWhere(q, [
      "nom",
      "prenoms",
      "raisonSociale",
      "commune",
      "telephone",
      "email",
      "pieceIdentiteNumero",
      "ninea",
    ]),
    include: { client: { select: { id: true, raisonSociale: true } } },
    orderBy: { nom: "asc" },
    take: 300,
  });
  return NextResponse.json(demandeurs);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "demarches", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const parsed = demandeurSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const demandeur = await ctx.prisma.demandeur.create({
      data: demandeurData(parsed.data) as any,
    });
    return NextResponse.json(demandeur, { status: 201 });
  } catch (error) {
    console.error("Create demandeur error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
