import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier, hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import {
  DEMARCHE_STATUTS,
  DEMARCHE_STATUT_LABELS,
  assertDemarcheTransition,
} from "@/lib/demarches";
import { z } from "zod";

const transitionSchema = z.object({
  statut: z.enum(DEMARCHE_STATUTS),
  // Champs de dépôt (DEPOSE)
  dateDepot: z.string().optional().nullable(),
  deposePar: z.string().optional().nullable(),
  canalDepot: z.string().optional().nullable(),
  numeroRecepisse: z.string().optional().nullable(),
  // Champs de décision (ACCEPTE / REFUSE / CLASSE_SANS_SUITE / DOCUMENT_DELIVRE)
  decisionDate: z.string().optional().nullable(),
  decisionType: z.string().optional().nullable(),
  decisionNotes: z.string().optional().nullable(),
  motifRejet: z.string().optional().nullable(),
  voieRecours: z.string().optional().nullable(),
  recoursEcheance: z.string().optional().nullable(),
  documentDelivreId: z.string().uuid().optional().nullable(),
  remisAuClientLe: z.string().optional().nullable(),
  // Dérogation motivée (pièces obligatoires manquantes)
  derogationMotif: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "demarches", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const demarche = await ctx.prisma.demarche.findUnique({
    where: { id: params.id },
    include: { type: true, pieces: true, frais: true },
  });
  if (!demarche) return NextResponse.json({ error: "Démarche non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, demarche.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = transitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const cible = data.statut;

    // Fusion des champs du payload avec l'existant pour vérifier les règles
    // sur l'état cible (ex. dateDepot peut être transmis dans cette requête).
    const fusion = {
      ...demarche,
      dateDepot: data.dateDepot ? new Date(data.dateDepot) : demarche.dateDepot,
      deposePar: data.deposePar ?? demarche.deposePar,
      canalDepot: data.canalDepot ?? demarche.canalDepot,
      numeroRecepisse: data.numeroRecepisse ?? demarche.numeroRecepisse,
      decisionDate: data.decisionDate ? new Date(data.decisionDate) : demarche.decisionDate,
      decisionType: data.decisionType ?? demarche.decisionType,
      motifRejet: data.motifRejet ?? demarche.motifRejet,
      documentDelivreId: data.documentDelivreId ?? demarche.documentDelivreId,
      fraisNonRapproches: demarche.frais.filter(
        (f) => f.nature === "DEBOURS" && !f.rapproche
      ).length,
    };

    // Dérogation globale : couvre les pièces obligatoires encore manquantes.
    let derogations = Array.isArray(demarche.derogations)
      ? [...(demarche.derogations as any[])]
      : [];
    if (data.derogationMotif?.trim()) {
      const manquantes = demarche.pieces.filter(
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

    const check = assertDemarcheTransition(fusion as any, cible);
    if (!check.ok) {
      return NextResponse.json({ error: check.erreurs.join(" ") }, { status: 400 });
    }

    // Le passage en PRET_A_DEPOT sur une démarche à validation renforcée
    // exige l'action `validate` sur la ressource (avocat / fiscaliste).
    if (cible === "PRET_A_DEPOT" && demarche.type.validationAvocat) {
      const peutValider =
        ctx.roleInfo.estAdmin || hasPermission(ctx.roleInfo, "demarches", "validate");
      if (!peutValider) {
        return NextResponse.json(
          { error: "Cette démarche sensible exige la validation d'un avocat ou fiscaliste." },
          { status: 403 }
        );
      }
    }

    const update: Record<string, unknown> = { statut: cible, derogations };
    if (data.dateDepot) update.dateDepot = new Date(data.dateDepot);
    if (data.deposePar !== undefined) update.deposePar = data.deposePar || null;
    if (data.canalDepot !== undefined) update.canalDepot = data.canalDepot || null;
    if (data.numeroRecepisse !== undefined) update.numeroRecepisse = data.numeroRecepisse || null;
    if (data.decisionDate) update.decisionDate = new Date(data.decisionDate);
    if (data.decisionType !== undefined) update.decisionType = data.decisionType || null;
    if (data.decisionNotes !== undefined) update.decisionNotes = data.decisionNotes || null;
    if (data.motifRejet !== undefined) update.motifRejet = data.motifRejet || null;
    if (data.voieRecours !== undefined) update.voieRecours = data.voieRecours || null;
    if (data.recoursEcheance)
      update.recoursEcheance = new Date(data.recoursEcheance);
    if (data.documentDelivreId !== undefined)
      update.documentDelivreId = data.documentDelivreId || null;
    if (data.remisAuClientLe !== undefined)
      update.remisAuClientLe = data.remisAuClientLe ? new Date(data.remisAuClientLe) : null;
    if (cible === "ARCHIVE") update.archiveLe = new Date();

    // Relance interne : à compter du dépôt ou de la dernière relance.
    if (["DEPOSE", "EN_INSTRUCTION", "RELANCE"].includes(cible)) {
      const jours = demarche.type.delaiRelanceJours || 15;
      const base = new Date();
      update.prochaineRelance = new Date(base.getTime() + jours * 86400000);
    }

    const updated = await ctx.prisma.demarche.update({
      where: { id: demarche.id },
      data: update,
    });

    const typeEvenement =
      cible === "DEPOSE"
        ? "DEPOT"
        : cible === "RELANCE"
          ? "RELANCE"
          : ["ACCEPTE", "REFUSE", "CLASSE_SANS_SUITE"].includes(cible)
            ? "DECISION"
            : "CHANGEMENT_STATUT";

    await ctx.prisma.demarcheEvenement.create({
      data: {
        demarcheId: demarche.id,
        type: typeEvenement,
        description:
          data.note?.trim() ||
          `${DEMARCHE_STATUT_LABELS[demarche.statut]} → ${DEMARCHE_STATUT_LABELS[cible]}`,
        details: {
          de: demarche.statut,
          vers: cible,
          numeroRecepisse: data.numeroRecepisse || undefined,
          derogationMotif: data.derogationMotif || undefined,
        },
        creePar: ctx.userId,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "demarche_transition", "demarche", demarche.id, {
      de: demarche.statut,
      vers: cible,
    }, req);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Demarche transition error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
