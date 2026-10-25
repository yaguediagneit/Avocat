import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { transactionPiecePatchSchema } from "@/lib/transactions-schemas";

async function loadContext(req: NextRequest, transactionId: string, pieceId: string) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return { ctx } as const;
  const piece = await ctx.prisma.transactionPiece.findUnique({
    where: { id: pieceId },
    include: { transaction: { select: { id: true, dossierId: true } } },
  });
  if (!piece || piece.transactionId !== transactionId) {
    return { ctx, notFound: true } as const;
  }
  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, piece.transaction.dossierId, "write");
  return { ctx, piece, ok } as const;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; pieceId: string } }
) {
  const r = await loadContext(req, params.id, params.pieceId);
  if (r.ctx instanceof NextResponse) return r.ctx;
  if (r.notFound) return NextResponse.json({ error: "Pièce non trouvée" }, { status: 404 });
  if (!r.ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  const { ctx, piece } = r;

  try {
    const parsed = transactionPiecePatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.expireLe !== undefined)
      data.expireLe = parsed.data.expireLe ? new Date(parsed.data.expireLe) : null;
    // Réception / validation horodatée.
    if (parsed.data.statut === "RECUE" && piece.statut !== "RECUE") data.recueLe = new Date();
    if (parsed.data.statut === "VALIDEE" && piece.statut !== "VALIDEE") {
      data.verifiePar = ctx.userId;
      data.verifieLe = new Date();
    }

    const updated = await ctx.prisma.transactionPiece.update({
      where: { id: params.pieceId },
      data,
    });

    await logAudit(ctx.prisma, ctx.userId, "transaction_piece_updated", "transaction", params.id, {
      pieceId: params.pieceId,
      statut: updated.statut,
    }, req);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update transaction piece error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; pieceId: string } }
) {
  const r = await loadContext(req, params.id, params.pieceId);
  if (r.ctx instanceof NextResponse) return r.ctx;
  if (r.notFound) return NextResponse.json({ error: "Pièce non trouvée" }, { status: 404 });
  if (!r.ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  const { ctx } = r;

  await ctx.prisma.transactionPiece.delete({ where: { id: params.pieceId } });
  await logAudit(ctx.prisma, ctx.userId, "transaction_piece_removed", "transaction", params.id, {
    pieceId: params.pieceId,
  }, req);
  return NextResponse.json({ ok: true });
}
