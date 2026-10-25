import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { transactionPaiementPatchSchema } from "@/lib/transactions-schemas";

async function loadContext(req: NextRequest, transactionId: string, paiementId: string) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return { ctx } as const;
  const paiement = await ctx.prisma.transactionPaiement.findUnique({
    where: { id: paiementId },
    include: { transaction: { select: { id: true, dossierId: true } } },
  });
  if (!paiement || paiement.transactionId !== transactionId) {
    return { ctx, notFound: true } as const;
  }
  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, paiement.transaction.dossierId, "write");
  return { ctx, paiement, ok } as const;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; paiementId: string } }
) {
  const r = await loadContext(req, params.id, params.paiementId);
  if (r.ctx instanceof NextResponse) return r.ctx;
  if (r.notFound) return NextResponse.json({ error: "Paiement non trouvé" }, { status: 404 });
  if (!r.ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  const { ctx } = r;

  try {
    const parsed = transactionPaiementPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.date !== undefined)
      data.date = parsed.data.date ? new Date(parsed.data.date) : null;
    for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];

    const updated = await ctx.prisma.transactionPaiement.update({
      where: { id: params.paiementId },
      data,
    });
    await logAudit(ctx.prisma, ctx.userId, "transaction_paiement_updated", "transaction", params.id, {
      paiementId: params.paiementId,
      rapproche: updated.rapproche,
    }, req);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update transaction paiement error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; paiementId: string } }
) {
  const r = await loadContext(req, params.id, params.paiementId);
  if (r.ctx instanceof NextResponse) return r.ctx;
  if (r.notFound) return NextResponse.json({ error: "Paiement non trouvé" }, { status: 404 });
  if (!r.ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  const { ctx, paiement } = r;

  // Un paiement rapproché ne se supprime pas : il est tracé comptablement.
  if (paiement.rapproche) {
    return NextResponse.json(
      { error: "Un paiement rapproché ne peut pas être supprimé." },
      { status: 400 }
    );
  }

  await ctx.prisma.transactionPaiement.delete({ where: { id: params.paiementId } });
  await logAudit(ctx.prisma, ctx.userId, "transaction_paiement_removed", "transaction", params.id, {
    paiementId: params.paiementId,
  }, req);
  return NextResponse.json({ ok: true });
}
