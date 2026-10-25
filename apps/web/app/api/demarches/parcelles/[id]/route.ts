import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { parcellePatchSchema, parcelleData } from "@/lib/demarches-schemas";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  const parcelle = await ctx.prisma.parcelle.findUnique({ where: { id: params.id } });
  if (!parcelle) return NextResponse.json({ error: "Parcelle non trouvée" }, { status: 404 });
  return NextResponse.json(parcelle);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "demarches", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const parsed = parcellePatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const updated = await ctx.prisma.parcelle.update({
      where: { id: params.id },
      data: parcelleData(parsed.data) as any,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update parcelle error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
