import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { transactionPaiementSchema } from "@/lib/transactions-schemas";
import { PAIEMENT_NATURES, PAIEMENT_NATURES_CABINET } from "@/lib/transactions";

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

    const paiement = await ctx.prisma.transactionPaiement.create({
      data: {
        transactionId: transaction.id,
        nature: data.nature,
        libelle: data.libelle || null,
        montant: data.montant,
        devise: data.devise,
        payeur: data.payeur || null,
        beneficiaire: data.beneficiaire || null,
        mode: data.mode || null,
        date: data.date ? new Date(data.date) : new Date(),
        reference: data.reference || null,
        documentId: data.documentId || null,
        rapproche: data.rapproche ?? false,
        formaliteId: data.formaliteId || null,
        creePar: ctx.userId,
      },
    });

    await ctx.prisma.transactionEvenement.create({
      data: {
        transactionId: transaction.id,
        type: "PAIEMENT",
        description: `Paiement enregistré : ${paiement.montant.toLocaleString("fr-FR")} ${paiement.devise} — ${PAIEMENT_NATURES.find((n) => n.code === paiement.nature)?.label || paiement.nature}`,
        details: { paiementId: paiement.id, nature: paiement.nature, beneficiaire: paiement.beneficiaire },
        creePar: ctx.userId,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "transaction_paiement_added", "transaction", transaction.id, {
      montant: paiement.montant,
      nature: paiement.nature,
    }, req);

    return NextResponse.json(paiement, { status: 201 });
  } catch (error) {
    console.error("Add transaction paiement error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
