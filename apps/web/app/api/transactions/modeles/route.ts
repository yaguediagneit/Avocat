import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { transactionModeleSchema } from "@/lib/transactions-schemas";

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  const modeles = await ctx.prisma.transactionModele.findMany({
    include: { type: { select: { code: true, libelle: true } } },
    orderBy: [{ ordre: "asc" }, { titre: "asc" }],
  });
  return NextResponse.json(modeles);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
  }
  try {
    const parsed = transactionModeleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const modele = await ctx.prisma.transactionModele.create({ data: parsed.data });
    await logAudit(ctx.prisma, ctx.userId, "transaction_modele_created", "transaction_modele", modele.id, {
      code: modele.code,
    }, req);
    return NextResponse.json(modele, { status: 201 });
  } catch (error) {
    console.error("Create transaction modele error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
