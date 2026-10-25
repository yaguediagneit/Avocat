import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier, hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import {
  TRANSACTION_STATUT_LABELS,
  BLOCAGE_STATUTS,
  assertTransactionTransition,
} from "@/lib/transactions";
import { z } from "zod";

const transitionSchema = z.object({
  statut: z.string().min(1),
  // Blocage
  motifBlocage: z.string().optional().nullable(),
  // Preuves de circuit notarial / foncier
  mandatSigne: z.boolean().optional(),
  documentMandatId: z.string().uuid().optional().nullable(),
  etatDroitsReelsObtenu: z.boolean().optional(),
  notaireNom: z.string().optional().nullable(),
  notaireEtude: z.string().optional().nullable(),
  acteSigneLe: z.string().optional().nullable(),
  documentActeId: z.string().uuid().optional().nullable(),
  depotConservationLe: z.string().optional().nullable(),
  mutationInscrite: z.boolean().optional(),
  mutationInscriteLe: z.string().optional().nullable(),
  documentMutationId: z.string().uuid().optional().nullable(),
  // Bail
  droitDeLouerVerifie: z.boolean().optional(),
  etatLieuxEntreeFait: z.boolean().optional(),
  etatLieuxSortieFait: z.boolean().optional(),
  remisAuClientLe: z.string().optional().nullable(),
  // Dérogation motivée (pièces obligatoires manquantes)
  derogationMotif: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

/// Transitions exigeant `transactions:validate` (ou admin) : actes à
/// portée juridique forte et preuves de mutation foncière.
const TRANSITIONS_SENSIBLES = [
  "SIGNATURE_NOTARIALE_PLANIFIEE",
  "ACTE_NOTARIE_SIGNE",
  "MUTATION_INSCRITE",
  "ETAT_DROITS_REELS_FINAL_RECU",
  "DOSSIER_REMIS_CLIENT",
  "CLOTURE",
];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const transaction = await ctx.prisma.transaction.findUnique({
    where: { id: params.id },
    include: { type: true, pieces: true, parties: true, biens: true, paiements: true },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, transaction.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = transitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const cible = data.statut;

    // Fusion des champs du payload avec l'existant : les preuves peuvent
    // être transmises dans la même requête que la transition.
    const fusion = {
      ...transaction,
      mandatSigne: data.mandatSigne ?? transaction.mandatSigne,
      documentMandatId: data.documentMandatId ?? transaction.documentMandatId,
      etatDroitsReelsObtenu: data.etatDroitsReelsObtenu ?? transaction.etatDroitsReelsObtenu,
      notaireNom: data.notaireNom ?? transaction.notaireNom,
      acteSigneLe: data.acteSigneLe ? new Date(data.acteSigneLe) : transaction.acteSigneLe,
      documentActeId: data.documentActeId ?? transaction.documentActeId,
      depotConservationLe: data.depotConservationLe
        ? new Date(data.depotConservationLe)
        : transaction.depotConservationLe,
      mutationInscrite: data.mutationInscrite ?? transaction.mutationInscrite,
      mutationInscriteLe: data.mutationInscriteLe
        ? new Date(data.mutationInscriteLe)
        : transaction.mutationInscriteLe,
      documentMutationId: data.documentMutationId ?? transaction.documentMutationId,
      droitDeLouerVerifie: data.droitDeLouerVerifie ?? transaction.droitDeLouerVerifie,
      etatLieuxEntreeFait: data.etatLieuxEntreeFait ?? transaction.etatLieuxEntreeFait,
      remisAuClientLe: data.remisAuClientLe
        ? new Date(data.remisAuClientLe)
        : transaction.remisAuClientLe,
      blocageMotif: data.motifBlocage ?? transaction.blocageMotif,
      paiementsNonRapproches: transaction.paiements.filter((p) => !p.rapproche).length,
    };

    // Dérogation globale : couvre les pièces obligatoires encore manquantes.
    let derogations = Array.isArray(transaction.derogations)
      ? [...(transaction.derogations as any[])]
      : [];
    if (data.derogationMotif?.trim()) {
      const manquantes = transaction.pieces.filter(
        (p) =>
          p.niveau === "OBLIGATOIRE" &&
          !["RECUE", "VALIDEE", "NON_APPLICABLE"].includes(p.statut) &&
          !derogations.some((d: any) => d.pieceId === p.id)
      );
      for (const p of manquantes) {
        derogations.push({
          pieceId: p.id,
          libelle: p.libelle,
          motif: data.derogationMotif.trim(),
          validePar: ctx.userId,
          date: new Date().toISOString(),
        });
      }
    }
    fusion.derogations = derogations;

    const check = assertTransactionTransition(fusion as any, cible, {
      motifBlocage: data.motifBlocage ?? undefined,
    });
    if (!check.ok) {
      return NextResponse.json({ error: check.erreurs.join(" ") }, { status: 400 });
    }

    // Transitions sensibles : avocat / admin habilité.
    if (TRANSITIONS_SENSIBLES.includes(cible)) {
      const peutValider =
        ctx.roleInfo.estAdmin || hasPermission(ctx.roleInfo, "transactions", "validate");
      if (!peutValider) {
        return NextResponse.json(
          { error: "Cette étape exige la validation d'un avocat habilité ou de l'administrateur." },
          { status: 403 }
        );
      }
    }

    const update: Record<string, unknown> = { statut: cible, derogations };
    if (data.motifBlocage !== undefined) update.blocageMotif = data.motifBlocage || null;
    if ((BLOCAGE_STATUTS as readonly string[]).includes(cible)) {
      update.blocage = cible;
      update.blocageMotif = data.motifBlocage;
    } else if ((BLOCAGE_STATUTS as readonly string[]).includes(transaction.statut)) {
      // Déblocage : retour dans le flux principal.
      update.blocage = null;
      update.blocageMotif = null;
    }
    if (data.mandatSigne !== undefined) update.mandatSigne = data.mandatSigne;
    if (data.documentMandatId !== undefined) update.documentMandatId = data.documentMandatId || null;
    if (data.etatDroitsReelsObtenu !== undefined) update.etatDroitsReelsObtenu = data.etatDroitsReelsObtenu;
    if (data.notaireNom !== undefined) update.notaireNom = data.notaireNom || null;
    if (data.notaireEtude !== undefined) update.notaireEtude = data.notaireEtude || null;
    if (data.acteSigneLe !== undefined)
      update.acteSigneLe = data.acteSigneLe ? new Date(data.acteSigneLe) : null;
    if (data.documentActeId !== undefined) update.documentActeId = data.documentActeId || null;
    if (data.depotConservationLe !== undefined)
      update.depotConservationLe = data.depotConservationLe ? new Date(data.depotConservationLe) : null;
    if (data.mutationInscrite !== undefined) update.mutationInscrite = data.mutationInscrite;
    if (data.mutationInscriteLe !== undefined)
      update.mutationInscriteLe = data.mutationInscriteLe ? new Date(data.mutationInscriteLe) : null;
    if (data.documentMutationId !== undefined)
      update.documentMutationId = data.documentMutationId || null;
    if (data.droitDeLouerVerifie !== undefined) update.droitDeLouerVerifie = data.droitDeLouerVerifie;
    if (data.etatLieuxEntreeFait !== undefined) update.etatLieuxEntreeFait = data.etatLieuxEntreeFait;
    if (data.etatLieuxSortieFait !== undefined) update.etatLieuxSortieFait = data.etatLieuxSortieFait;
    if (data.remisAuClientLe !== undefined)
      update.remisAuClientLe = data.remisAuClientLe ? new Date(data.remisAuClientLe) : null;
    if (cible === "ARCHIVE") update.archiveLe = new Date();

    const updated = await ctx.prisma.transaction.update({
      where: { id: transaction.id },
      data: update,
    });

    const typeEvenement = (BLOCAGE_STATUTS as readonly string[]).includes(cible)
      ? "BLOCAGE"
      : (BLOCAGE_STATUTS as readonly string[]).includes(transaction.statut)
        ? "DEBLOCAGE"
        : cible === "ACTE_NOTARIE_SIGNE" || cible === "SIGNATURE_PARTIES"
          ? "SIGNATURE"
          : cible === "DEPOT_CONSERVATION_EFFECTUE"
            ? "DEPOT"
            : cible === "MUTATION_INSCRITE"
              ? "DECISION"
              : "CHANGEMENT_STATUT";

    await ctx.prisma.transactionEvenement.create({
      data: {
        transactionId: transaction.id,
        type: typeEvenement,
        description:
          data.note?.trim() ||
          data.motifBlocage?.trim() ||
          `${TRANSACTION_STATUT_LABELS[transaction.statut] || transaction.statut} → ${TRANSACTION_STATUT_LABELS[cible] || cible}`,
        details: {
          de: transaction.statut,
          vers: cible,
          motifBlocage: data.motifBlocage || undefined,
          derogationMotif: data.derogationMotif || undefined,
        },
        creePar: ctx.userId,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "transaction_transition", "transaction", transaction.id, {
      de: transaction.statut,
      vers: cible,
    }, req);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Transaction transition error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
