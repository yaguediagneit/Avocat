/**
 * Module « Parcours procédural » : instances, décisions et voies de
 * recours (appel devant la Cour d'appel, pourvoi devant la Cour suprême,
 * opposition, révision).
 *
 * Principe : un dossier n'a pas un statut figé — c'est un parcours fait
 * de `Procedure` (niveaux de juridiction) reliées par des `Recours`,
 * chacun avec son workflow, ses délais calculés et son journal.
 */

/* ------------------------------------------------------------------ */
/* Référentiels                                                         */
/* ------------------------------------------------------------------ */

/// Matières juridiques — pilotent les délais de recours.
export const MATIERES = [
  { code: "civil", label: "Civile" },
  { code: "commercial", label: "Commerciale" },
  { code: "social", label: "Sociale / travail" },
  { code: "penal", label: "Pénale" },
  { code: "administratif", label: "Administrative" },
  { code: "fiscal", label: "Fiscale" },
] as const;

export const MATIERE_LABELS: Record<string, string> = Object.fromEntries(
  MATIERES.map((m) => [m.code, m.label])
);

export const NIVEAUX_PROCEDURE = [
  { code: "premiere_instance", label: "Première instance" },
  { code: "appel", label: "Appel" },
  { code: "pourvoi", label: "Pourvoi en cassation" },
  { code: "opposition", label: "Opposition" },
  { code: "revision", label: "Révision" },
  { code: "execution", label: "Exécution" },
] as const;

export const NIVEAU_LABELS: Record<string, string> = Object.fromEntries(
  NIVEAUX_PROCEDURE.map((n) => [n.code, n.label])
);

export const TYPES_RECOURS = [
  { code: "appel", label: "Appel" },
  { code: "pourvoi", label: "Pourvoi en cassation" },
  { code: "opposition", label: "Opposition" },
  { code: "revision", label: "Révision" },
  { code: "autre", label: "Autre voie de recours" },
] as const;

export const TYPE_RECOURS_LABELS: Record<string, string> = Object.fromEntries(
  TYPES_RECOURS.map((t) => [t.code, t.label])
);

export const ORIGINES_RECOURS = [
  { code: "client", label: "Client" },
  { code: "partie_adverse", label: "Partie adverse" },
  { code: "ministere_public", label: "Ministère public" },
] as const;

export const ORIGINE_LABELS: Record<string, string> = Object.fromEntries(
  ORIGINES_RECOURS.map((o) => [o.code, o.label])
);

export const TYPES_DECISION = [
  { code: "jugement", label: "Jugement" },
  { code: "ordonnance", label: "Ordonnance" },
  { code: "arret", label: "Arrêt" },
] as const;

export const TYPE_DECISION_LABELS: Record<string, string> = Object.fromEntries(
  TYPES_DECISION.map((t) => [t.code, t.label])
);

export const SENS_DECISION = [
  { code: "favorable", label: "Favorable" },
  { code: "defavorable", label: "Défavorable" },
  { code: "mixte", label: "Mitigée" },
  { code: "neutre", label: "Neutre" },
  { code: "en_attente", label: "En attente" },
] as const;

export const SENS_DECISION_LABELS: Record<string, string> = Object.fromEntries(
  SENS_DECISION.map((s) => [s.code, s.label])
);

export const ISSUES_RECOURS = [
  { code: "confirmatif", label: "Confirmatif" },
  { code: "infirmatif", label: "Infirmatif" },
  { code: "reforme_partiel", label: "Réformé partiellement" },
  { code: "cassation_sans_renvoi", label: "Cassation sans renvoi" },
  { code: "cassation_avec_renvoi", label: "Cassation avec renvoi" },
  { code: "cassation_partielle", label: "Cassation partielle" },
  { code: "rejet", label: "Rejet du recours" },
  { code: "irrecevable", label: "Irrecevabilité" },
  { code: "caduc", label: "Caducité / annulation" },
  { code: "non_lieu", label: "Non-lieu à statuer" },
  { code: "desistement", label: "Désistement" },
] as const;

export const ISSUE_LABELS: Record<string, string> = Object.fromEntries(
  ISSUES_RECOURS.map((i) => [i.code, i.label])
);

/* ------------------------------------------------------------------ */
/* Statuts des procédures (niveaux de juridiction)                      */
/* ------------------------------------------------------------------ */

export const PROCEDURE_STATUTS = [
  "EN_COURS",
  "DELIBERE",
  "DECISION_RENDUE",
  "DECISION_SIGNIFIEE",
  "TRANSMIS_RECOURS",
  "DEFINITIF",
  "ARCHIVE",
] as const;

export const PROCEDURE_STATUT_LABELS: Record<string, string> = {
  EN_COURS: "En cours",
  DELIBERE: "En délibéré",
  DECISION_RENDUE: "Décision rendue",
  DECISION_SIGNIFIEE: "Décision signifiée",
  TRANSMIS_RECOURS: "Transmis au recours",
  DEFINITIF: "Définitif",
  ARCHIVE: "Archivé",
};

export const PROCEDURE_STATUT_BADGES: Record<string, string> = {
  EN_COURS: "bg-sky-100 text-sky-700",
  DELIBERE: "bg-violet-100 text-violet-700",
  DECISION_RENDUE: "bg-amber-100 text-amber-800",
  DECISION_SIGNIFIEE: "bg-orange-100 text-orange-800",
  TRANSMIS_RECOURS: "bg-indigo-100 text-indigo-700",
  DEFINITIF: "bg-emerald-100 text-emerald-700",
  ARCHIVE: "bg-gray-200 text-gray-600",
};

export const PROCEDURE_TRANSITIONS: Record<string, string[]> = {
  EN_COURS: ["DELIBERE", "DECISION_RENDUE", "ARCHIVE"],
  DELIBERE: ["DECISION_RENDUE", "EN_COURS"],
  DECISION_RENDUE: ["DECISION_SIGNIFIEE", "DEFINITIF", "ARCHIVE"],
  DECISION_SIGNIFIEE: ["DEFINITIF", "ARCHIVE"],
  TRANSMIS_RECOURS: ["DEFINITIF", "ARCHIVE"],
  DEFINITIF: ["ARCHIVE"],
  ARCHIVE: [],
};

/* ------------------------------------------------------------------ */
/* Machine à états des recours (appel + pourvoi + autres voies)         */
/* ------------------------------------------------------------------ */

export const RECOURS_STATUTS = [
  "A_ANALYSER",
  "A_PREPARER",
  "EN_VALIDATION_AVOCAT",
  "EN_VALIDATION_CLIENT",
  "A_DEPOSER",
  "A_DECLARER",
  "DEPOSE",
  "DECLARE",
  "A_SIGNIFIER",
  "SIGNIFIE",
  "ENREGISTRE",
  "A_CONSIGNER",
  "CONSIGNE",
  "A_DEPOSER_MEMOIRE",
  "MEMOIRE_DEPOSE",
  "EN_INSTRUCTION",
  "AUDIENCE_PROGRAMMEE",
  "AUDIENCE_TENUE",
  "DELIBERE",
  "JUGE",
  "IRRECEVABLE",
  "EXECUTION_RENOI",
  "ARCHIVE",
] as const;

export type RecoursStatut = (typeof RECOURS_STATUTS)[number];

export const RECOURS_STATUT_LABELS: Record<string, string> = {
  A_ANALYSER: "À analyser",
  A_PREPARER: "À préparer",
  EN_VALIDATION_AVOCAT: "En validation avocat",
  EN_VALIDATION_CLIENT: "En validation client",
  A_DEPOSER: "À déposer",
  A_DECLARER: "À déclarer",
  DEPOSE: "Déposé",
  DECLARE: "Déclaré",
  A_SIGNIFIER: "À signifier",
  SIGNIFIE: "Signifié",
  ENREGISTRE: "Enregistré au greffe",
  A_CONSIGNER: "À consigner",
  CONSIGNE: "Consigné",
  A_DEPOSER_MEMOIRE: "Mémoire à déposer",
  MEMOIRE_DEPOSE: "Mémoire déposé",
  EN_INSTRUCTION: "En instruction",
  AUDIENCE_PROGRAMMEE: "Audience programmée",
  AUDIENCE_TENUE: "Audience tenue",
  DELIBERE: "En délibéré",
  JUGE: "Jugé",
  IRRECEVABLE: "Irrecevable",
  EXECUTION_RENOI: "Exécution / renvoi",
  ARCHIVE: "Archivé",
};

export const RECOURS_STATUT_BADGES: Record<string, string> = {
  A_ANALYSER: "bg-gray-100 text-gray-700",
  A_PREPARER: "bg-amber-100 text-amber-800",
  EN_VALIDATION_AVOCAT: "bg-violet-100 text-violet-700",
  EN_VALIDATION_CLIENT: "bg-purple-100 text-purple-700",
  A_DEPOSER: "bg-orange-100 text-orange-800",
  A_DECLARER: "bg-orange-100 text-orange-800",
  DEPOSE: "bg-cyan-100 text-cyan-800",
  DECLARE: "bg-cyan-100 text-cyan-800",
  A_SIGNIFIER: "bg-amber-100 text-amber-800",
  SIGNIFIE: "bg-teal-100 text-teal-800",
  ENREGISTRE: "bg-sky-100 text-sky-800",
  A_CONSIGNER: "bg-amber-100 text-amber-800",
  CONSIGNE: "bg-teal-100 text-teal-800",
  A_DEPOSER_MEMOIRE: "bg-orange-100 text-orange-800",
  MEMOIRE_DEPOSE: "bg-sky-100 text-sky-800",
  EN_INSTRUCTION: "bg-blue-100 text-blue-800",
  AUDIENCE_PROGRAMMEE: "bg-indigo-100 text-indigo-700",
  AUDIENCE_TENUE: "bg-indigo-100 text-indigo-800",
  DELIBERE: "bg-violet-100 text-violet-700",
  JUGE: "bg-emerald-100 text-emerald-700",
  IRRECEVABLE: "bg-red-100 text-red-700",
  EXECUTION_RENOI: "bg-lime-100 text-lime-800",
  ARCHIVE: "bg-gray-200 text-gray-600",
};

/// Statuts où le délai de recours court encore et doit être surveillé.
export const RECOURS_STATUTS_DELAI_ACTIF = [
  "A_ANALYSER",
  "A_PREPARER",
  "EN_VALIDATION_AVOCAT",
  "EN_VALIDATION_CLIENT",
  "A_DEPOSER",
  "A_DECLARER",
];

/// Statuts terminaux.
export const RECOURS_STATUTS_TERMINAUX = ["JUGE", "IRRECEVABLE", "ARCHIVE"];

/// Transitions autorisées — fusion des workflows d'appel et de cassation
/// (les étapes non pertinentes pour un type de recours sont simplement
/// sautées : un appel n'utilise pas A_CONSIGNER / MEMOIRE).
export const RECOURS_TRANSITIONS: Record<string, string[]> = {
  A_ANALYSER: ["A_PREPARER", "ARCHIVE"],
  A_PREPARER: ["EN_VALIDATION_AVOCAT", "ARCHIVE"],
  EN_VALIDATION_AVOCAT: ["EN_VALIDATION_CLIENT", "A_DEPOSER", "A_DECLARER", "A_PREPARER"],
  EN_VALIDATION_CLIENT: ["A_DEPOSER", "A_DECLARER", "A_PREPARER"],
  A_DEPOSER: ["DEPOSE", "A_PREPARER"],
  A_DECLARER: ["DECLARE", "A_PREPARER"],
  DEPOSE: ["SIGNIFIE", "ENREGISTRE"],
  DECLARE: ["A_SIGNIFIER", "SIGNIFIE", "ENREGISTRE"],
  A_SIGNIFIER: ["SIGNIFIE"],
  SIGNIFIE: ["A_CONSIGNER", "A_DEPOSER_MEMOIRE", "ENREGISTRE", "EN_INSTRUCTION"],
  ENREGISTRE: ["A_DEPOSER_MEMOIRE", "EN_INSTRUCTION", "AUDIENCE_PROGRAMMEE"],
  A_CONSIGNER: ["CONSIGNE", "IRRECEVABLE"],
  CONSIGNE: ["A_DEPOSER_MEMOIRE"],
  A_DEPOSER_MEMOIRE: ["MEMOIRE_DEPOSE"],
  MEMOIRE_DEPOSE: ["EN_INSTRUCTION"],
  EN_INSTRUCTION: ["AUDIENCE_PROGRAMMEE", "DELIBERE", "IRRECEVABLE"],
  AUDIENCE_PROGRAMMEE: ["AUDIENCE_TENUE", "EN_INSTRUCTION"],
  AUDIENCE_TENUE: ["DELIBERE"],
  DELIBERE: ["JUGE", "AUDIENCE_PROGRAMMEE"],
  JUGE: ["EXECUTION_RENOI", "ARCHIVE"],
  IRRECEVABLE: ["ARCHIVE"],
  EXECUTION_RENOI: ["ARCHIVE"],
  ARCHIVE: [],
};

/* ------------------------------------------------------------------ */
/* Délais de recours (droit sénégalais — valeurs par défaut             */
/* surchargeables par dossier / par recours)                            */
/* ------------------------------------------------------------------ */

/// Appel : délai usuel de 15 jours (à paramétrer selon le texte et la
/// matière — le code de procédure civile prévoit aussi 1 ou 2 mois).
export const DELAI_APPEL_DEFAUT_JOURS = 15;

/// Pourvoi en cassation selon la matière (Cour suprême) :
/// pénal 6 jours (prononcé contradictoire / signification si défaut),
/// social 15 jours, civil & commercial 2 mois à compter de la
/// signification, les autres matières restent à paramétrer.
export const DELAIS_POURVOI_JOURS: Record<string, number> = {
  penal: 6,
  social: 15,
  civil: 60,
  commercial: 60,
};

/// Opposition : délai usuel d'un mois (paramétrable).
export const DELAI_OPPOSITION_DEFAUT_JOURS = 30;

/// Durée du délai en jours pour un type de recours et une matière.
/// `null` = non déterminable automatiquement → saisie manuelle.
export function delaiRecoursJours(
  matiere: string | null | undefined,
  typeRecours: string
): number | null {
  switch (typeRecours) {
    case "appel":
      return DELAI_APPEL_DEFAUT_JOURS;
    case "opposition":
      return DELAI_OPPOSITION_DEFAUT_JOURS;
    case "pourvoi":
    case "revision":
      return matiere ? (DELAIS_POURVOI_JOURS[matiere] ?? null) : null;
    default:
      return null;
  }
}

interface ProcedureDatesLike {
  datePrononce?: Date | null;
  dateSignification?: Date | null;
}

/**
 * Point de départ du délai de recours.
 *  - pourvoi pénal : prononcé (décision contradictoire) — la signification
 *    ne sert que si la décision est par défaut, choix laissé à l'utilisateur ;
 *  - sinon : signification si connue, à défaut prononcé.
 * Le point de départ reste surchargeable sur le recours.
 */
export function pointDepartAuto(
  procedure: ProcedureDatesLike,
  typeRecours: string,
  matiere?: string | null
): { pointDepart: string | null; dateReference: Date | null } {
  const { datePrononce, dateSignification } = procedure;
  if ((typeRecours === "pourvoi" || typeRecours === "revision") && matiere === "penal") {
    if (datePrononce) return { pointDepart: "prononce", dateReference: datePrononce };
    if (dateSignification) return { pointDepart: "signification", dateReference: dateSignification };
    return { pointDepart: null, dateReference: null };
  }
  if (dateSignification) return { pointDepart: "signification", dateReference: dateSignification };
  if (datePrononce) return { pointDepart: "prononce", dateReference: datePrononce };
  return { pointDepart: null, dateReference: null };
}

/// dateReference + delaiJours → date limite (fin de journée).
export function computeDateLimite(dateReference: Date, delaiJours: number): Date {
  const limite = new Date(dateReference);
  limite.setDate(limite.getDate() + delaiJours);
  limite.setHours(23, 59, 59, 999);
  return limite;
}

/// Niveau de la procédure créée devant la juridiction du recours.
export function niveauForRecours(typeRecours: string): string {
  if (typeRecours === "pourvoi") return "pourvoi";
  if (typeRecours === "opposition") return "opposition";
  if (typeRecours === "revision") return "revision";
  return "appel";
}

/// Jours restants avant une date limite (négatif = dépassée).
export function joursRestants(dateLimite: Date, maintenant = new Date()): number {
  return Math.ceil((dateLimite.getTime() - maintenant.getTime()) / 86400000);
}

/* ------------------------------------------------------------------ */
/* Contrôle des transitions                                             */
/* ------------------------------------------------------------------ */

interface RecoursLike {
  statut: string;
  typeRecours: string;
  dateDeclaration?: Date | null;
  dateSignification?: Date | null;
  dateConsignation?: Date | null;
  dateMemoire?: Date | null;
  issue?: string | null;
}

export interface TransitionCheck {
  ok: boolean;
  erreurs: string[];
}

/**
 * Vérifie qu'une transition de recours est permise et que les actes de
 * forme exigés sont renseignés :
 *  - DEPOSE / DECLARE : date de dépôt/déclaration ;
 *  - SIGNIFIE : date de signification ;
 *  - CONSIGNE : date de consignation ;
 *  - MEMOIRE_DEPOSE : date de dépôt du mémoire ;
 *  - JUGE : issue de la décision.
 */
export function assertRecoursTransition(recours: RecoursLike, cible: string): TransitionCheck {
  const erreurs: string[] = [];
  const autorisees = RECOURS_TRANSITIONS[recours.statut] || [];
  if (!autorisees.includes(cible)) {
    return {
      ok: false,
      erreurs: [
        `Transition ${RECOURS_STATUT_LABELS[recours.statut] || recours.statut} → ${RECOURS_STATUT_LABELS[cible] || cible} non autorisée.`,
      ],
    };
  }

  if (["DEPOSE", "DECLARE"].includes(cible) && !recours.dateDeclaration) {
    erreurs.push("Date de déclaration / dépôt obligatoire.");
  }
  if (cible === "SIGNIFIE" && !recours.dateSignification) {
    erreurs.push("Date de signification du recours obligatoire.");
  }
  if (cible === "CONSIGNE" && !recours.dateConsignation) {
    erreurs.push("Date de consignation obligatoire (récépissé à archiver).");
  }
  if (cible === "MEMOIRE_DEPOSE" && !recours.dateMemoire) {
    erreurs.push("Date de dépôt du mémoire obligatoire.");
  }
  if (cible === "JUGE" && !recours.issue) {
    erreurs.push("Saisissez l'issue de la décision (confirmatif, cassation, rejet…).");
  }

  return { ok: erreurs.length === 0, erreurs };
}

/// Transitions autorisées pour une procédure.
export function assertProcedureTransition(statut: string, cible: string): TransitionCheck {
  const autorisees = PROCEDURE_TRANSITIONS[statut] || [];
  if (!autorisees.includes(cible)) {
    return {
      ok: false,
      erreurs: [
        `Transition ${PROCEDURE_STATUT_LABELS[statut] || statut} → ${PROCEDURE_STATUT_LABELS[cible] || cible} non autorisée.`,
      ],
    };
  }
  return { ok: true, erreurs: [] };
}
