import { logAudit } from "./audit";

/// Le type d'affaire du dossier peut ne pas correspondre exactement au code
/// de la spécialité (paramétrage historique). On normalise pour retrouver
/// le workflow configuré dans Paramétrage > Spécialités.
const TYPE_AFFAIRE_TO_SPECIALITE: Record<string, string> = {
  contentieux_contractuel: "contentieux_contractuel",
  contentieux_immobilier: "contentieux_immobilier",
  recouvrement: "recouvrement_creances",
  procedure_civile: "procedure_civile_commerciale",
  conseil: "conseil_consultation",
  expulsion: "expulsion_recouvrement",
  bail: "baux_commerciaux_habitation",
  foncier: "litige_foncier",
  signification: "significations",
  constat: "constats_proces_verbaux",
  saisie: "saisies_execution",
  negociation: "negociation_reglement_amiable",
};

/// Mapping par défaut type d'acte d'huissier -> statut du dossier.
/// Surchargé par le champ WorkflowSpecialite.statutDossier quand il est renseigné.
const DEFAULT_DOSSIER_STATUT_BY_ACTE: Record<string, string> = {
  signification: "Audience ou échéance à venir",
  commandement: "En attente de retour",
  mise_en_demeure: "En attente de retour",
  sommation: "En attente de retour",
  saisie: "En exécution",
  constat: "En attente de décision",
  convocation: "Audience ou échéance à venir",
  recouvrement: "Facturation",
  pv: "Décision rendue",
};

export async function applyMissionStatusToDossier(
  prisma: any,
  mission: {
    id: string;
    dossierId: string;
    typeActe: string;
    statut: string;
    huissierId: string;
  }
) {
  // On ne déclenche le workflow que sur une mission réellement effectuée.
  if (mission.statut !== "Remise") {
    return;
  }

  const dossier = await prisma.dossier.findUnique({
    where: { id: mission.dossierId },
    select: { id: true, typeAffaire: true, statut: true },
  });
  if (!dossier) return;

  let targetStatut = DEFAULT_DOSSIER_STATUT_BY_ACTE[mission.typeActe];

  // Si une spécialité correspond au type d'affaire du dossier, on cherche
  // une étape de workflow du même code que l'acte d'huissier et son statut cible.
  const specialiteCode = TYPE_AFFAIRE_TO_SPECIALITE[dossier.typeAffaire] || dossier.typeAffaire;
  const specialite = await prisma.specialite.findUnique({
    where: { code: specialiteCode },
    select: { id: true },
  });

  if (specialite) {
    const workflowEtape = await prisma.workflowSpecialite.findUnique({
      where: {
        specialiteId_code: { specialiteId: specialite.id, code: mission.typeActe },
      },
      select: { statutDossier: true },
    });
    if (workflowEtape?.statutDossier) {
      targetStatut = workflowEtape.statutDossier;
    }
  }

  if (!targetStatut || targetStatut === dossier.statut) {
    return;
  }

  await prisma.dossier.update({
    where: { id: dossier.id },
    data: { statut: targetStatut },
  });

  await logAudit(prisma, mission.huissierId, "dossier_statut_changed", "dossier", dossier.id, {
    ancienStatut: dossier.statut,
    nouveauStatut: targetStatut,
    motif: `Mission ${mission.typeActe} marquée comme Remise`,
    missionId: mission.id,
  });
}
