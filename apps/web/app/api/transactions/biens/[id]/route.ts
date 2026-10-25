import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { bienPatchSchema } from "@/lib/transactions-schemas";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const bien = await ctx.prisma.bien.findUnique({
    where: { id: params.id },
    include: {
      proprietaire: { select: { id: true, nom: true, prenoms: true, raisonSociale: true, telephone: true } },
      parcelle: { select: { id: true, nicad: true, titreFoncier: true, commune: true, superficie: true } },
      transactions: {
        include: {
          transaction: {
            select: { id: true, reference: true, statut: true, dossierId: true, type: { select: { libelle: true } } },
          },
        },
      },
    },
  });
  if (!bien) return NextResponse.json({ error: "Bien non trouvé" }, { status: 404 });
  return NextResponse.json(bien);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const bien = await ctx.prisma.bien.findUnique({ where: { id: params.id } });
  if (!bien) return NextResponse.json({ error: "Bien non trouvé" }, { status: 404 });

  try {
    const parsed = bienPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const updated = await ctx.prisma.bien.update({ where: { id: params.id }, data: parsed.data });
    await logAudit(ctx.prisma, ctx.userId, "bien_updated", "bien", params.id, {
      champs: Object.keys(parsed.data),
    }, req);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update bien error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "transactions", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  const bien = await ctx.prisma.bien.findUnique({
    where: { id: params.id },
    include: { _count: { select: { transactions: true } } },
  });
  if (!bien) return NextResponse.json({ error: "Bien non trouvé" }, { status: 404 });
  if (bien._count.transactions > 0) {
    return NextResponse.json(
      { error: "Ce bien est rattaché à des transactions : il ne peut pas être supprimé." },
      { status: 400 }
    );
  }

  await ctx.prisma.bien.delete({ where: { id: params.id } });
  await logAudit(ctx.prisma, ctx.userId, "bien_deleted", "bien", params.id, {
    designation: bien.designation,
  }, req);
  return NextResponse.json({ ok: true });
}
