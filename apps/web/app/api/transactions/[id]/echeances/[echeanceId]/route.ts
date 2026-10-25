import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { transactionEcheancePatchSchema } from "@/lib/transactions-schemas";

const NATURE_TO_PAIEMENT: Record<string, string> = {
  LOYER: "LOYER",
  CHARGES: "LOYER",
  REVERSEMENT_BAILLEUR: "REVERSEMENT_BAILLEUR",
  AUTRE: "AUTRE",
};

async function loadContext(req: NextRequest, params: { id: string; echeanceId: string }, action: "read" | "write") {
  const ctx = action === "write" ? await guard(req, { resource: "transactions", action: "write" }) : await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  const transaction = await ctx.prisma.transaction.findUnique({
    where: { id: params.id },
    select: { id: true, dossierId: true, reference: true },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction non trouvée" }, { status: 404 });
  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, transaction.dossierId, action);
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  const echeance = await ctx.prisma.transactionEcheance.findFirst({
    where: { id: params.echeanceId, transactionId: params.id },
  });
  if (!echeance) return NextResponse.json({ error: "Échéance non trouvée" }, { status: 404 });
  return { ctx, transaction, echeance };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; echeanceId: string } }) {
  const loaded = await loadContext(req, params, "write");
  if (loaded instanceof NextResponse) return loaded;
  const { ctx, transaction, echeance } = loaded;

  try {
    const parsed = transactionEcheancePatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    const montantDu = data.montantDu ?? echeance.montantDu;
    const montantPaye = data.montantPaye ?? echeance.montantPaye;
    // Statut recalculé depuis les montants sauf annulation explicite.
    let statut = data.statut ?? echeance.statut;
    if (data.statut !== "ANNULE") {
      if (montantPaye >= montantDu && montantDu > 0) statut = "PAYE";
      else if (montantPaye > 0) statut = "PARTIEL";
      else if (statut !== "EN_RETARD") statut = "A_PERCEVOIR";
    }

    let paiementId = echeance.paiementId;
    if (data.enregistrerPaiement && montantPaye > echeance.montantPaye) {
      const naturePaiement = NATURE_TO_PAIEMENT[echeance.nature] ?? "AUTRE";
      const paiement = await ctx.prisma.transactionPaiement.create({
        data: {
          transactionId: transaction.id,
          nature: naturePaiement,
          libelle: `Échéance ${echeance.periode.toISOString().slice(0, 7)}`,
          montant: montantPaye - echeance.montantPaye,
          payeur: echeance.nature === "REVERSEMENT_BAILLEUR" ? "Cabinet" : null,
          beneficiaire: echeance.beneficiaire || (echeance.nature === "REVERSEMENT_BAILLEUR" ? "Bailleur" : "Cabinet"),
          mode: data.modePaiement || null,
          reference: null,
          creePar: ctx.userId,
        },
      });
      paiementId = paiement.id;
    }

    const updated = await ctx.prisma.transactionEcheance.update({
      where: { id: echeance.id },
      data: {
        montantDu: data.montantDu ?? undefined,
        montantPaye,
        statut,
        payeLe: data.payeLe !== undefined ? (data.payeLe ? new Date(data.payeLe) : null) : (montantPaye > 0 && !echeance.payeLe ? new Date() : undefined),
        modePaiement: data.modePaiement !== undefined ? data.modePaiement : undefined,
        beneficiaire: data.beneficiaire !== undefined ? data.beneficiaire : undefined,
        note: data.note !== undefined ? data.note : undefined,
        paiementId,
      },
    });

    await ctx.prisma.transactionEvenement.create({
      data: {
        transactionId: transaction.id,
        type: "PAIEMENT",
        description: `Échéance ${updated.periode.toISOString().slice(0, 7)} (${updated.nature}) : ${updated.montantPaye.toLocaleString("fr-FR")} / ${updated.montantDu.toLocaleString("fr-FR")} F — ${updated.statut}`,
        details: { echeanceId: updated.id, statut: updated.statut },
        creePar: ctx.userId,
      },
    });
    await logAudit(ctx.prisma, ctx.userId, "transaction_echeance_updated", "transaction", transaction.id, {
      echeanceId: updated.id,
      statut: updated.statut,
    }, req);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Patch transaction echeance error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; echeanceId: string } }) {
  const loaded = await loadContext(req, params, "write");
  if (loaded instanceof NextResponse) return loaded;
  const { ctx, transaction, echeance } = loaded;

  // Retrait défensif : une échéance déjà payée n'est pas supprimée, elle
  // est annulée (traçabilité des flux).
  if (echeance.statut === "PAYE" || echeance.montantPaye > 0) {
    const updated = await ctx.prisma.transactionEcheance.update({
      where: { id: echeance.id },
      data: { statut: "ANNULE" },
    });
    return NextResponse.json(updated);
  }
  await ctx.prisma.transactionEcheance.delete({ where: { id: echeance.id } });
  await logAudit(ctx.prisma, ctx.userId, "transaction_echeance_removed", "transaction", transaction.id, {
    echeanceId: echeance.id,
  }, req);
  return NextResponse.json({ ok: true });
}
