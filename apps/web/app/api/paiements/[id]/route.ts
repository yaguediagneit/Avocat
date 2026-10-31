import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { reverseAccountingEntry } from "@/lib/accounting";

function statutFromSolde(total: number, paye: number): string {
  if (paye >= total) return "Payée";
  if (paye > 0) return "Partiellement payée";
  return "Brouillon";
}

// Annulation d'un règlement : contre-passation de son écriture (audit conservé),
// suppression de la ligne de paiement et recalcul du statut de la facture.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "factures", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const paiement = await ctx.prisma.paiement.findUnique({
      where: { id: params.id },
      include: { facture: { include: { paiements: true } } },
    });
    if (!paiement) {
      return NextResponse.json({ error: "Paiement non trouvé" }, { status: 404 });
    }

    await ctx.prisma.$transaction(async (tx) => {
      if (paiement.accountingEntryId) {
        await reverseAccountingEntry(tx, paiement.accountingEntryId, {
          userId: ctx.userId,
          reason: "annulation du règlement",
        });
      }
      await tx.paiement.delete({ where: { id: paiement.id } });

      const restant = paiement.facture.paiements
        .filter((p) => p.id !== paiement.id)
        .reduce((acc, p) => acc + Number(p.montant), 0);
      await tx.facture.update({
        where: { id: paiement.factureId },
        data: { statut: statutFromSolde(Number(paiement.facture.totalTtc), restant) },
      });
    });

    await logAudit(ctx.prisma, ctx.userId, "paiement_cancelled", "paiement", paiement.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Cancel paiement error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
