/**
 * Module « Démarches administratives » (foncier, urbanisme, fiscalité).
 *
 * Principe central : le cabinet prépare, contrôle et suit les démarches ;
 * seule l'administration compétente délivre l'acte. Les check-lists de
 * pièces distinguent strictement les documents internes du cabinet des
 * documents administratifs à obtenir.
 */

/* ------------------------------------------------------------------ */
/* Statuts du workflow                                                  */
/* ------------------------------------------------------------------ */

export const DEMARCHE_STATUTS = [
  "BROUILLON",
  "A_QUALIFIER",
  "ATTENTE_CLIENT",
  "PIECES_PARTIELLES",
  "CONTROLE_INTERNE",
  "A_CORRIGER",
  "PRET_VALIDATION",
  "PRET_A_DEPOT",
  "DEPOSE",
  "EN_INSTRUCTION",
  "COMPLEMENT_DEMANDE",
  "RELANCE",
  "ACCEPTE",
  "DOCUMENT_DELIVRE",
  "REFUSE",
  "CLASSE_SANS_SUITE",
  "RECOURS_A_ETUDIER",
  "CLOTURE",
  "ARCHIVE",
] as const;

export type DemarcheStatut = (typeof DEMARCHE_STATUTS)[number];

export const DEMARCHE_STATUT_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  A_QUALIFIER: "À qualifier",
  ATTENTE_CLIENT: "En attente du client",
  PIECES_PARTIELLES: "Pièces partielles",
  CONTROLE_INTERNE: "Contrôle interne",
  A_CORRIGER: "À corriger",
  PRET_VALIDATION: "Prêt pour validation",
  PRET_A_DEPOT: "Prêt à déposer",
  DEPOSE: "Déposé",
  EN_INSTRUCTION: "En instruction",
  COMPLEMENT_DEMANDE: "Complément demandé",
  RELANCE: "Relance",
  ACCEPTE: "Accepté",
  DOCUMENT_DELIVRE: "Document délivré",
  REFUSE: "Refusé",
  CLASSE_SANS_SUITE: "Classé sans suite",
  RECOURS_A_ETUDIER: "Recours à étudier",
  CLOTURE: "Clôturé",
  ARCHIVE: "Archivé",
};

export const DEMARCHE_STATUT_BADGES: Record<string, string> = {
  BROUILLON: "bg-gray-100 text-gray-700",
  A_QUALIFIER: "bg-amber-100 text-amber-800",
  ATTENTE_CLIENT: "bg-neutral-100 text-neutral-700",
  PIECES_PARTIELLES: "bg-yellow-100 text-yellow-800",
  CONTROLE_INTERNE: "bg-blue-100 text-blue-700",
  A_CORRIGER: "bg-orange-100 text-orange-700",
  PRET_VALIDATION: "bg-violet-100 text-violet-700",
  PRET_A_DEPOT: "bg-indigo-100 text-indigo-700",
  DEPOSE: "bg-cyan-100 text-cyan-700",
  EN_INSTRUCTION: "bg-sky-100 text-sky-700",
  COMPLEMENT_DEMANDE: "bg-amber-100 text-amber-700",
  RELANCE: "bg-rose-100 text-rose-700",
  ACCEPTE: "bg-green-100 text-green-700",
  DOCUMENT_DELIVRE: "bg-emerald-100 text-emerald-700",
  REFUSE: "bg-red-100 text-red-700",
  CLASSE_SANS_SUITE: "bg-stone-100 text-stone-700",
  RECOURS_A_ETUDIER: "bg-purple-100 text-purple-700",
  CLOTURE: "bg-emerald-100 text-emerald-800",
  ARCHIVE: "bg-gray-200 text-gray-600",
};

/// Transitions autorisées. Les contrôles métier (qualification, pièces,
/// dépôt, décision) sont appliqués par `assertDemarcheTransition`.
export const DEMARCHE_TRANSITIONS: Record<string, string[]> = {
  BROUILLON: ["A_QUALIFIER", "ATTENTE_CLIENT", "PIECES_PARTIELLES", "CONTROLE_INTERNE"],
  A_QUALIFIER: ["BROUILLON", "ATTENTE_CLIENT", "PIECES_PARTIELLES", "CONTROLE_INTERNE"],
  ATTENTE_CLIENT: ["PIECES_PARTIELLES", "CONTROLE_INTERNE", "A_QUALIFIER"],
  PIECES_PARTIELLES: ["ATTENTE_CLIENT", "CONTROLE_INTERNE", "A_QUALIFIER"],
  CONTROLE_INTERNE: ["A_CORRIGER", "PRET_VALIDATION", "A_QUALIFIER"],
  A_CORRIGER: ["CONTROLE_INTERNE"],
  PRET_VALIDATION: ["A_CORRIGER", "PRET_A_DEPOT"],
  PRET_A_DEPOT: ["A_CORRIGER", "DEPOSE"],
  DEPOSE: ["EN_INSTRUCTION", "COMPLEMENT_DEMANDE"],
  EN_INSTRUCTION: ["COMPLEMENT_DEMANDE", "RELANCE", "ACCEPTE", "REFUSE", "CLASSE_SANS_SUITE"],
  COMPLEMENT_DEMANDE: ["EN_INSTRUCTION", "PRET_A_DEPOT"],
  RELANCE: ["EN_INSTRUCTION", "ACCEPTE", "REFUSE", "CLASSE_SANS_SUITE"],
  ACCEPTE: ["DOCUMENT_DELIVRE", "CLOTURE"],
  DOCUMENT_DELIVRE: ["CLOTURE"],
  REFUSE: ["RECOURS_A_ETUDIER", "CLOTURE"],
  CLASSE_SANS_SUITE: ["CLOTURE"],
  RECOURS_A_ETUDIER: ["CLOTURE"],
  CLOTURE: ["ARCHIVE"],
  ARCHIVE: [],
};

/// Statuts considérés comme « en attente de l'administration ».
export const STATUTS_ATTENTE_ADMIN = ["DEPOSE", "EN_INSTRUCTION", "COMPLEMENT_DEMANDE", "RELANCE"];

/// Statuts terminaux (après décision ou abandon).
export const STATUTS_TERMINAUX = ["ACCEPTE", "DOCUMENT_DELIVRE", "REFUSE", "CLASSE_SANS_SUITE", "CLOTURE", "ARCHIVE"];

/* ------------------------------------------------------------------ */
/* Check-list des pièces                                                */
/* ------------------------------------------------------------------ */

export const PIECE_CATEGORIES = [
  { code: "DOCUMENT_INTERNE_CABINET", label: "Document interne cabinet" },
  { code: "DOCUMENT_ADMINISTRATIF_A_OBTENIR", label: "Document administratif à obtenir" },
  { code: "PIECE_CLIENT", label: "Pièce du client" },
  { code: "PIECE_TECHNIQUE", label: "Pièce technique" },
  { code: "PREUVE_DE_DEPOT_ET_SUIVI", label: "Preuve de dépôt / suivi" },
] as const;

export const PIECE_NIVEAUX = [
  { code: "OBLIGATOIRE", label: "Obligatoire" },
  { code: "CONDITIONNELLE", label: "Conditionnelle" },
  { code: "FACULTATIVE", label: "Facultative" },
] as const;

export const PIECE_SOURCES = [
  { code: "CLIENT", label: "Client" },
  { code: "CABINET", label: "Cabinet" },
  { code: "ADMINISTRATION", label: "Administration" },
  { code: "ARCHITECTE", label: "Architecte" },
  { code: "GEOMETRE", label: "Géomètre" },
  { code: "NOTAIRE", label: "Notaire" },
  { code: "AUTRE", label: "Autre" },
] as const;

export const PIECE_STATUTS = [
  { code: "NON_DEMANDEE", label: "Non demandée" },
  { code: "DEMANDEE", label: "Demandée" },
  { code: "RECUE", label: "Reçue" },
  { code: "ILLISIBLE", label: "Illisible" },
  { code: "EXPIREE", label: "Expirée" },
  { code: "VALIDEE", label: "Validée" },
  { code: "NON_APPLICABLE", label: "Non applicable" },
  { code: "REJETEE", label: "Rejetée" },
] as const;

/// Une pièce obligatoire est « couverte » quand reçue, validée ou
/// déclarée non applicable — sinon il faut une dérogation motivée.
export const PIECE_STATUTS_COUVRANT = ["RECUE", "VALIDEE", "NON_APPLICABLE"];

/* ------------------------------------------------------------------ */
/* Autres référentiels                                                  */
/* ------------------------------------------------------------------ */

export const DEMARCHE_FAMILLES = [
  { code: "URBANISME", label: "Urbanisme" },
  { code: "CADASTRE", label: "Cadastre" },
  { code: "FISCALITE", label: "Fiscalité" },
  { code: "DOMAINES", label: "Domaines / foncier" },
  { code: "LIVRE_FONCIER", label: "Livre foncier / conservation" },
  { code: "TRANSVERSAL", label: "Transversal" },
] as const;

export const AUTORITE_TYPES = [
  { code: "MAIRIE", label: "Mairie" },
  { code: "CADASTRE", label: "Bureau du Cadastre" },
  { code: "DGID", label: "DGID" },
  { code: "CONSERVATION", label: "Conservation foncière" },
  { code: "CENTRE_FISCAL", label: "Centre des services fiscaux" },
  { code: "TRIBUNAL", label: "Tribunal" },
  { code: "AUTRE", label: "Autre" },
] as const;

export const EVENEMENT_TYPES = [
  { code: "DEPOT", label: "Dépôt" },
  { code: "RELANCE", label: "Relance" },
  { code: "COMPLEMENT", label: "Complément" },
  { code: "DECISION", label: "Décision" },
  { code: "REMISE", label: "Remise au client" },
  { code: "NOTE", label: "Note interne" },
  { code: "CHANGEMENT_STATUT", label: "Changement de statut" },
  { code: "VALIDATION", label: "Validation" },
  { code: "DEMANDE_PIECE_CLIENT", label: "Demande de pièce au client" },
] as const;

export const FRAIS_NATURES = [
  { code: "HONORAIRE", label: "Honoraires" },
  { code: "DEBOURS", label: "Débours" },
  { code: "TAXE", label: "Taxe" },
  { code: "TIMBRE", label: "Timbre fiscal" },
  { code: "AVANCE_CLIENT", label: "Avance du client" },
] as const;

export const PRIORITES = [
  { code: "BASSE", label: "Basse" },
  { code: "NORMALE", label: "Normale" },
  { code: "HAUTE", label: "Haute" },
  { code: "URGENTE", label: "Urgente" },
] as const;

export const ETATS_VERIFICATION_PARCELLE = [
  { code: "DECLARE", label: "Déclaré" },
  { code: "PIECES_RECUES", label: "Pièces reçues" },
  { code: "A_VERIFIER", label: "À vérifier" },
  { code: "VERIFIE", label: "Vérifié" },
  { code: "INCOHERENT", label: "Incohérent" },
] as const;

export const PARTIE_ROLES = [
  { code: "DEMANDEUR", label: "Demandeur" },
  { code: "CO_DEMANDEUR", label: "Co-demandeur" },
  { code: "MANDATAIRE", label: "Mandataire" },
  { code: "BENEFICIAIRE", label: "Bénéficiaire réel" },
] as const;

/* ------------------------------------------------------------------ */
/* Helpers métier                                                       */
/* ------------------------------------------------------------------ */

interface DemarcheLike {
  statut: string;
  sousType: string | null;
  objet: string | null;
  demandeurId: string | null;
  autoriteId: string | null;
  autoriteLibre: string | null;
  parcelleId: string | null;
  derogations?: unknown;
  dateDepot?: Date | null;
  deposePar?: string | null;
  canalDepot?: string | null;
  documentDelivreId?: string | null;
  motifRejet?: string | null;
  decisionDate?: Date | null;
  valideParId?: string | null;
}

interface DemarcheTypeLike {
  qualificationObligatoire: boolean;
  parcelleRequise: boolean;
  validationAvocat: boolean;
}

interface PieceLike {
  id: string;
  libelle: string;
  niveau: string;
  statut: string;
}

/** La qualification préalable est complète : sous-type, autorité,
 *  demandeur et objet renseignés (exigée pour les démarches ambiguës). */
export function qualificationComplete(
  demarche: Pick<DemarcheLike, "sousType" | "objet" | "demandeurId" | "autoriteId" | "autoriteLibre">,
  type: Pick<DemarcheTypeLike, "qualificationObligatoire">
): { complete: boolean; manquants: string[] } {
  const manquants: string[] = [];
  if (!demarche.demandeurId) manquants.push("demandeur");
  if (!demarche.objet?.trim()) manquants.push("objet de la demande");
  if (type.qualificationObligatoire) {
    if (!demarche.sousType?.trim()) manquants.push("sous-type (qualification)");
    if (!demarche.autoriteId && !demarche.autoriteLibre?.trim())
      manquants.push("autorité compétente");
  }
  return { complete: manquants.length === 0, manquants };
}

/** Pièces obligatoires non couvertes et non dérogées. */
export function piecesObligatoiresManquantes(
  pieces: PieceLike[],
  derogations?: unknown
): PieceLike[] {
  const deroges = new Set(
    (Array.isArray(derogations) ? derogations : [])
      .map((d) => (d as { pieceId?: string })?.pieceId)
      .filter(Boolean) as string[]
  );
  return pieces.filter(
    (p) =>
      p.niveau === "OBLIGATOIRE" &&
      !PIECE_STATUTS_COUVRANT.includes(p.statut) &&
      !deroges.has(p.id)
  );
}

export interface TransitionCheck {
  ok: boolean;
  erreurs: string[];
}

/**
 * Vérifie qu'une transition de statut est permise, en appliquant les
 * règles métier du cahier des charges :
 *  - qualification complète avant PRET_A_DEPOT ;
 *  - pièces obligatoires couvertes (ou dérogées) avant PRET_VALIDATION ;
 *  - validation avocat quand le type l'exige ;
 *  - champs de dépôt obligatoires pour DEPOSE ;
 *  - justificatif + motif pour DOCUMENT_DELIVRE / REFUSE ;
 *  - clôture bloquée si débours non rapprochés.
 */
export function assertDemarcheTransition(
  demarche: DemarcheLike & {
    type?: DemarcheTypeLike | null;
    pieces?: PieceLike[];
    fraisNonRapproches?: number;
    originalARestituer?: boolean;
  },
  cible: string
): TransitionCheck {
  const erreurs: string[] = [];
  const autorisees = DEMARCHE_TRANSITIONS[demarche.statut] || [];
  if (!autorisees.includes(cible)) {
    return {
      ok: false,
      erreurs: [
        `Transition ${DEMARCHE_STATUT_LABELS[demarche.statut] || demarche.statut} → ${DEMARCHE_STATUT_LABELS[cible] || cible} non autorisée.`,
      ],
    };
  }

  const type = demarche.type;
  const qualif = type
    ? qualificationComplete(demarche, type)
    : { complete: true, manquants: [] };

  // La qualification doit être complète avant de préparer / déposer.
  if (["PIECES_PARTIELLES", "CONTROLE_INTERNE"].includes(cible) && !qualif.complete) {
    erreurs.push(
      `Qualification incomplète : ${qualif.manquants.join(", ")} — la demande reste « À qualifier ».`
    );
  }

  if (cible === "PRET_VALIDATION") {
    const manquantes = piecesObligatoiresManquantes(demarche.pieces || [], demarche.derogations);
    if (manquantes.length) {
      erreurs.push(
        `Pièces obligatoires manquantes : ${manquantes
          .map((p) => p.libelle)
          .join(", ")} — enregistrez-les ou motivez une dérogation.`
      );
    }
  }

  if (cible === "PRET_A_DEPOT") {
    if (type?.parcelleRequise && !demarche.parcelleId) {
      erreurs.push("Une fiche parcelle / bien est requise pour cette démarche.");
    }
    if (type?.validationAvocat && !demarche.valideParId) {
      erreurs.push("Cette démarche exige une validation par un avocat ou fiscaliste avant dépôt.");
    }
  }

  if (cible === "DEPOSE") {
    if (!demarche.dateDepot) erreurs.push("Date de dépôt obligatoire.");
    if (!demarche.deposePar?.trim()) erreurs.push("Déposant obligatoire.");
    if (!demarche.canalDepot?.trim()) erreurs.push("Canal de dépôt obligatoire.");
    if (!demarche.autoriteId && !demarche.autoriteLibre?.trim())
      erreurs.push("Autorité de dépôt obligatoire.");
  }

  if (cible === "DOCUMENT_DELIVRE" && !demarche.documentDelivreId) {
    erreurs.push("Scan du document délivré obligatoire (pièce de la GED).");
  }

  if (cible === "REFUSE") {
    if (!demarche.motifRejet?.trim()) erreurs.push("Motif de refus obligatoire.");
    if (!demarche.decisionDate) erreurs.push("Date de notification de la décision obligatoire.");
  }

  if (cible === "CLOTURE") {
    if ((demarche.fraisNonRapproches ?? 0) > 0) {
      erreurs.push("Des débours ne sont pas rapprochés : la clôture est bloquée.");
    }
    if (demarche.originalARestituer) {
      erreurs.push("Un original doit être restitué avant la clôture.");
    }
  }

  return { ok: erreurs.length === 0, erreurs };
}

/** Référence interne : DEM-AAAA-NNNN par année. */
export function formatDemarcheReference(annee: number, numero: number): string {
  return `DEM-${annee}-${String(numero).padStart(4, "0")}`;
}
