import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { transactionPartiePatchSchema } from "@/lib/transactions-schemas";

async function loadContext(req: NextRequest, transactionId: string, partieId: string) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return { ctx } as const;
  const partie = await ctx.prisma.transactionPartie.findUnique({
    where: { id: partieId },
    include: { transaction: { select: { id: true, dossierId: true } } },
  });
  if (!partie || partie.transactionId !== transactionId) {
    return { ctx, notFound: true } as const;
  }
  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, partie.transaction.dossierId, "write");
  return { ctx, partie, ok } as const;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; partieId: string } }
) {
  const r = await loadContext(req, params.id, params.partieId);
  if ("ctx" in r && r.ctx instanceof NextResponse) return r.ctx;
  if (r.notFound) return NextResponse.json({ error: "Partie non trouvée" }, { status: 404 });
  if (!r.ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  const { ctx } = r;

  try {
    const parsed = transactionPartiePatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const updated = await ctx.prisma.transactionPartie.update({
      where: { id: params.partieId },
      data: parsed.data,
    });
    await logAudit(ctx.prisma, ctx.userId, "transaction_partie_updated", "transaction", params.id, {
      partieId: params.partieId,
    }, req);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update transaction partie error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; partieId: string } }
) {
  const r = await loadContext(req, params.id, params.partieId);
  if ("ctx" in r && r.ctx instanceof NextResponse) return r.ctx;
  if (r.notFound) return NextResponse.json({ error: "Partie non trouvée" }, { status: 404 });
  if (!r.ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  const { ctx } = r;

  await ctx.prisma.transactionPartie.delete({ where: { id: params.partieId } });
  await logAudit(ctx.prisma, ctx.userId, "transaction_partie_removed", "transaction", params.id, {
    partieId: params.partieId,
  }, req);
  return NextResponse.json({ ok: true });
}
