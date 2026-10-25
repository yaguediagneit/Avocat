import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { createEntryFromPayment } from "@/lib/accounting";

const paiementSchema = z.object({
  factureId: z.string().uuid(),
  montant: z.coerce.number().int().positive("Le montant doit être positif"),
  mode: z.enum(["virement", "especes", "cheque", "carte", "autre"]),
  reference: z.string().optional(),
  datePaiement: z.coerce.date().optional(),
});

function statutFromSolde(total: number, paye: number): string {
  if (paye >= total) return "Payée";
  if (paye > 0) return "Partiellement payée";
  return "Brouillon";
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "factures", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = paiementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const facture = await ctx.prisma.facture.findUnique({
      where: { id: parsed.data.factureId },
      include: { paiements: true },
    });

    const factureDto = facture
      ? {
          id: facture.id,
          numero: facture.numero,
          totalHt: facture.totalHt,
          totalTva: facture.totalTva,
          totalTtc: facture.totalTtc,
          tvaEnabled: facture.tvaEnabled,
          accountingEntryId: facture.accountingEntryId,
          clientId: facture.clientId,
        }
      : null;

    if (!facture) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }

    const { paiement, entry } = await ctx.prisma.$transaction(async (tx) => {
      const paiement = await tx.paiement.create({
        data: {
          factureId: parsed.data.factureId,
          montant: parsed.data.montant,
          mode: parsed.data.mode,
          reference: parsed.data.reference,
          datePaiement: parsed.data.datePaiement || new Date(),
        },
      });

      const totalPaye =
        Number(facture.paiements.reduce((acc, p) => acc + Number(p.montant), 0)) +
        Number(paiement.montant);
      const totalTtc = Number(facture.totalTtc);

      await tx.facture.update({
        where: { id: facture.id },
        data: { statut: statutFromSolde(totalTtc, totalPaye) },
      });

      const entry = factureDto
        ? await createEntryFromPayment(tx, ctx.tenantId, paiement, factureDto, ctx.userId)
        : null;
      return { paiement, entry };
    });

    await logAudit(ctx.prisma, ctx.userId, "paiement_created", "paiement", paiement.id);
    if (entry) {
      await logAudit(ctx.prisma, ctx.userId, "accounting_entry_created", "accountingEntry", entry.id);
    }
    return NextResponse.json(paiement, { status: 201 });
  } catch (error) {
    console.error("Create paiement error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
