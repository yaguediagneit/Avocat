import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { transactionTypePatchSchema } from "@/lib/transactions-schemas";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
  }

  const type = await ctx.prisma.transactionType.findUnique({ where: { id: params.id } });
  if (!type) return NextResponse.json({ error: "Type non trouvé" }, { status: 404 });

  try {
    const parsed = transactionTypePatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const updated = await ctx.prisma.transactionType.update({
      where: { id: params.id },
      data: parsed.data,
    });
    await logAudit(ctx.prisma, ctx.userId, "transaction_type_updated", "transaction_type", params.id, {
      champs: Object.keys(parsed.data),
    }, req);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update transaction type error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
