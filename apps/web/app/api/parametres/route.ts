import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const parametreSchema = z.object({
  categorie: z.string().min(1),
  code: z.string().min(1),
  libelle: z.string().min(1),
  ordre: z.coerce.number().int().default(0),
  actif: z.boolean().default(true),
});

const parametreUpdateSchema = parametreSchema.partial();

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "parametres", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const categorie = searchParams.get("categorie");
  const actif = searchParams.get("actif");

  const where: Record<string, unknown> = {};
  if (categorie) where.categorie = categorie;
  if (actif !== null) where.actif = actif === "true";

  const parametres = await ctx.prisma.parametre.findMany({
    where,
    orderBy: [{ categorie: "asc" }, { ordre: "asc" }, { libelle: "asc" }],
  });

  return NextResponse.json(parametres);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "parametres", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = parametreSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const parametre = await ctx.prisma.parametre.create({
      data: parsed.data,
    });

    await logAudit(ctx.prisma, ctx.userId, "parametre_created", "parametre", parametre.id);
    return NextResponse.json(parametre, { status: 201 });
  } catch (error) {
    console.error("Create parametre error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
