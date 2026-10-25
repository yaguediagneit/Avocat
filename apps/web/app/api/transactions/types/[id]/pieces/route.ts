import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { transactionTypePieceSchema } from "@/lib/transactions-schemas";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
  }

  const type = await ctx.prisma.transactionType.findUnique({ where: { id: params.id } });
  if (!type) return NextResponse.json({ error: "Type non trouvé" }, { status: 404 });

  try {
    const parsed = transactionTypePieceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const piece = await ctx.prisma.transactionTypePiece.create({
      data: {
        ...parsed.data,
        typeId: type.id,
        partieConcernee: parsed.data.partieConcernee || "TOUTES",
        sourceAttendue: parsed.data.sourceAttendue || "CLIENT",
      },
    });
    await logAudit(ctx.prisma, ctx.userId, "transaction_type_piece_added", "transaction_type", type.id, {
      code: piece.code,
    }, req);
    return NextResponse.json(piece, { status: 201 });
  } catch (error) {
    console.error("Add transaction type piece error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
