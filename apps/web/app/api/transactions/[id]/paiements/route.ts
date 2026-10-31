import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { createEntryFromPayment } from "@/lib/accounting";
import { transactionPaiementSchema } from "@/lib/transactions-schemas";
import { PAIEMENT_NATURES, PAIEMENT_NATURES_CABINET } from "@/lib/transactions";

/// Les modes de paiement transaction sont en MAJUSCULES, ceux des
/// règlements de facture en minuscules.
const MODE_TO_FACTURE: Record<string, string> = {
  ESPECE: "especes",
  VIREMENT: "virement",
  CHEQUE: "cheque",
  MOBILE_MONEY: "autre",
  SEQUESTRE: "autre",
  AUTRE: "autre",
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const transaction = await ctx.prisma.transaction.findUnique({
    where: { id: params.id },
    select: { id: true, dossierId: true, reference: true },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, transaction.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  try {
    const parsed = transactionPaiementSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    // Règle impérative : les fonds clients et les sommes destinées au
    // notaire / à l'administration ne sont jamais des honoraires. Le
    // bénéficiaire réel est exigé pour les natures non-cabinet.
    if (!PAIEMENT_NATURES_CABINET.includes(data.nature) && !data.beneficiaire?.trim()) {
      return NextResponse.json(
        { error: "Le bénéficiaire réel est obligatoire pour cette nature de paiement." },
        { status: 400 }
      );
    }
    if (!PAIEMENT_NATURES.some((n) => n.code === data.nature)) {
      return NextResponse.json({ error: "Nature de paiement inconnue" }, { status: 400 });
    }

    const isCabinet = PAIEMENT_NATURES_CABINET.includes(data.nature);

    const { paiement, facture, entry } = await ctx.prisma.$transaction(async (tx) => {
      const paiement = await tx.transactionPaiement.create({
        data: {
          transactionId: transaction.id,
          nature: data.nature,
          libelle: data.libelle || null,
          montant: data.montant,
          devise: data.devise,
          payeur: data.payeur || null,
          beneficiaire: data.beneficiaire || (isCabinet ? "Cabinet" : null),
          mode: data.mode || null,
          date: data.date ? new Date(data.date) : new Date(),
          reference: data.reference || null,
          documentId: data.documentId || null,
          rapproche: data.rapproche ?? false,
          formaliteId: data.formaliteId || null,
          creePar: ctx.userId,
        },
      });

      // Honoraires / débours du cabinet : on émet la facture et on
      // enregistre le règlement — l'écriture comptable (trésorerie /
      // produits + TVA) est alors générée automatiquement.
      let facture: any = null;
      let entry: any = null;
      if (isCabinet) {
        const dossier = await tx.dossier.findUnique({
          where: { id: transaction.dossierId },
          select: { clientId: true },
        });
        if (dossier?.clientId) {
          const tvaRate = await tx.tvaRate.findFirst({
            where: { isDefault: true, isActive: true },
          });
          const tvaEnabled = !!tvaRate && tvaRate.rate > 0;
          // Le montant saisi est le montant encaissé (TTC).
          const totalTtc = paiement.montant;
          const totalHt = tvaEnabled
            ? Math.round(totalTtc / (1 + tvaRate!.rate / 100))
            : totalTtc;
          const totalTva = totalTtc - totalHt;
          const natureLabel =
            PAIEMENT_NATURES.find((n) => n.code === paiement.nature)?.label || paiement.nature;
          const designation = paiement.libelle || `${natureLabel} — ${transaction.reference}`;

          facture = await tx.facture.create({
            data: {
              dossierId: transaction.dossierId,
              clientId: dossier.clientId,
              numero: `FACT-${Date.now()}`,
              libelle: designation,
              tvaEnabled,
              tvaRateId: tvaEnabled ? tvaRate!.id : null,
              totalHt,
              totalTva,
              totalTtc,
              statut: "Payée",
              lines: {
                create: [{
                  description: designation,
                  quantite: 1,
                  prixUnitaire: totalHt,
                  tauxTva: tvaEnabled ? tvaRate!.rate : 0,
                  totalHt,
                  totalTva,
                  totalTtc,
                  ordre: 0,
                }],
              },
            },
          });

          const reglement = await tx.paiement.create({
            data: {
              factureId: facture.id,
              montant: totalTtc,
              mode: MODE_TO_FACTURE[paiement.mode || ""] || "virement",
              reference: paiement.reference,
              datePaiement: paiement.date,
            },
          });

          entry = await createEntryFromPayment(tx, ctx.tenantId, reglement, {
            id: facture.id,
            numero: facture.numero,
            totalHt,
            totalTva,
            totalTtc,
            tvaEnabled,
            accountingEntryId: null,
            clientId: dossier.clientId,
          }, ctx.userId);

          // Lien de traçabilité + rapprochement automatique :
          // l'écriture comptable existe dès l'enregistrement.
          await tx.transactionPaiement.update({
            where: { id: paiement.id },
            data: { factureId: facture.id, rapproche: true },
          });
          paiement.factureId = facture.id;
          paiement.rapproche = true;
        }
      }

      await tx.transactionEvenement.create({
        data: {
          transactionId: transaction.id,
          type: "PAIEMENT",
          description: `Paiement enregistré : ${paiement.montant.toLocaleString("fr-FR")} ${paiement.devise} — ${PAIEMENT_NATURES.find((n) => n.code === paiement.nature)?.label || paiement.nature}${facture ? ` — facture ${facture.numero}` : ""}`,
          details: { paiementId: paiement.id, nature: paiement.nature, beneficiaire: paiement.beneficiaire, factureId: facture?.id || null },
          creePar: ctx.userId,
        },
      });

      return { paiement, facture, entry };
    });

    await logAudit(ctx.prisma, ctx.userId, "transaction_paiement_added", "transaction", transaction.id, {
      montant: paiement.montant,
      nature: paiement.nature,
      factureId: facture?.id || null,
    }, req);
    if (entry) {
      await logAudit(ctx.prisma, ctx.userId, "accounting_entry_created", "accountingEntry", entry.id);
    }

    return NextResponse.json({ ...paiement, factureNumero: facture?.numero || null }, { status: 201 });
  } catch (error) {
    console.error("Add transaction paiement error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
