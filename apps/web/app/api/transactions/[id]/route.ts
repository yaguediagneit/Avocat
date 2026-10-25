import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier, hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { TRANSACTION_TRANSITIONS, TRANSACTION_STATUT_LABELS } from "@/lib/transactions";
import {
  transactionPatchSchema,
  transactionData,
  transactionDerogationSchema,
} from "@/lib/transactions-schemas";
import { z } from "zod";

const patchSchema = transactionPatchSchema.extend({
  /// Validation juridique : réservée aux rôles détenant l'action
  /// `validate` sur la ressource `transactions`.
  valider: z.boolean().optional(),
  /// Dérogation motivée à une pièce obligatoire : { pieceId, motif }.
  derogation: transactionDerogationSchema.optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const transaction = await ctx.prisma.transaction.findUnique({
    where: { id: params.id },
    include: {
      type: { include: { pieces: { orderBy: { ordre: "asc" } } } },
      dossier: {
        select: {
          id: true,
          referenceInterne: true,
          client: { select: { id: true, raisonSociale: true } },
        },
      },
      parties: {
        include: {
          demandeur: { select: { id: true, nom: true, prenoms: true, raisonSociale: true, typePersonne: true, telephone: true } },
          client: { select: { id: true, raisonSociale: true } },
        },
        orderBy: { ordre: "asc" },
      },
      biens: {
        include: {
          bien: { include: { parcelle: { select: { id: true, nicad: true, titreFoncier: true, commune: true } } } },
        },
      },
      pieces: { orderBy: [{ ordre: "asc" }, { createdAt: "asc" }] },
      formalites: {
        include: {
          demarche: { select: { id: true, reference: true, statut: true, type: { select: { libelle: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
      demarches: {
        select: { id: true, reference: true, statut: true, objet: true, type: { select: { libelle: true } } },
      },
      paiements: { orderBy: { date: "desc" } },
      echeances: { orderBy: [{ periode: "asc" }, { nature: "asc" }] },
      etatsLieux: { include: { lignes: { orderBy: { ordre: "asc" } } }, orderBy: { createdAt: "desc" } },
      evenements: { orderBy: { date: "desc" }, take: 200 },
    },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, transaction.dossierId, "read");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  const workflow = transaction.type?.workflow || "GENERIQUE";
  const transitions = TRANSACTION_TRANSITIONS[workflow] || {};
  const transitionsPossibles = (transitions[transaction.statut] || []).map((cible) => ({
    statut: cible,
    label: TRANSACTION_STATUT_LABELS[cible] || cible,
  }));

  const paiementsNonRapproches = transaction.paiements.filter((p) => !p.rapproche).length;

  return NextResponse.json({ ...transaction, transitionsPossibles, paiementsNonRapproches });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const transaction = await ctx.prisma.transaction.findUnique({
    where: { id: params.id },
    include: { type: true },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, transaction.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = transactionData(parsed.data);
    delete data.valider;
    delete data.derogation;

    // Les champs de preuve de mutation et de signature sur une vente sous
    // titre foncier sont sensibles : `transactions:validate` ou admin.
    const touchesMutation =
      "mutationInscrite" in data ||
      "mutationInscriteLe" in data ||
      "documentMutationId" in data ||
      "depotConservationLe" in data;
    if (touchesMutation && transaction.type?.mutationFonciere) {
      const peutValider = ctx.roleInfo.estAdmin || hasPermission(ctx.roleInfo, "transactions", "validate");
      if (!peutValider) {
        return NextResponse.json(
          { error: "La preuve de mutation foncière exige un validateur habilité (avocat / admin)." },
          { status: 403 }
        );
      }
    }

    // Validation juridique : réservée aux rôles détenant l'action
    // `validate` sur la ressource `transactions`.
    if (parsed.data.valider) {
      const peutValider =
        ctx.roleInfo.estAdmin || hasPermission(ctx.roleInfo, "transactions", "validate");
      if (!peutValider) {
        return NextResponse.json(
          { error: "Seul un avocat habilité peut valider cette transaction." },
          { status: 403 }
        );
      }
      data.valideParId = ctx.userId;
      data.valideLe = new Date();
    }

    // Dérogation motivée à une pièce obligatoire : journalisée.
    let derogationPieceLibelle: string | null = null;
    if (parsed.data.derogation) {
      const piece = await ctx.prisma.transactionPiece.findFirst({
        where: { id: parsed.data.derogation.pieceId, transactionId: transaction.id },
      });
      if (!piece) {
        return NextResponse.json({ error: "Pièce introuvable" }, { status: 404 });
      }
      derogationPieceLibelle = piece.libelle;
      const derogations = Array.isArray(transaction.derogations)
        ? [...(transaction.derogations as any[])]
        : [];
      derogations.push({
        pieceId: piece.id,
        libelle: piece.libelle,
        motif: parsed.data.derogation.motif,
        validePar: ctx.userId,
        date: new Date().toISOString(),
      });
      data.derogations = derogations;
    }

    const { biensIds } = parsed.data;
    const updated = await ctx.prisma.$transaction(async (tx) => {
      if (biensIds) {
        await tx.transactionBien.deleteMany({ where: { transactionId: transaction.id } });
        if (biensIds.length) {
          await tx.transactionBien.createMany({
            data: biensIds.map((bienId, i) => ({
              transactionId: transaction.id,
              bienId,
              role: i === 0 ? "PRINCIPAL" : "ANNEXE",
            })),
          });
        }
      }
      return tx.transaction.update({ where: { id: transaction.id }, data });
    });

    if (parsed.data.valider) {
      await ctx.prisma.transactionEvenement.create({
        data: {
          transactionId: transaction.id,
          type: "VALIDATION",
          description: "Validation juridique de la transaction",
          creePar: ctx.userId,
        },
      });
    }
    if (derogationPieceLibelle) {
      await ctx.prisma.transactionEvenement.create({
        data: {
          transactionId: transaction.id,
          type: "NOTE",
          description: `Dérogation accordée pour la pièce « ${derogationPieceLibelle} » : ${parsed.data.derogation?.motif}`,
          creePar: ctx.userId,
        },
      });
    }

    await logAudit(ctx.prisma, ctx.userId, "transaction_updated", "transaction", transaction.id, {
      champs: Object.keys(data),
    }, req);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update transaction error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "transactions", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  const transaction = await ctx.prisma.transaction.findUnique({ where: { id: params.id } });
  if (!transaction) return NextResponse.json({ error: "Transaction non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, transaction.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  // Archivage logique : la transaction reste traçable (audit, preuves).
  const updated = await ctx.prisma.transaction.update({
    where: { id: transaction.id },
    data: { archiveLe: new Date(), statut: "ARCHIVE" },
  });

  await ctx.prisma.transactionEvenement.create({
    data: {
      transactionId: transaction.id,
      type: "CHANGEMENT_STATUT",
      description: "Transaction archivée",
      details: { de: transaction.statut, vers: "ARCHIVE" },
      creePar: ctx.userId,
    },
  });

  await logAudit(ctx.prisma, ctx.userId, "transaction_archived", "transaction", transaction.id, {
    reference: transaction.reference,
  }, req);

  return NextResponse.json(updated);
}
