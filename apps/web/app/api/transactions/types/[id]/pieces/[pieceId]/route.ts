import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { transactionTypePieceSchema } from "@/lib/transactions-schemas";

async function loadPiece(ctx: any, typeId: string, pieceId: string) {
  return ctx.prisma.transactionTypePiece.findFirst({
    where: { id: pieceId, typeId },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; pieceId: string } }
) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
  }
  const piece = await loadPiece(ctx, params.id, params.pieceId);
  if (!piece) return NextResponse.json({ error: "Pièce non trouvée" }, { status: 404 });
  try {
    const parsed = transactionTypePieceSchema.partial().omit({ code: true }).safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = Object.fromEntries(
      Object.entries(parsed.data).map(([k, v]) => [k, v === null ? undefined : v])
    );
    const updated = await ctx.prisma.transactionTypePiece.update({
      where: { id: piece.id },
      data,
    });
    await logAudit(ctx.prisma, ctx.userId, "transaction_type_piece_updated", "transaction_type", params.id, {
      code: piece.code,
      champs: Object.keys(parsed.data),
    }, req);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Patch transaction type piece error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; pieceId: string } }
) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
  }
  const piece = await loadPiece(ctx, params.id, params.pieceId);
  if (!piece) return NextResponse.json({ error: "Pièce non trouvée" }, { status: 404 });
  await ctx.prisma.transactionTypePiece.update({
    where: { id: piece.id },
    data: { actif: false },
  });
  await logAudit(ctx.prisma, ctx.userId, "transaction_type_piece_removed", "transaction_type", params.id, {
    code: piece.code,
  }, req);
  return NextResponse.json({ ok: true });
}
