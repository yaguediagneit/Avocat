import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { transactionFormalitePatchSchema, formaliteData } from "@/lib/transactions-schemas";

async function loadContext(req: NextRequest, transactionId: string, formaliteId: string) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return { ctx } as const;
  const formalite = await ctx.prisma.transactionFormalite.findUnique({
    where: { id: formaliteId },
    include: { transaction: { select: { id: true, dossierId: true } } },
  });
  if (!formalite || formalite.transactionId !== transactionId) {
    return { ctx, notFound: true } as const;
  }
  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, formalite.transaction.dossierId, "write");
  return { ctx, formalite, ok } as const;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; formaliteId: string } }
) {
  const r = await loadContext(req, params.id, params.formaliteId);
  if (r.ctx instanceof NextResponse) return r.ctx;
  if (r.notFound) return NextResponse.json({ error: "Formalité non trouvée" }, { status: 404 });
  if (!r.ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  const { ctx, formalite } = r;

  try {
    const parsed = transactionFormalitePatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // La démarche liée doit appartenir au même dossier.
    if (parsed.data.demarcheId) {
      const demarche = await ctx.prisma.demarche.findUnique({
        where: { id: parsed.data.demarcheId },
        select: { dossierId: true },
      });
      if (!demarche || demarche.dossierId !== formalite.transaction.dossierId) {
        return NextResponse.json(
          { error: "La démarche liée doit appartenir au même dossier." },
          { status: 400 }
        );
      }
    }

    const updated = await ctx.prisma.transactionFormalite.update({
      where: { id: params.formaliteId },
      data: formaliteData(parsed.data),
    });

    if (parsed.data.statut && parsed.data.statut !== formalite.statut) {
      await ctx.prisma.transactionEvenement.create({
        data: {
          transactionId: params.id,
          type: parsed.data.statut === "DEPOSE" ? "DEPOT" : "NOTE",
          description: `Formalité ${formalite.objet} : ${formalite.statut} → ${updated.statut}`,
          details: { formaliteId: formalite.id, de: formalite.statut, vers: updated.statut },
          creePar: ctx.userId,
        },
      });
    }

    await logAudit(ctx.prisma, ctx.userId, "transaction_formalite_updated", "transaction", params.id, {
      formaliteId: params.formaliteId,
      statut: updated.statut,
    }, req);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update transaction formalite error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; formaliteId: string } }
) {
  const r = await loadContext(req, params.id, params.formaliteId);
  if (r.ctx instanceof NextResponse) return r.ctx;
  if (r.notFound) return NextResponse.json({ error: "Formalité non trouvée" }, { status: 404 });
  if (!r.ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  const { ctx } = r;

  await ctx.prisma.transactionFormalite.delete({ where: { id: params.formaliteId } });
  await logAudit(ctx.prisma, ctx.userId, "transaction_formalite_removed", "transaction", params.id, {
    formaliteId: params.formaliteId,
  }, req);
  return NextResponse.json({ ok: true });
}
