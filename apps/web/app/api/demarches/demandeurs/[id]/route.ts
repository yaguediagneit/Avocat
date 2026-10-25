import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { demandeurPatchSchema, demandeurData } from "@/lib/demarches-schemas";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  const demandeur = await ctx.prisma.demandeur.findUnique({ where: { id: params.id } });
  if (!demandeur) return NextResponse.json({ error: "Demandeur non trouvé" }, { status: 404 });
  return NextResponse.json(demandeur);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "demarches", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const parsed = demandeurPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const demandeur = await ctx.prisma.demandeur.update({
      where: { id: params.id },
      data: demandeurData(parsed.data) as any,
    });
    return NextResponse.json(demandeur);
  } catch (error) {
    console.error("Update demandeur error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
