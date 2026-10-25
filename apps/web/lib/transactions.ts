/**
 * Module « Transactions & contrats » (ventes, baux, mandats).
 *
 * Principe central : le cabinet agit comme conseil et intermédiaire — il
 * contrôle les pièces, prépare les avant-contrats et contrats, coordonne
 * le notaire, organise l'enregistrement et archive les preuves. Il n'est
 * jamais partie au contrat (ni vendeur, ni acheteur, ni bailleur, ni
 * locataire) sauf s'il y est réellement partie.
 *
 * Règle juridique codée en dur : une vente d'immeuble sous titre foncier
 * n'est achevée qu'après inscription de l'acquéreur au livre foncier —
 * une simple vente privée ne transfère pas la propriété. La clôture est
 * bloquée tant que la preuve de mutation n'est pas archivée.
 */

/* ------------------------------------------------------------------ */
/* Statuts par workflow                                                 */
/* ------------------------------------------------------------------ */

/// Workflow VENTE_TF — vente d'immeuble sous titre foncier (22 statuts).
export const VENTE_TF_STATUTS = [
  "OUVERTURE_TRANSACTION",
  "A_QUALIFIER_DROIT_SUR_BIEN",
  "MANDAT_CABINET_A_SIGNER",
  "IDENTIFICATION_PARTIES",
  "IDENTIFICATION_BIEN",
  "COLLECTE_PIECES",
  "CONTROLE_CADASTRAL_REQUIS",
  "ETAT_DROITS_REELS_A_OBTENIR",
  "DUE_DILIGENCE_FONCIERE_ADMINISTRATIVE",
  "CHARGES_ET_LITIGES_A_TRAITER",
  "FORMALITE_DOMAINES_A_EVALUER",
  "DOSSIER_NOTARIAL_A_COMPLETER",
  "PROJET_ACTE_A_VALIDER",
  "SIGNATURE_NOTARIALE_PLANIFIEE",
  "ACTE_NOTARIE_SIGNE",
  "DROITS_ET_FORMALITES_EN_COURS",
  "DEPOT_CONSERVATION_EFFECTUE",
  "ENREGISTREMENT_ET_PUBLICITE_EN_COURS",
  "MUTATION_INSCRITE",
  "ETAT_DROITS_REELS_FINAL_RECU",
  "DOSSIER_REMIS_CLIENT",
  "CLOTURE",
] as const;

/// Workflow BAIL — contrat de location (18 statuts).
export const BAIL_STATUTS = [
  "BROUILLON",
  "IDENTIFICATION_BAILLEUR",
  "IDENTIFICATION_LOCATAIRE",
  "IDENTIFICATION_BIEN",
  "CONTROLE_DROIT_DE_LOUER",
  "CONTROLE_DESTINATION_ET_USAGE",
  "VISITE_ET_ETAT_DES_LIEUX_ENTREE",
  "PROJET_BAIL",
  "VALIDATION_JURIDIQUE",
  "SIGNATURE_PARTIES",
  "ENREGISTREMENT_A_EVALUER",
  "FORMALITES_A_SUIVRE",
  "REMISE_CLES",
  "BAIL_EN_COURS",
  "SUIVI_LOYERS_ET_QUITTANCES",
  "RENOUVELLEMENT_OU_RESILIATION",
  "ETAT_DES_LIEUX_SORTIE",
  "SOLDE_ET_RESTITUTION_GARANTIE",
  "CLOTURE",
] as const;

/// Workflow GENERIQUE — promesse, mandat, vente de bien meuble, avenant…
export const GENERIQUE_STATUTS = [
  "BROUILLON",
  "IDENTIFICATION_PARTIES",
  "IDENTIFICATION_OBJET",
  "COLLECTE_PIECES",
  "REDACTION_CONTRAT",
  "VALIDATION_JURIDIQUE",
  "SIGNATURE_PARTIES",
  "FORMALITES_A_SUIVRE",
  "EXECUTION_EN_COURS",
  "DOSSIER_REMIS_CLIENT",
  "CLOTURE",
] as const;

/// États de blocage orthogonaux (toutes familles).
export const BLOCAGE_STATUTS = [
  "BLOQUE_IDENTITE_PARTIE",
  "BLOQUE_CAPACITE_OU_POUVOIR",
  "BLOQUE_TITRE_NON_VERIFIE",
  "BLOQUE_ETAT_DROITS_REELS_ABSENT",
  "BLOQUE_CHARGE_HYPOTHEQUE",
  "BLOQUE_SAISIE_OU_PRENOTATION",
  "BLOQUE_INCOHERENCE_CADASTRALE",
  "BLOQUE_LITIGE_FONCIER",
  "BLOQUE_SITUATION_SUCCESSORALE",
  "BLOQUE_SITUATION_MATRIMONIALE",
  "BLOQUE_DROIT_DOMANIAL_A_REGULARISER",
  "BLOQUE_URBANISME_A_VERIFIER",
  "BLOQUE_FISCALITE_OU_DROITS",
  "BLOQUE_FINANCEMENT",
  "BLOQUE_VALIDATION_AVOCAT",
] as const;

/// Statuts terminaux communs.
export const TERMINAL_STATUTS = ["ANNULEE", "ARCHIVE"] as const;

export const TRANSACTION_STATUTS = [
  ...VENTE_TF_STATUTS,
  ...BAIL_STATUTS,
  ...GENERIQUE_STATUTS,
  ...BLOCAGE_STATUTS,
  ...TERMINAL_STATUTS,
] as const;

export type TransactionStatut = (typeof TRANSACTION_STATUTS)[number];

export const TRANSACTION_STATUT_LABELS: Record<string, string> = {
  // Vente TF
  OUVERTURE_TRANSACTION: "Ouverture de la transaction",
  A_QUALIFIER_DROIT_SUR_BIEN: "Qualification du droit sur le bien",
  MANDAT_CABINET_A_SIGNER: "Mandat du cabinet à signer",
  IDENTIFICATION_PARTIES: "Identification des parties",
  IDENTIFICATION_BIEN: "Identification du bien",
  COLLECTE_PIECES: "Collecte des pièces",
  CONTROLE_CADASTRAL_REQUIS: "Contrôle cadastral requis",
  ETAT_DROITS_REELS_A_OBTENIR: "État des droits réels à obtenir",
  DUE_DILIGENCE_FONCIERE_ADMINISTRATIVE: "Due diligence foncière",
  CHARGES_ET_LITIGES_A_TRAITER: "Charges et litiges à traiter",
  FORMALITE_DOMAINES_A_EVALUER: "Formalité Domaines à évaluer",
  DOSSIER_NOTARIAL_A_COMPLETER: "Dossier notarial à compléter",
  PROJET_ACTE_A_VALIDER: "Projet d'acte à valider",
  SIGNATURE_NOTARIALE_PLANIFIEE: "Signature notariale planifiée",
  ACTE_NOTARIE_SIGNE: "Acte notarié signé",
  DROITS_ET_FORMALITES_EN_COURS: "Droits et formalités en cours",
  DEPOT_CONSERVATION_EFFECTUE: "Dépôt en Conservation effectué",
  ENREGISTREMENT_ET_PUBLICITE_EN_COURS: "Enregistrement / publicité en cours",
  MUTATION_INSCRITE: "Mutation inscrite au livre foncier",
  ETAT_DROITS_REELS_FINAL_RECU: "État des droits réels final reçu",
  DOSSIER_REMIS_CLIENT: "Dossier remis au client",
  CLOTURE: "Clôturée",
  // Bail
  BROUILLON: "Brouillon",
  IDENTIFICATION_BAILLEUR: "Identification du bailleur",
  IDENTIFICATION_LOCATAIRE: "Identification du locataire",
  CONTROLE_DROIT_DE_LOUER: "Contrôle du droit de louer",
  CONTROLE_DESTINATION_ET_USAGE: "Contrôle destination / usage",
  VISITE_ET_ETAT_DES_LIEUX_ENTREE: "Visite / état des lieux d'entrée",
  PROJET_BAIL: "Projet de bail",
  VALIDATION_JURIDIQUE: "Validation juridique",
  SIGNATURE_PARTIES: "Signature des parties",
  ENREGISTREMENT_A_EVALUER: "Enregistrement à évaluer",
  FORMALITES_A_SUIVRE: "Formalités à suivre",
  REMISE_CLES: "Remise des clés",
  BAIL_EN_COURS: "Bail en cours",
  SUIVI_LOYERS_ET_QUITTANCES: "Suivi loyers / quittances",
  RENOUVELLEMENT_OU_RESILIATION: "Renouvellement ou résiliation",
  ETAT_DES_LIEUX_SORTIE: "État des lieux de sortie",
  SOLDE_ET_RESTITUTION_GARANTIE: "Solde / restitution de garantie",
  // Générique
  IDENTIFICATION_OBJET: "Identification de l'objet",
  REDACTION_CONTRAT: "Rédaction du contrat",
  EXECUTION_EN_COURS: "Exécution en cours",
  // Blocages
  BLOQUE_IDENTITE_PARTIE: "Bloqué — identité d'une partie",
  BLOQUE_CAPACITE_OU_POUVOIR: "Bloqué — capacité / pouvoir",
  BLOQUE_TITRE_NON_VERIFIE: "Bloqué — titre non vérifié",
  BLOQUE_ETAT_DROITS_REELS_ABSENT: "Bloqué — état des droits réels absent",
  BLOQUE_CHARGE_HYPOTHEQUE: "Bloqué — charge / hypothèque",
  BLOQUE_SAISIE_OU_PRENOTATION: "Bloqué — saisie / prénotation",
  BLOQUE_INCOHERENCE_CADASTRALE: "Bloqué — incohérence cadastrale",
  BLOQUE_LITIGE_FONCIER: "Bloqué — litige foncier",
  BLOQUE_SITUATION_SUCCESSORALE: "Bloqué — succession",
  BLOQUE_SITUATION_MATRIMONIALE: "Bloqué — situation matrimoniale",
  BLOQUE_DROIT_DOMANIAL_A_REGULARISER: "Bloqué — droit domanial à régulariser",
  BLOQUE_URBANISME_A_VERIFIER: "Bloqué — urbanisme à vérifier",
  BLOQUE_FISCALITE_OU_DROITS: "Bloqué — fiscalité / droits",
  BLOQUE_FINANCEMENT: "Bloqué — financement",
  BLOQUE_VALIDATION_AVOCAT: "Bloqué — validation avocat requise",
  // Terminaux
  ANNULEE: "Annulée",
  ARCHIVE: "Archivée",
};

export const TRANSACTION_STATUT_BADGES: Record<string, string> = {
  OUVERTURE_TRANSACTION: "bg-gray-100 text-gray-700",
  A_QUALIFIER_DROIT_SUR_BIEN: "bg-amber-100 text-amber-800",
  MANDAT_CABINET_A_SIGNER: "bg-amber-100 text-amber-800",
  IDENTIFICATION_PARTIES: "bg-neutral-100 text-neutral-700",
  IDENTIFICATION_BIEN: "bg-neutral-100 text-neutral-700",
  IDENTIFICATION_BAILLEUR: "bg-neutral-100 text-neutral-700",
  IDENTIFICATION_LOCATAIRE: "bg-neutral-100 text-neutral-700",
  IDENTIFICATION_OBJET: "bg-neutral-100 text-neutral-700",
  COLLECTE_PIECES: "bg-yellow-100 text-yellow-800",
  CONTROLE_CADASTRAL_REQUIS: "bg-blue-100 text-blue-700",
  ETAT_DROITS_REELS_A_OBTENIR: "bg-blue-100 text-blue-700",
  DUE_DILIGENCE_FONCIERE_ADMINISTRATIVE: "bg-indigo-100 text-indigo-700",
  CHARGES_ET_LITIGES_A_TRAITER: "bg-orange-100 text-orange-700",
  FORMALITE_DOMAINES_A_EVALUER: "bg-orange-100 text-orange-700",
  DOSSIER_NOTARIAL_A_COMPLETER: "bg-violet-100 text-violet-700",
  PROJET_ACTE_A_VALIDER: "bg-violet-100 text-violet-700",
  CONTROLE_DROIT_DE_LOUER: "bg-blue-100 text-blue-700",
  CONTROLE_DESTINATION_ET_USAGE: "bg-blue-100 text-blue-700",
  VISITE_ET_ETAT_DES_LIEUX_ENTREE: "bg-cyan-100 text-cyan-700",
  PROJET_BAIL: "bg-violet-100 text-violet-700",
  REDACTION_CONTRAT: "bg-violet-100 text-violet-700",
  VALIDATION_JURIDIQUE: "bg-purple-100 text-purple-700",
  SIGNATURE_NOTARIALE_PLANIFIEE: "bg-indigo-100 text-indigo-700",
  SIGNATURE_PARTIES: "bg-indigo-100 text-indigo-700",
  ACTE_NOTARIE_SIGNE: "bg-teal-100 text-teal-700",
  DROITS_ET_FORMALITES_EN_COURS: "bg-sky-100 text-sky-700",
  DEPOT_CONSERVATION_EFFECTUE: "bg-sky-100 text-sky-700",
  ENREGISTREMENT_ET_PUBLICITE_EN_COURS: "bg-sky-100 text-sky-700",
  ENREGISTREMENT_A_EVALUER: "bg-sky-100 text-sky-700",
  FORMALITES_A_SUIVRE: "bg-sky-100 text-sky-700",
  MUTATION_INSCRITE: "bg-emerald-100 text-emerald-700",
  ETAT_DROITS_REELS_FINAL_RECU: "bg-emerald-100 text-emerald-700",
  REMISE_CLES: "bg-teal-100 text-teal-700",
  BAIL_EN_COURS: "bg-green-100 text-green-700",
  SUIVI_LOYERS_ET_QUITTANCES: "bg-green-100 text-green-700",
  RENOUVELLEMENT_OU_RESILIATION: "bg-amber-100 text-amber-800",
  ETAT_DES_LIEUX_SORTIE: "bg-cyan-100 text-cyan-700",
  SOLDE_ET_RESTITUTION_GARANTIE: "bg-amber-100 text-amber-800",
  EXECUTION_EN_COURS: "bg-sky-100 text-sky-700",
  DOSSIER_REMIS_CLIENT: "bg-emerald-100 text-emerald-800",
  CLOTURE: "bg-emerald-100 text-emerald-800",
  ANNULEE: "bg-stone-100 text-stone-700",
  ARCHIVE: "bg-gray-200 text-gray-600",
  // Blocages : tous en rouge
  ...Object.fromEntries(BLOCAGE_STATUTS.map((s) => [s, "bg-red-100 text-red-800"])),
};

/* ------------------------------------------------------------------ */
/* Transitions                                                          */
/* ------------------------------------------------------------------ */

/** Flux principal par workflow. */
const FLOWS: Record<string, string[]> = {
  VENTE_TF: [...VENTE_TF_STATUTS],
  BAIL: [...BAIL_STATUTS],
  GENERIQUE: [...GENERIQUE_STATUTS],
};

/** Statuts « de reprise » vers lesquels on peut débloquer une transaction. */
const RESUME_POINTS: Record<string, string[]> = {
  VENTE_TF: [
    "OUVERTURE_TRANSACTION",
    "IDENTIFICATION_PARTIES",
    "IDENTIFICATION_BIEN",
    "COLLECTE_PIECES",
    "CONTROLE_CADASTRAL_REQUIS",
    "DUE_DILIGENCE_FONCIERE_ADMINISTRATIVE",
    "CHARGES_ET_LITIGES_A_TRAITER",
    "DOSSIER_NOTARIAL_A_COMPLETER",
    "PROJET_ACTE_A_VALIDER",
  ],
  BAIL: [
    "IDENTIFICATION_BAILLEUR",
    "IDENTIFICATION_LOCATAIRE",
    "IDENTIFICATION_BIEN",
    "CONTROLE_DROIT_DE_LOUER",
    "PROJET_BAIL",
    "VALIDATION_JURIDIQUE",
  ],
  GENERIQUE: [
    "IDENTIFICATION_PARTIES",
    "COLLECTE_PIECES",
    "REDACTION_CONTRAT",
    "VALIDATION_JURIDIQUE",
  ],
};

/**
 * Transitions autorisées, par workflow : chaque statut du flux peut
 * avancer à l'étape suivante, revenir à l'étape précédente (correction),
 * passer en blocage ou être annulé ; les blocages reprennent vers les
 * points de contrôle du workflow.
 */
export const TRANSACTION_TRANSITIONS: Record<string, Record<string, string[]>> = Object.fromEntries(
  Object.entries(FLOWS).map(([workflow, flow]) => {
    const map: Record<string, string[]> = {};
    flow.forEach((statut, i) => {
      const cibles: string[] = [];
      if (i < flow.length - 1) cibles.push(flow[i + 1]);
      if (i > 0 && statut !== "CLOTURE") cibles.push(flow[i - 1]);
      if (statut !== "CLOTURE") cibles.push(...BLOCAGE_STATUTS, "ANNULEE");
      else cibles.push("ARCHIVE");
      map[statut] = cibles;
    });
    for (const b of BLOCAGE_STATUTS) {
      map[b] = [...RESUME_POINTS[workflow], "ANNULEE"];
    }
    map["ANNULEE"] = ["ARCHIVE"];
    map["ARCHIVE"] = [];
    return [workflow, map];
  })
) as Record<string, Record<string, string[]>>;

/** Statuts « en attente externe » (notaire, administrations, banque). */
export const STATUTS_ATTENTE_EXTERNE = [
  "CONTROLE_CADASTRAL_REQUIS",
  "ETAT_DROITS_REELS_A_OBTENIR",
  "FORMALITE_DOMAINES_A_EVALUER",
  "DROITS_ET_FORMALITES_EN_COURS",
  "DEPOT_CONSERVATION_EFFECTUE",
  "ENREGISTREMENT_ET_PUBLICITE_EN_COURS",
  "ETAT_DROITS_REELS_FINAL_RECU",
  "ENREGISTREMENT_A_EVALUER",
  "FORMALITES_A_SUIVRE",
];

/* ------------------------------------------------------------------ */
/* Référentiels                                                         */
/* ------------------------------------------------------------------ */

export const TRANSACTION_WORKFLOWS = [
  { code: "VENTE_TF", label: "Vente sous titre foncier" },
  { code: "BAIL", label: "Bail / location" },
  { code: "GENERIQUE", label: "Transaction générique" },
] as const;

export const TRANSACTION_FAMILLES = [
  { code: "VENTE_IMMOBILIER", label: "Vente immobilière" },
  { code: "VENTE_AUTRE", label: "Vente autre" },
  { code: "BAIL", label: "Bail / location" },
  { code: "AVENANT_RESILIATION", label: "Avenant / résiliation" },
  { code: "MANDAT", label: "Mandat" },
  { code: "ETAT_LIEUX", label: "État des lieux" },
  { code: "CONTRAT_TRAVAIL", label: "Contrat de travail" },
  { code: "CONTRAT_SERVICES", label: "Contrat commercial / services" },
  { code: "CONTRAT_SOCIETES", label: "Sociétés (OHADA)" },
  { code: "CONTRAT_OBLIGATIONS", label: "Obligations & actes civils" },
  { code: "CONTRAT_CABINET", label: "Actes du cabinet" },
  { code: "AUTRE", label: "Autre" },
] as const;

/// Catégories de pièces (celles des démarches + actes et contrats).
export const TRX_PIECE_CATEGORIES = [
  { code: "DOCUMENT_INTERNE_CABINET", label: "Document interne cabinet" },
  { code: "DOCUMENT_ADMINISTRATIF_A_OBTENIR", label: "Document administratif à obtenir" },
  { code: "PIECE_CLIENT", label: "Pièce du client" },
  { code: "PIECE_TECHNIQUE", label: "Pièce technique" },
  { code: "PREUVE_DE_DEPOT_ET_SUIVI", label: "Preuve de dépôt / suivi" },
  { code: "ACTE_NOTARIE", label: "Acte notarié" },
  { code: "CONTRAT_SIGNE", label: "Contrat signé" },
] as const;

/// Parties à une transaction — le cabinet n'y figure jamais.
export const TRX_PARTIE_ROLES = [
  { code: "VENDEUR", label: "Vendeur" },
  { code: "ACHETEUR", label: "Acheteur" },
  { code: "BAILLEUR", label: "Bailleur" },
  { code: "LOCATAIRE", label: "Locataire" },
  { code: "GARANT", label: "Garant" },
  { code: "MANDANT", label: "Mandant" },
  { code: "MANDATAIRE", label: "Mandataire" },
  { code: "NOTAIRE", label: "Notaire" },
  { code: "BENEFICIAIRE", label: "Bénéficiaire" },
  { code: "EMPLOYEUR", label: "Employeur" },
  { code: "SALARIE", label: "Salarié" },
  { code: "STAGIAIRE", label: "Stagiaire" },
  { code: "PRESTATAIRE", label: "Prestataire" },
  { code: "DONNEUR_ORDRE", label: "Donneur d'ordre" },
  { code: "APPORTEUR", label: "Apporteur d'affaires" },
  { code: "CEDANT", label: "Cédant" },
  { code: "CESSIONNAIRE", label: "Cessionnaire" },
  { code: "DEBITEUR", label: "Débiteur" },
  { code: "CREANCIER", label: "Créancier" },
  { code: "CAUTION", label: "Caution" },
  { code: "ASSOCIE", label: "Associé" },
  { code: "AUTRE", label: "Autre partie" },
] as const;

/// Entités externes des formalités.
export const FORMALITE_ENTITES = [
  { code: "NOTAIRE", label: "Étude notariale" },
  { code: "DGID_CADASTRE", label: "Bureau du Cadastre" },
  { code: "DGID_DOMAINES", label: "Direction / Bureau des Domaines" },
  { code: "DGID_ENREGISTREMENT", label: "Service de l'Enregistrement" },
  { code: "DGID_CONSERVATION", label: "Conservation foncière" },
  { code: "CSF", label: "Centre des services fiscaux" },
  { code: "DGID_DIGITALE", label: "Téléservices DGID" },
  { code: "MAIRIE", label: "Commune compétente" },
  { code: "URBANISME", label: "Services de l'Urbanisme" },
  { code: "GEOMETRE", label: "Géomètre" },
  { code: "ARCHITECTE", label: "Architecte / maître d'œuvre" },
  { code: "HUISSIER", label: "Huissier de justice" },
  { code: "BANQUE_SEQUESTRE", label: "Banque / séquestre" },
  { code: "ETAT_CIVIL", label: "Centre d'état civil" },
  { code: "RCCM", label: "Registre du commerce" },
  { code: "JUSTICE", label: "Juridiction compétente" },
  { code: "AUTRE", label: "Autre" },
] as const;

/// États d'une formalité externe.
export const FORMALITE_STATUTS = [
  { code: "BROUILLON", label: "Brouillon" },
  { code: "A_PREPARER", label: "À préparer" },
  { code: "PIECES_MANQUANTES", label: "Pièces manquantes" },
  { code: "PRET_A_DEPOT", label: "Prêt à déposer" },
  { code: "DEPOSE", label: "Déposé" },
  { code: "DEPOT_A_CONFIRMER", label: "Dépôt à confirmer" },
  { code: "COMPLEMENT_DEMANDE", label: "Complément demandé" },
  { code: "EN_INSTRUCTION", label: "En instruction" },
  { code: "RELANCE", label: "Relance" },
  { code: "ACCEPTE", label: "Accepté" },
  { code: "REFUSE", label: "Refusé" },
  { code: "EXPIRE", label: "Expiré" },
  { code: "CLOTURE", label: "Clôturé" },
] as const;

/// Natures de paiement — règle impérative : les sommes destinées au
/// notaire, à la DGID ou à un professionnel externe ne sont JAMAIS des
/// honoraires du cabinet.
export const PAIEMENT_NATURES = [
  { code: "PRIX_DE_VENTE", label: "Prix de vente", cabinet: false },
  { code: "DEPOT_GARANTIE", label: "Dépôt de garantie", cabinet: false },
  { code: "LOYER", label: "Loyer", cabinet: false },
  { code: "AVANCE_LOYER", label: "Avance de loyer", cabinet: false },
  { code: "FRAIS_NOTAIRE", label: "Frais de notaire", cabinet: false },
  { code: "DROITS_ENREGISTREMENT", label: "Droits d'enregistrement", cabinet: false },
  { code: "DROITS_PUBLICITE_FONCIERE", label: "Droits de publicité foncière", cabinet: false },
  { code: "FRAIS_CADASTRE", label: "Frais de cadastre", cabinet: false },
  { code: "FRAIS_DOMAINES", label: "Frais de domaines", cabinet: false },
  { code: "FRAIS_GEOMETRE", label: "Frais de géomètre", cabinet: false },
  { code: "FRAIS_HUISSIER", label: "Frais d'huissier", cabinet: false },
  { code: "FRAIS_URBANISME", label: "Frais d'urbanisme", cabinet: false },
  { code: "FRAIS_BANCAIRES_OU_SEQUESTRE", label: "Frais bancaires / séquestre", cabinet: false },
  { code: "HONORAIRES_CABINET", label: "Honoraires du cabinet", cabinet: true },
  { code: "DEBOURS_CABINET", label: "Débours du cabinet", cabinet: true },
  { code: "REVERSEMENT_BAILLEUR", label: "Reversement au bailleur", cabinet: false },
  { code: "REMBOURSEMENT_CLIENT", label: "Remboursement client", cabinet: false },
] as const;

/// Natures de paiement qui constituent des recettes propres du cabinet.
export const PAIEMENT_NATURES_CABINET = ["HONORAIRES_CABINET", "DEBOURS_CABINET"];

export const TRX_EVENEMENT_TYPES = [
  { code: "SIGNATURE", label: "Signature" },
  { code: "TRANSMISSION_NOTAIRE", label: "Transmission au notaire" },
  { code: "DEPOT", label: "Dépôt" },
  { code: "RELANCE", label: "Relance" },
  { code: "COMPLEMENT", label: "Complément" },
  { code: "DECISION", label: "Décision" },
  { code: "PAIEMENT", label: "Paiement" },
  { code: "REMISE", label: "Remise au client" },
  { code: "BLOCAGE", label: "Blocage" },
  { code: "DEBLOCAGE", label: "Déblocage" },
  { code: "NOTE", label: "Note interne" },
  { code: "CHANGEMENT_STATUT", label: "Changement de statut" },
  { code: "VALIDATION", label: "Validation" },
  { code: "DEMANDE_PIECE", label: "Demande de pièce" },
] as const;

export const BIEN_NATURES = [
  { code: "TERRAIN", label: "Terrain" },
  { code: "IMMEUBLE", label: "Immeuble" },
  { code: "APPARTEMENT", label: "Appartement" },
  { code: "STUDIO", label: "Studio" },
  { code: "VILLA", label: "Villa" },
  { code: "LOCAL_COMMERCIAL", label: "Local commercial" },
  { code: "BUREAU", label: "Bureau" },
  { code: "MEUBLE", label: "Bien meuble" },
  { code: "AUTRE", label: "Autre" },
] as const;

export const BIEN_TYPES_DROIT = [
  { code: "titre_foncier", label: "Titre foncier" },
  { code: "bail", label: "Bail" },
  { code: "droit_superficie", label: "Droit de superficie" },
  { code: "permis_occuper", label: "Permis d'occuper" },
  { code: "autorisation_occuper", label: "Autorisation d'occuper" },
  { code: "propriete_coutumiere", label: "Propriété coutumière" },
  { code: "autre", label: "Autre" },
] as const;

/** Clause d'intervention du cabinet insérée dans tous les contrats
 *  générés (§5.7 de la spécification). */
export const CLAUSE_INTERVENTION_CABINET = `INTERVENTION DU CABINET

Le Cabinet {{cabinet_nom|Nom du cabinet}} intervient exclusivement en qualité de conseil,
d'assistant juridique et d'intermédiaire, dans les limites du mandat qui lui a été
confié. Il assure notamment la collecte et le contrôle documentaire, la préparation
des projets d'actes, la coordination avec les parties, le notaire, les administrations
et les professionnels concernés, ainsi que le suivi des formalités.

Le Cabinet n'est ni vendeur, ni acquéreur, ni bailleur, ni locataire, ni autorité
délivrant des documents administratifs. Il ne garantit ni la solvabilité d'une partie,
ni la délivrance d'un acte administratif, ni l'aboutissement d'une mutation ou d'une
formalité hors de son contrôle.`;

/* ------------------------------------------------------------------ */
/* Helpers métier                                                       */
/* ------------------------------------------------------------------ */

interface TransactionLike {
  statut: string;
  sousType: string | null;
  objet: string | null;
  dossierId: string;
  notaireNom: string | null;
  mandatSigne: boolean;
  etatDroitsReelsObtenu: boolean;
  depotConservationLe: Date | null;
  mutationInscrite: boolean;
  mutationInscriteLe: Date | null;
  documentMutationId: string | null;
  droitDeLouerVerifie: boolean;
  etatLieuxEntreeFait: boolean;
  acteSigneLe: Date | null;
  documentActeId: string | null;
  remisAuClientLe: Date | null;
  prix: number | null;
  loyer: number | null;
  dateEffet: Date | null;
  derogations?: unknown;
  valideParId?: string | null;
  blocageMotif?: string | null;
}

interface TransactionTypeLike {
  workflow: string;
  bienRequis: boolean;
  notaireObligatoire: boolean;
  mutationFonciere: boolean;
  qualificationObligatoire: boolean;
  validationAvocat: boolean;
}

interface PartieLike {
  role: string;
}

interface PieceLike {
  id: string;
  libelle: string;
  niveau: string;
  statut: string;
}

interface BienLike {
  id: string;
}

const PIECE_STATUTS_COUVRANT = ["RECUE", "VALIDEE", "NON_APPLICABLE"];

export interface TransitionCheck {
  ok: boolean;
  erreurs: string[];
}

function workflowOf(type?: TransactionTypeLike | null): string {
  return type?.workflow && TRANSACTION_TRANSITIONS[type.workflow] ? type.workflow : "GENERIQUE";
}

/** Pièces obligatoires non couvertes et non dérogées. */
export function piecesObligatoiresManquantesTrx(
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

/** Rôles de parties indispensables selon le workflow. */
function rolesRequis(workflow: string): string[][] {
  if (workflow === "VENTE_TF") return [["VENDEUR", "ACHETEUR"]];
  if (workflow === "BAIL") return [["BAILLEUR", "LOCATAIRE"]];
  return [];
}

/**
 * Vérifie qu'une transition de statut est permise, en appliquant les
 * règles métier de la spécification :
 *  - blocages exigent un motif documenté ;
 *  - parties et bien identifiés avant la préparation ;
 *  - mandat du cabinet signé avant collecte (vente TF) ;
 *  - pièces obligatoires couvertes (ou dérogées) avant la validation ;
 *  - notaire territorialement compétent identifié quand requis ;
 *  - validation avocat quand le type l'exige ;
 *  - vente TF : dépôt en Conservation, mutation inscrite au livre
 *    foncier et état de droits réels final prouvés avant clôture —
 *    une vente privée seule ne clôture jamais la transaction ;
 *  - bail : droit de louer vérifié, clauses financières présentes,
 *    état des lieux et signature avant « bail en cours » ;
 *  - clôture bloquée si paiements / débours non rapprochés.
 */
export function assertTransactionTransition(
  transaction: TransactionLike & {
    type?: TransactionTypeLike | null;
    parties?: PartieLike[];
    pieces?: PieceLike[];
    biens?: BienLike[];
    paiementsNonRapproches?: number;
  },
  cible: string,
  opts?: { motifBlocage?: string }
): TransitionCheck {
  const erreurs: string[] = [];
  const workflow = workflowOf(transaction.type);
  const transitions = TRANSACTION_TRANSITIONS[workflow];
  const autorisees = transitions[transaction.statut] || [];
  const label = (s: string) => TRANSACTION_STATUT_LABELS[s] || s;

  if (!autorisees.includes(cible)) {
    return {
      ok: false,
      erreurs: [`Transition ${label(transaction.statut)} → ${label(cible)} non autorisée.`],
    };
  }

  // Passage en blocage : motif obligatoire.
  if ((BLOCAGE_STATUTS as readonly string[]).includes(cible)) {
    const motif = opts?.motifBlocage ?? transaction.blocageMotif;
    if (!motif?.trim()) {
      erreurs.push("Un motif documenté est obligatoire pour bloquer la transaction.");
    }
    return { ok: erreurs.length === 0, erreurs };
  }

  const type = transaction.type;
  const parties = transaction.parties || [];
  const pieces = transaction.pieces || [];
  const biens = transaction.biens || [];

  const roles = new Set(parties.map((p) => p.role));
  const partiesOk = () => {
    const manquants: string[] = [];
    for (const groupe of rolesRequis(workflow)) {
      const absents = groupe.filter((r) => !roles.has(r));
      for (const r of absents) {
        const lbl = TRX_PARTIE_ROLES.find((x) => x.code === r)?.label || r;
        manquants.push(lbl);
      }
    }
    return manquants;
  };

  /* ---------------- Workflow VENTE_TF ---------------- */

  if (workflow === "VENTE_TF") {
    if (cible === "MANDAT_CABINET_A_SIGNER" && type?.qualificationObligatoire && !transaction.sousType?.trim()) {
      erreurs.push("Qualification du droit sur le bien incomplète (sous-type requis).");
    }
    if (cible === "IDENTIFICATION_PARTIES" && !transaction.mandatSigne) {
      erreurs.push("Le mandat d'assistance et d'intermédiation du cabinet doit être signé et archivé.");
    }
    if (cible === "COLLECTE_PIECES") {
      const absents = partiesOk();
      if (absents.length) erreurs.push(`Parties à identifier : ${absents.join(", ")}.`);
      if (type?.bienRequis && !biens.length) erreurs.push("Aucun bien rattaché à la transaction.");
    }
    if (cible === "DOSSIER_NOTARIAL_A_COMPLETER") {
      const manquantes = piecesObligatoiresManquantesTrx(pieces, transaction.derogations);
      if (manquantes.length) {
        erreurs.push(
          `Pièces obligatoires manquantes : ${manquantes.map((p) => p.libelle).join(", ")} — enregistrez-les ou motivez une dérogation.`
        );
      }
      if (!transaction.etatDroitsReelsObtenu) {
        erreurs.push("L'état des droits réels (Conservation foncière) doit être obtenu avant de compléter le dossier notarial.");
      }
    }
    if (cible === "SIGNATURE_NOTARIALE_PLANIFIEE") {
      if (!transaction.notaireNom?.trim()) {
        erreurs.push("Un notaire territorialement compétent doit être identifié.");
      }
      if (type?.validationAvocat && !transaction.valideParId) {
        erreurs.push("Le projet d'acte exige une validation par un avocat.");
      }
    }
    if (cible === "ACTE_NOTARIE_SIGNE") {
      if (!transaction.acteSigneLe) erreurs.push("Date de signature de l'acte notarié obligatoire.");
      if (!transaction.documentActeId) erreurs.push("Copie de l'acte notarié signé à archiver dans la GED.");
    }
    if (cible === "DEPOT_CONSERVATION_EFFECTUE" && !transaction.depotConservationLe) {
      erreurs.push("Date de dépôt du dossier de mutation à la Conservation foncière obligatoire.");
    }
    if (cible === "MUTATION_INSCRITE") {
      if (!transaction.mutationInscrite || !transaction.mutationInscriteLe) {
        erreurs.push(
          "La mutation doit être confirmée : inscription de l'acquéreur au livre foncier (date + preuve)."
        );
      }
      if (!transaction.documentMutationId) {
        erreurs.push("Preuve d'inscription de la mutation au livre foncier à archiver dans la GED.");
      }
    }
    if (cible === "CLOTURE") {
      if (type?.mutationFonciere && !transaction.mutationInscrite) {
        erreurs.push(
          "Mutation non achevée : une vente privée ne transfère pas la propriété. L'inscription de l'acquéreur au livre foncier est exigée."
        );
      }
      if (type?.mutationFonciere && !transaction.documentMutationId) {
        erreurs.push("État de droits réels final / preuve d'inscription à archiver avant clôture.");
      }
      if (!transaction.remisAuClientLe) {
        erreurs.push("Le dossier final doit être remis au client (avec accusé) avant la clôture.");
      }
      if ((transaction.paiementsNonRapproches ?? 0) > 0) {
        erreurs.push("Des paiements / débours ne sont pas rapprochés : la clôture est bloquée.");
      }
    }
  }

  /* ---------------- Workflow BAIL ---------------- */

  if (workflow === "BAIL") {
    if (cible === "IDENTIFICATION_LOCATAIRE") {
      const absents = partiesOk().filter((r) => r === "Bailleur");
      if (absents.length) erreurs.push("Le bailleur doit être identifié.");
    }
    if (cible === "IDENTIFICATION_BIEN") {
      const absents = partiesOk().filter((r) => r === "Locataire");
      if (absents.length) erreurs.push("Le locataire doit être identifié.");
    }
    if (cible === "CONTROLE_DROIT_DE_LOUER") {
      if (type?.bienRequis && !biens.length) {
        erreurs.push("Le bien loué doit être identifié sans ambiguïté (fiche bien rattachée).");
      }
    }
    if (cible === "CONTROLE_DESTINATION_ET_USAGE" && !transaction.droitDeLouerVerifie) {
      erreurs.push(
        "Le droit de louer du bailleur (propriété, bail, mandat de gestion) doit être vérifié et coché."
      );
    }
    if (cible === "PROJET_BAIL") {
      const manquantes = piecesObligatoiresManquantesTrx(pieces, transaction.derogations);
      if (manquantes.length) {
        erreurs.push(
          `Pièces obligatoires manquantes : ${manquantes.map((p) => p.libelle).join(", ")}.`
        );
      }
      if (!transaction.loyer) erreurs.push("Le loyer doit être renseigné.");
      if (!transaction.dateEffet) erreurs.push("La date de prise d'effet du bail est requise.");
    }
    if (cible === "SIGNATURE_PARTIES" && type?.validationAvocat && !transaction.valideParId) {
      erreurs.push("Le projet de bail exige une validation juridique par un avocat.");
    }
    if (cible === "FORMALITES_A_SUIVRE") {
      if (!transaction.acteSigneLe) erreurs.push("Date de signature du bail obligatoire.");
      if (!transaction.documentActeId) erreurs.push("Contrat de bail signé à archiver dans la GED.");
    }
    if (cible === "BAIL_EN_COURS" && type?.bienRequis && !transaction.etatLieuxEntreeFait) {
      erreurs.push("L'état des lieux d'entrée doit être réalisé (ou coché « fait ») avant la remise effective.");
    }
    if (cible === "CLOTURE") {
      if ((transaction.paiementsNonRapproches ?? 0) > 0) {
        erreurs.push("Des paiements ne sont pas rapprochés : la clôture est bloquée.");
      }
    }
  }

  /* ---------------- Workflow GENERIQUE ---------------- */

  if (workflow === "GENERIQUE") {
    if (cible === "COLLECTE_PIECES") {
      const absents = partiesOk();
      if (absents.length) erreurs.push(`Parties à identifier : ${absents.join(", ")}.`);
    }
    if (cible === "VALIDATION_JURIDIQUE") {
      const manquantes = piecesObligatoiresManquantesTrx(pieces, transaction.derogations);
      if (manquantes.length) {
        erreurs.push(
          `Pièces obligatoires manquantes : ${manquantes.map((p) => p.libelle).join(", ")}.`
        );
      }
    }
    if (cible === "SIGNATURE_PARTIES" && type?.validationAvocat && !transaction.valideParId) {
      erreurs.push("Le contrat exige une validation juridique avant signature.");
    }
    if (cible === "EXECUTION_EN_COURS") {
      if (!transaction.acteSigneLe) erreurs.push("Date de signature obligatoire.");
    }
    if (cible === "CLOTURE" && (transaction.paiementsNonRapproches ?? 0) > 0) {
      erreurs.push("Des paiements ne sont pas rapprochés : la clôture est bloquée.");
    }
  }

  return { ok: erreurs.length === 0, erreurs };
}

/** Référence interne : TRX-AAAA-NNNN par année. */
export function formatTransactionReference(annee: number, numero: number): string {
  return `TRX-${annee}-${String(numero).padStart(4, "0")}`;
}

/* ===================== Bail / gestion locative ===================== */

export const CHARGES_MODES = [
  { code: "FIXE", label: "Montant fixe" },
  { code: "POURCENTAGE", label: "% du loyer" },
  { code: "INCLUSES", label: "Incluses dans le loyer" },
] as const;

export const MODES_PAIEMENT = [
  { code: "VIREMENT", label: "Virement" },
  { code: "ESPECES", label: "Espèces" },
  { code: "CHEQUE", label: "Chèque" },
  { code: "PRELEVEMENT", label: "Prélèvement" },
  { code: "MOBILE_MONEY", label: "Mobile money" },
] as const;

export const TYPES_MANDAT = [
  { code: "GESTION", label: "Mandat de gestion", description: "Gestion complète des biens" },
  { code: "LOCATION", label: "Mandat de location", description: "Recherche de locataire uniquement" },
  { code: "SIMPLE", label: "Mandat simple", description: "Mandat non exclusif" },
  { code: "EXCLUSIF", label: "Mandat exclusif", description: "Exclusivité confiée au cabinet" },
  { code: "AUTRE", label: "Autre", description: "Type personnalisé" },
] as const;

export const COMMISSION_TYPES = [
  { code: "POURCENTAGE", label: "Pourcentage (%)" },
  { code: "FIXE", label: "Montant fixe (FCFA)" },
] as const;

/// Clauses standard cliquables — baux (inspirées de GESTIMMO).
export const CLAUSES_STANDARD_BAIL = [
  "Animaux domestiques interdits",
  "Sous-location interdite",
  "Fumeur interdit dans le logement",
  "Entretien des parties communes à la charge du locataire",
  "Révision annuelle du loyer selon l'indice de référence",
  "Remise des clés sous 30 jours en cas de résiliation",
  "Le locataire ne peut faire de travaux sans l'accord écrit du bailleur",
  "Le bail est conclu pour usage d'habitation exclusivement",
] as const;

/// Clauses standard cliquables — ventes (inspirées de GESTIMMO).
export const CLAUSES_STANDARD_VENTE = [
  "Le vendeur certifie être le propriétaire légitime du bien vendu.",
  "L'acheteur a visité le bien et en a pris connaissance.",
  "Les frais d'acte et de formalités sont à la charge de l'acheteur.",
  "La vente est conclue sous réserve de la vérification du titre foncier.",
  "En cas de désistement, l'indemnité d'immobilisation est due au vendeur.",
] as const;

export const ETAT_LIEUX_OBJETS = [
  "Porte", "Fenêtre", "Mur", "Plafond", "Sol", "Prise", "Interrupteur",
  "Robinet", "Lavabo", "WC", "Douche", "Baignoire", "Meuble",
  "Climatiseur", "Plaque de cuisson", "Four", "Évier", "Serrure", "Autre",
] as const;

export const ETAT_LIEUX_EMPLACEMENTS = [
  "Salon 1 RDC", "Salon 2 Étage", "Chambre 1", "Chambre 2", "Chambre 3",
  "Chambre 4", "Chambre 5", "Cuisine", "Salle de bains", "WC", "Entrée",
  "Couloir", "Balcon", "Terrasse", "Cave", "Garage",
] as const;

export const ETAT_LIEUX_TYPES = [
  { code: "MOBILIER", label: "Mobilier" },
  { code: "SANITAIRE", label: "Sanitaire" },
  { code: "ELECTRIQUE", label: "Électrique" },
  { code: "MENUISERIE", label: "Menuiserie" },
  { code: "PEINTURE", label: "Peinture" },
  { code: "SOL", label: "Sol" },
  { code: "EQUIPEMENT", label: "Équipement" },
  { code: "ACCESSOIRE", label: "Accessoire" },
] as const;

export const ETAT_LIEUX_ETATS = [
  { code: "NEUF", label: "Neuf" },
  { code: "BON", label: "Bon" },
  { code: "MOYEN", label: "Moyen" },
  { code: "USE", label: "Usé" },
  { code: "DEGRADE", label: "Dégradé" },
  { code: "CASSE", label: "Cassé" },
] as const;

export const ECHEANCE_STATUTS_LABELS: Record<string, string> = {
  A_PERCEVOIR: "À percevoir",
  PARTIEL: "Partiel",
  PAYE: "Payé",
  EN_RETARD: "En retard",
  ANNULE: "Annulé",
};

/* ---------------- Échéancier de bail ---------------- */

interface EcheanceGeneree {
  nature: "LOYER" | "CHARGES" | "REVERSEMENT_BAILLEUR";
  periode: Date;
  jourEcheance: number | null;
  montantDu: number;
  beneficiaire: string | null;
}

/// Commission mensuelle prélevée par le cabinet sur les loyers encaissés
/// (mandat de gestion / bail avec commission).
export function commissionMensuelle(transaction: {
  loyer?: number | null;
  chargesMensuelles?: number | null;
  chargesIncluses?: boolean | null;
  commissionType?: string | null;
  commissionValeur?: number | null;
}): number {
  if (!transaction.commissionType || !transaction.commissionValeur) return 0;
  const loyer = transaction.loyer ?? 0;
  const charges = transaction.chargesIncluses ? 0 : (transaction.chargesMensuelles ?? 0);
  const base = loyer + charges;
  if (transaction.commissionType === "FIXE") return Math.round(transaction.commissionValeur);
  return Math.round((base * transaction.commissionValeur) / 100);
}

/// Calcule l'échéancier complet d'un bail : loyer + charges + reversement
/// bailleur net de commission. `dateEffet` = premier mois ; `dureeMois`
/// nombre de mensualités (défaut 12 si absent).
export function genererEcheancierBail(transaction: {
  loyer?: number | null;
  chargesMensuelles?: number | null;
  chargesIncluses?: boolean | null;
  commissionType?: string | null;
  commissionValeur?: number | null;
  jourEcheanceLoyer?: number | null;
  dateEffet?: Date | string | null;
  dureeMois?: number | null;
}, bailleurNom?: string | null): EcheanceGeneree[] {
  const loyer = transaction.loyer ?? 0;
  if (!loyer) return [];
  const charges = transaction.chargesIncluses ? 0 : (transaction.chargesMensuelles ?? 0);
  const duree = transaction.dureeMois && transaction.dureeMois > 0 ? transaction.dureeMois : 12;
  const jour = transaction.jourEcheanceLoyer ?? 5;
  const debut = transaction.dateEffet ? new Date(transaction.dateEffet) : new Date();
  const commission = commissionMensuelle(transaction);
  const netBailleur = loyer + charges - commission;

  const rows: EcheanceGeneree[] = [];
  for (let i = 0; i < duree; i++) {
    const periode = new Date(debut.getFullYear(), debut.getMonth() + i, 1);
    rows.push({ nature: "LOYER", periode, jourEcheance: jour, montantDu: loyer, beneficiaire: null });
    if (charges > 0) {
      rows.push({ nature: "CHARGES", periode, jourEcheance: jour, montantDu: charges, beneficiaire: null });
    }
    if (bailleurNom || commission > 0) {
      rows.push({
        nature: "REVERSEMENT_BAILLEUR",
        periode,
        jourEcheance: jour,
        montantDu: Math.max(0, netBailleur),
        beneficiaire: bailleurNom ?? null,
      });
    }
  }
  return rows;
}
