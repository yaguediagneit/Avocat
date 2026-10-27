/**
 * Seed « Contrats & actes » — cabinet multidisciplinaire (Sénégal).
 *
 * Étend le catalogue du module « Transactions & contrats » avec les
 * types de contrats hors immobilier que le cabinet établit pour ses
 * clients : travail (Code du travail n° 97-17), services / commercial
 * (CCO), sociétés (AUSCGIE / AUPSRVE), obligations civiles (CCO) et
 * actes propres au cabinet (convention d'honoraires, lettre de mission).
 *
 * Workflow : GENERIQUE (rédaction → validation juridique → signature →
 * formalités → exécution → clôture). Chaque type emporte sa check-list
 * de pièces et un modèle de document TPL_* à variables {{cle|Libellé}}.
 *
 * Idempotent : upsert par code, n'écrase pas le paramétrage existant.
 *
 * Usage : node scripts/seed-contrats.js [--dry-run] [--tenant=<slug>]
 */
try {
  process.loadEnvFile(".env");
} catch {
  // Pas de fichier .env en production (variables injectées par le conteneur).
}
const { PrismaClient: TenantClient } = require("@prisma/client");
const { PrismaClient: PublicClient } = require("../prisma/generated/public");

const DRY_RUN = process.argv.includes("--dry-run");
const TENANT_ARG = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1];

const DIC = "DOCUMENT_INTERNE_CABINET";
const DAO = "DOCUMENT_ADMINISTRATIF_A_OBTENIR";
const PC = "PIECE_CLIENT";
const PT = "PIECE_TECHNIQUE";
const PDS = "PREUVE_DE_DEPOT_ET_SUIVI";
const CS = "CONTRAT_SIGNE";

const p = (code, libelle, categorie, extra = {}) => ({ code, libelle, categorie, ...extra });

/* ------------------------------------------------------------------ */
/* Pièces mutualisées                                                  */
/* ------------------------------------------------------------------ */
const P_PROJET = p("projet_contrat", "Projet de contrat rédigé par le cabinet", DIC, { sourceAttendue: "CABINET" });
const P_SIGNE = p("contrat_signe", "Contrat signé par toutes les parties", CS, { sourceAttendue: "CABINET" });
const P_ENREG = p("recepisse_enregistrement", "Récépissé d'enregistrement de l'acte", PDS, { niveau: "CONDITIONNELLE", condition: "Enregistrement requis ou effectué", sourceAttendue: "ADMINISTRATION" });
const pIdentite = (role, libelleRole) =>
  p(`${role.toLowerCase()}_identite`, `Pièce d'identité / documents de ${libelleRole}`, PC, { partieConcernee: role });
const pSociete = (role, libelleRole) =>
  p(`${role.toLowerCase()}_societe`, `Documents personne morale : NINEA, RCCM, statuts, pouvoir de signature`, PC, { niveau: "CONDITIONNELLE", condition: `${libelleRole} personne morale`, partieConcernee: role });

/* ------------------------------------------------------------------ */
/* Catalogue des types + check-lists                                   */
/* ------------------------------------------------------------------ */
const TYPES = [
  /* ---------------- Contrat de travail ---------------- */
  {
    code: "TRAVAIL_CDI",
    libelle: "Contrat de travail à durée indéterminée",
    famille: "CONTRAT_TRAVAIL",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet, dépôt à l'Inspection du travail",
    nbExemplaires: 3,
    avertissement:
      "Préciser la convention collective applicable, la classification et la période d'essai ; un exemplaire du contrat est déposé à l'Inspection du travail territorialement compétente.",
    pieces: [
      pSociete("EMPLOYEUR", "Employeur"),
      pIdentite("SALARIE", "du salarié"),
      p("salarie_diplomes", "CV, diplômes et attestations du salarié", PC, { niveau: "CONDITIONNELLE", condition: "Poste qualifié", partieConcernee: "SALARIE" }),
      p("fiche_poste", "Fiche de poste / description des fonctions", DIC, { sourceAttendue: "CABINET" }),
      P_PROJET,
      P_SIGNE,
      p("depot_inspection", "Preuve de dépôt à l'Inspection du travail", PDS, { sourceAttendue: "ADMINISTRATION" }),
    ],
  },
  {
    code: "TRAVAIL_CDD",
    libelle: "Contrat de travail à durée déterminée",
    famille: "CONTRAT_TRAVAIL",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet, Inspection du travail",
    nbExemplaires: 3,
    validationAvocat: true,
    avertissement:
      "Le CDD est obligatoirement écrit, précise son motif et son terme ; il ne peut excéder deux ans renouvellement compris (Code du travail).",
    pieces: [
      pSociete("EMPLOYEUR", "Employeur"),
      pIdentite("SALARIE", "du salarié"),
      p("motif_cdd", "Justification du recours au CDD (motif et terme)", DIC, { sourceAttendue: "CABINET" }),
      P_PROJET,
      P_SIGNE,
      p("depot_inspection", "Preuve de dépôt à l'Inspection du travail", PDS, { sourceAttendue: "ADMINISTRATION" }),
    ],
  },
  {
    code: "TRAVAIL_AVENANT",
    libelle: "Avenant au contrat de travail",
    famille: "CONTRAT_TRAVAIL",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet",
    avertissement:
      "Les éléments essentiels du contrat (salaire, qualification, lieu) ne peuvent être modifiés sans l'accord écrit du salarié.",
    pieces: [
      p("contrat_initial", "Contrat de travail initial et avenants antérieurs", PC, { partieConcernee: "EMPLOYEUR" }),
      p("accord_salarie", "Accord écrit du salarié sur la modification", CS, { partieConcernee: "SALARIE" }),
      p("avenant_signe", "Avenant signé par les deux parties", CS, { sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "TRAVAIL_RUPTURE",
    libelle: "Convention de rupture conventionnelle",
    famille: "CONTRAT_TRAVAIL",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet, homologation Inspection du travail",
    validationAvocat: true,
    sensible: true,
    avertissement:
      "La rupture d'un commun accord d'un contrat de travail doit être homologuée par l'Inspecteur du travail pour être opposable ; vérifier l'absence de procédure prud'homale en cours.",
    pieces: [
      p("contrat_travail", "Contrat de travail en cours", PC, { partieConcernee: "EMPLOYEUR" }),
      p("bulletins_paie", "Bulletins de paie récents (calcul des indemnités)", PC, { partieConcernee: "EMPLOYEUR" }),
      p("convention_signee", "Convention de rupture signée par les parties", CS, { sourceAttendue: "CABINET" }),
      p("attestation_homologation", "Attestation d'homologation de l'Inspection du travail", PDS, { sourceAttendue: "ADMINISTRATION" }),
      p("solde_tout_compte", "Solde de tout compte et reçu pour solde", DIC, { sourceAttendue: "CABINET" }),
      p("certificat_travail", "Certificat de travail remis au salarié", DIC, { sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "TRAVAIL_STAGE",
    libelle: "Convention de stage",
    famille: "CONTRAT_TRAVAIL",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet, établissement de formation",
    avertissement:
      "La convention de stage précise l'encadrement, la durée et la gratification ; le stage ne doit pas se substituer à un emploi.",
    pieces: [
      pIdentite("STAGIAIRE", "du stagiaire"),
      p("attestation_etablissement", "Attestation de l'établissement de formation", PC, { niveau: "CONDITIONNELLE", condition: "Stage étudiant", partieConcernee: "STAGIAIRE" }),
      pSociete("EMPLOYEUR", "Structure d'accueil"),
      p("convention_signee", "Convention de stage signée par les trois parties", CS, { sourceAttendue: "CABINET" }),
    ],
  },

  /* ------------- Contrats commerciaux / services ------------- */
  {
    code: "PRESTATION_SERVICES",
    libelle: "Contrat de prestation de services",
    famille: "CONTRAT_SERVICES",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet",
    avertissement:
      "Définir livrables et critères d'acceptation ; éviter tout lien de subordination qui exposerait à une requalification en contrat de travail.",
    pieces: [
      pIdentite("PRESTATAIRE", "du prestataire"),
      pIdentite("DONNEUR_ORDRE", "du donneur d'ordre"),
      pSociete("PRESTATAIRE", "Prestataire"),
      pSociete("DONNEUR_ORDRE", "Donneur d'ordre"),
      p("cahier_charges", "Cahier des charges / description des prestations", PT, { sourceAttendue: "CABINET" }),
      P_PROJET,
      P_SIGNE,
      p("pv_reception", "PV de réception des livrables", PDS, { niveau: "CONDITIONNELLE", condition: "Prestations avec livrables", sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "SOUS_TRAITANCE",
    libelle: "Contrat de sous-traitance",
    famille: "CONTRAT_SERVICES",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet",
    validationAvocat: true,
    avertissement:
      "Vérifier que le contrat principal n'interdit pas la sous-traitance ; le donneur d'ordre peut être tenu solidairement des obligations sociales et fiscales du sous-traitant.",
    pieces: [
      p("contrat_principal", "Contrat principal autorisant la sous-traitance", PC, { partieConcernee: "DONNEUR_ORDRE" }),
      pSociete("PRESTATAIRE", "Sous-traitant"),
      pSociete("DONNEUR_ORDRE", "Donneur d'ordre"),
      p("attestations_regularity", "Attestations fiscales et sociales du sous-traitant", PC, { partieConcernee: "PRESTATAIRE" }),
      P_PROJET,
      P_SIGNE,
    ],
  },
  {
    code: "APPORTEUR_AFFAIRES",
    libelle: "Convention d'apporteur d'affaires",
    famille: "CONTRAT_SERVICES",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet",
    avertissement:
      "Préciser la base et les conditions d'exigibilité de la commission ; l'apporteur n'est ni salarié ni mandataire sans pouvoir écrit.",
    pieces: [
      pIdentite("APPORTEUR", "de l'apporteur"),
      pSociete("DONNEUR_ORDRE", "Donneur d'ordre"),
      pSociete("APPORTEUR", "Apporteur"),
      P_PROJET,
      P_SIGNE,
      p("preuve_apport", "Justificatif des affaires apportées", PDS, { niveau: "CONDITIONNELLE", condition: "Commission due", sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "DISTRIBUTION_COMMERCIALE",
    libelle: "Contrat de distribution / agence commerciale",
    famille: "CONTRAT_SERVICES",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet",
    validationAvocat: true,
    avertissement:
      "Délimiter territoire, exclusivité, objectifs et préavis de rupture ; une rupture brutale d'une relation établie expose à indemnisation.",
    pieces: [
      pSociete("PRESTATAIRE", "Distributeur / agent"),
      pSociete("DONNEUR_ORDRE", "Fournisseur / concédant"),
      p("documents_produits", "Catalogue, tarifs et conditions produits", PC, { partieConcernee: "DONNEUR_ORDRE" }),
      P_PROJET,
      P_SIGNE,
      P_ENREG,
    ],
  },
  {
    code: "NDA_CONFIDENTIALITE",
    libelle: "Accord de confidentialité (NDA)",
    famille: "CONTRAT_SERVICES",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet",
    avertissement:
      "Définir le périmètre des informations, la durée et les personnes autorisées ; si des données personnelles sont échangées, rappeler la loi n° 2008-12.",
    pieces: [
      pIdentite("AUTRE", "de chaque partie"),
      pSociete("AUTRE", "Partie"),
      P_PROJET,
      P_SIGNE,
    ],
  },
  {
    code: "PROTOCOLE_ACCORD",
    libelle: "Lettre d'intention / protocole d'accord",
    famille: "CONTRAT_SERVICES",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet",
    avertissement:
      "Distinguer les clauses contraignantes (exclusivité de négociation, confidentialité, répartition des frais) de la déclaration d'intention.",
    pieces: [
      pIdentite("AUTRE", "de chaque partie"),
      pSociete("AUTRE", "Partie"),
      P_PROJET,
      p("protocole_signe", "Protocole signé par les parties", CS, { sourceAttendue: "CABINET" }),
    ],
  },

  /* ------------------- Sociétés (OHADA) ------------------- */
  {
    code: "CESSION_PARTS",
    libelle: "Cession de parts sociales ou d'actions",
    famille: "CONTRAT_SOCIETES",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet, associés (agrément), Enregistrement, RCCM",
    validationAvocat: true,
    sensible: true,
    enregistrementAEvaluer: true,
    avertissement:
      "SARL : la cession à un tiers exige l'agrément des associés aux 3/4 des parts (AUSCGIE). SA : vérifier les clauses statutaires d'agrément, de préemption ou d'inaliénabilité. Enregistrement puis inscription modificative au RCCM.",
    pieces: [
      p("statuts_societe", "Statuts à jour de la société", PC, { partieConcernee: "CEDANT" }),
      p("registre_mouvements", "Registre des mouvements de titres / état des parts", PC, { partieConcernee: "CEDANT" }),
      p("propriete_titres", "Justification de la titularité des parts cédées", PC, { partieConcernee: "CEDANT" }),
      p("notification_agrement", "Notification du projet de cession à la société", PDS, { niveau: "CONDITIONNELLE", condition: "SARL — cession à un tiers", sourceAttendue: "CABINET" }),
      p("pv_agrement", "PV d'agrément des associés", CS, { niveau: "CONDITIONNELLE", condition: "Agrément statutaire requis", sourceAttendue: "CABINET" }),
      pIdentite("CESSIONNAIRE", "du cessionnaire"),
      P_PROJET,
      P_SIGNE,
      P_ENREG,
      p("rccm_modificatif", "Inscription modificative au RCCM", PDS, { sourceAttendue: "ADMINISTRATION" }),
    ],
  },
  {
    code: "PACTE_ASSOCIES",
    libelle: "Pacte d'associés / convention d'actionnaires",
    famille: "CONTRAT_SOCIETES",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet",
    validationAvocat: true,
    avertissement:
      "Pacte licite entre associés et actionnaires (AUSCGIE art. 2-1). Clauses à équilibrer : inaliénabilité (10 ans maximum), préemption, gouvernance, entrées et sorties.",
    pieces: [
      p("statuts_societe", "Statuts à jour de la société", PC, { partieConcernee: "ASSOCIE" }),
      p("liste_associes", "État des associés et de la répartition du capital", PC, { partieConcernee: "ASSOCIE" }),
      P_PROJET,
      p("pacte_signe", "Pacte signé par les associés parties", CS, { sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "CESSION_FONDS_COMMERCE",
    libelle: "Cession de fonds de commerce",
    famille: "CONTRAT_SOCIETES",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet, JAL, Enregistrement, RCCM",
    validationAvocat: true,
    sensible: true,
    enregistrementAEvaluer: true,
    avertissement:
      "La vente du fonds est publiée dans un journal d'annonces légales ; les créanciers du vendeur disposent d'un délai d'opposition. Enregistrement et inscription modificative au RCCM obligatoires.",
    pieces: [
      p("rccm_fonds", "Extrait RCCM du fonds et titre au fonds du vendeur", PC, { partieConcernee: "CEDANT" }),
      p("etat_elements_fonds", "État des éléments du fonds (clientèle, matériel, bail, stocks)", DIC, { sourceAttendue: "CABINET" }),
      p("bail_local", "Bail du local et accord du bailleur le cas échéant", PC, { niveau: "CONDITIONNELLE", condition: "Local loué", partieConcernee: "CEDANT" }),
      pIdentite("CESSIONNAIRE", "du cessionnaire"),
      P_PROJET,
      P_SIGNE,
      p("publication_jal", "Preuve de publication dans un journal d'annonces légales", PDS, { sourceAttendue: "CABINET" }),
      P_ENREG,
      p("rccm_modificatif", "Inscription modificative / radiation-inscription au RCCM", PDS, { sourceAttendue: "ADMINISTRATION" }),
    ],
  },
  {
    code: "CAUTIONNEMENT",
    libelle: "Acte de cautionnement",
    famille: "CONTRAT_SOCIETES",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet",
    validationAvocat: true,
    avertissement:
      "Sous peine de nullité (AUPSRVE) : la caution appose elle-même la mention de son engagement, en chiffres et en lettres, et précise la dette garantie — vérifier l'étendue (simple ou solidaire, plafonnement, durée).",
    pieces: [
      p("justif_dette", "Titre de la dette garantie (contrat de prêt, bail, marché)", PC, { partieConcernee: "CREANCIER" }),
      pIdentite("CAUTION", "de la caution"),
      p("patrimoine_caution", "Informations sur la solvabilité de la caution", PC, { niveau: "CONDITIONNELLE", condition: "Exigé par le créancier", partieConcernee: "CAUTION" }),
      P_PROJET,
      p("acte_cautionnement", "Acte de cautionnement signé avec mention manuscrite", CS, { sourceAttendue: "CABINET" }),
    ],
  },

  /* ------------- Obligations & actes civils (CCO) ------------- */
  {
    code: "PROCURATION",
    libelle: "Procuration générale ou spéciale",
    famille: "CONTRAT_OBLIGATIONS",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet",
    avertissement:
      "Un acte de disposition (vendre, hypothéquer, transiger) exige un mandat exprès et écrit ; préciser l'étendue, la durée et la révocabilité.",
    pieces: [
      pIdentite("MANDANT", "du mandant"),
      pIdentite("MANDATAIRE", "du mandataire"),
      P_PROJET,
      p("procuration_signee", "Procuration signée par le mandant", CS, { sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "RECONNAISSANCE_DETTE",
    libelle: "Reconnaissance de dette / convention de paiement échelonné",
    famille: "CONTRAT_OBLIGATIONS",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet ; acte authentique si force exécutoire recherchée",
    avertissement:
      "Écrire le montant en chiffres et en lettres, détailler l'échéancier ; pour la force exécutoire immédiate, passer devant notaire.",
    pieces: [
      pIdentite("DEBITEUR", "du débiteur"),
      pIdentite("CREANCIER", "du créancier"),
      p("justif_dette", "Justificatifs de la créance (factures, contrats, comptes)", PC, { partieConcernee: "CREANCIER" }),
      P_PROJET,
      P_SIGNE,
      p("echeancier", "Échéancier de paiement annexé", DIC, { sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "TRANSACTION_AMIABLE",
    libelle: "Protocole transactionnel (règlement amiable)",
    famille: "CONTRAT_OBLIGATIONS",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet",
    validationAvocat: true,
    avertissement:
      "La transaction repose sur des concessions réciproques et a entre les parties l'autorité de la chose jugée ; vérifier les pouvoirs des signataires et l'étendue des renonciations.",
    pieces: [
      pIdentite("AUTRE", "de chaque partie"),
      p("pieces_litige", "Pièces du différend (contrat, correspondances, mise en demeure)", PC, { partieConcernee: "AUTRE" }),
      P_PROJET,
      p("protocole_signe", "Protocole transactionnel signé", CS, { sourceAttendue: "CABINET" }),
      p("preuve_paiement", "Preuve de paiement du prix de la transaction", PDS, { niveau: "CONDITIONNELLE", condition: "Paiement convenu", sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "PRET_PARTICULIERS",
    libelle: "Contrat de prêt entre particuliers",
    famille: "CONTRAT_OBLIGATIONS",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet ; déclaration fiscale le cas échéant",
    avertissement:
      "Montant écrit en chiffres et en lettres, durée, taux d'intérêt dans la limite légale, modalités de remboursement ; prévoir la preuve du versement des fonds.",
    pieces: [
      pIdentite("CREANCIER", "du prêteur"),
      pIdentite("DEBITEUR", "de l'emprunteur"),
      p("preuve_versement", "Preuve de versement des fonds", PDS, { partieConcernee: "CREANCIER" }),
      P_PROJET,
      P_SIGNE,
      p("echeancier", "Échéancier de remboursement", DIC, { sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "CESSION_CREANCE",
    libelle: "Cession de créance",
    famille: "CONTRAT_OBLIGATIONS",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet, signification par huissier au débiteur cédé",
    validationAvocat: true,
    avertissement:
      "La cession n'est opposable au débiteur cédé qu'après signification par huissier ou acceptation par acte authentique ; prévoir la garantie d'existence et le prix de cession.",
    pieces: [
      p("titre_creance", "Titre de la créance cédée", PC, { partieConcernee: "CEDANT" }),
      pIdentite("CEDANT", "du cédant"),
      pIdentite("CESSIONNAIRE", "du cessionnaire"),
      P_PROJET,
      P_SIGNE,
      p("signification_debiteur", "Signification de la cession au débiteur cédé (huissier)", PDS, { sourceAttendue: "ADMINISTRATION" }),
    ],
  },

  /* --------------- Mandats & locations immobilières --------------- */
  {
    code: "MANDAT_GESTION_LOCATIVE",
    libelle: "Mandat de gestion locative",
    famille: "MANDAT",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet, reversements périodiques en cours de mandat",
    avertissement:
      "Le mandataire encaisse les loyers pour le compte du mandant : prévoir la périodicité des reversements, la reddition de comptes et le préavis de résiliation. La rémunération peut être tenue confidentielle dans la version remise aux tiers.",
    pieces: [
      pIdentite("MANDANT", "du mandant (propriétaire)"),
      pSociete("MANDANT", "Mandant"),
      p("droit_mandant", "Titre de propriété ou droit de confier la gestion", PC, { partieConcernee: "MANDANT" }),
      p("liste_biens", "Liste des biens couverts (désignation, localisation, loyer)", DIC, { sourceAttendue: "CABINET" }),
      pSociete("MANDATAIRE", "Mandataire"),
      p("mandat_signe", "Mandat de gestion signé par les parties", CS, { sourceAttendue: "CABINET" }),
      p("releves_reversements", "Reçus de reversements et redditions de comptes", PDS, { niveau: "CONDITIONNELLE", condition: "En cours d'exécution", sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "MANDAT_VENTE_IMMO",
    libelle: "Mandat de vente / recherche d'acquéreur",
    famille: "MANDAT",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet, commission due à la vente",
    avertissement:
      "Préciser si le mandat est simple ou exclusif, le prix net vendeur ou de mise en vente, la commission et la durée ; l'exclusivité emporte pénalité en cas de vente directe par le mandant.",
    pieces: [
      pIdentite("MANDANT", "du mandant (vendeur)"),
      p("droit_mandant", "Titre foncier ou droit de vendre le bien", PC, { partieConcernee: "MANDANT" }),
      p("estimation_bien", "Estimation ou prix de vente convenu", PT, { sourceAttendue: "CABINET" }),
      p("mandat_signe", "Mandat de vente signé", CS, { sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "BAIL_SAISONNIER",
    libelle: "Location meublée de courte durée (saisonnière)",
    famille: "BAIL",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet, état des lieux d'entrée et de sortie",
    bienRequis: true,
    avertissement:
      "Séjour ponctuel sans tacite reconduction : fixer les dates d'arrivée et de départ, le tarif par nuit, la caution restituée après état des lieux de sortie et l'inventaire du mobilier.",
    pieces: [
      pIdentite("BAILLEUR", "du bailleur"),
      p("droit_bailleur", "Titre ou droit de louer le bien", PC, { partieConcernee: "BAILLEUR" }),
      pIdentite("LOCATAIRE", "du locataire"),
      p("inventaire_mobilier", "Inventaire détaillé du mobilier", DIC, { sourceAttendue: "CABINET" }),
      p("etat_lieux_entree", "État des lieux d'entrée signé", CS, { sourceAttendue: "CABINET" }),
      p("etat_lieux_sortie", "État des lieux de sortie", DIC, { niveau: "CONDITIONNELLE", condition: "Au départ du locataire", sourceAttendue: "CABINET" }),
      P_SIGNE,
    ],
  },

  /* ------------------- Actes du cabinet ------------------- */
  {
    code: "CONVENTION_HONORAIRES",
    libelle: "Convention d'honoraires",
    famille: "CONTRAT_CABINET",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet",
    avertissement:
      "La convention d'honoraires est conclue avant l'ouverture du dossier : mode de calcul (au temps passé, au forfait, au résultat en complément), provision, révision ; l'honoraire exclusif au résultat est interdit.",
    pieces: [
      pIdentite("MANDANT", "du client"),
      p("note_mission", "Note interne de définition de la mission", DIC, { sourceAttendue: "CABINET" }),
      p("convention_signee", "Convention d'honoraires signée", CS, { sourceAttendue: "CABINET" }),
      p("provision", "Preuve de perception de la provision", PDS, { niveau: "CONDITIONNELLE", condition: "Provision demandée", sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "LETTRE_MISSION",
    libelle: "Lettre de mission / engagement",
    famille: "CONTRAT_CABINET",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet",
    avertissement:
      "Délimiter la mission, les responsabilités, les livrables et les délais ; la lettre de mission signée vaut contrat d'engagement du cabinet.",
    pieces: [
      pIdentite("MANDANT", "du client"),
      pSociete("MANDANT", "Client"),
      P_PROJET,
      p("lettre_signee", "Lettre de mission signée par le client et le cabinet", CS, { sourceAttendue: "CABINET" }),
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Modèles de documents TPL_*                                          */
/* ------------------------------------------------------------------ */
const CLAUSE_CABINET = `INTERVENTION DU CABINET

Le Cabinet {{cabinet_nom|Nom du cabinet}} intervient exclusivement en qualité de conseil,
d'assistant juridique et d'intermédiaire, dans les limites du mandat qui lui a été
confié. Il assure notamment la collecte et le contrôle documentaire, la préparation
des projets d'actes, la coordination avec les parties, le notaire, les administrations
et les professionnels concernés, ainsi que le suivi des formalités.

Le Cabinet n'est ni vendeur, ni acquéreur, ni bailleur, ni locataire, ni autorité
délivrant des documents administratifs. Il ne garantit ni la solvabilité d'une partie,
ni la délivrance d'un acte administratif, ni l'aboutissement d'une mutation ou d'une
formalité hors de son contrôle.`;

const SIGNATURE_FIN = `
Fait à {{lieu_signature|Lieu de signature}}, le {{date_signature|Date de signature}},
en {{nb_originaux|Nombre d'exemplaires}} exemplaires originaux, soit un pour chaque
partie intéressée et un pour le Cabinet.`;

const MODELES = [
  /* ===================== Contrat de travail ===================== */
  {
    code: "TPL_CONTRAT_TRAVAIL_CDI",
    titre: "Contrat de travail à durée indéterminée",
    typeCode: "TRAVAIL_CDI",
    validationMinimale: "AVOCAT",
    contenu: `CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE
Référence : {{reference_transaction|Référence}}

ENTRE :

{{employeur_nom|Nom ou raison sociale de l'employeur}}, {{employeur_forme|Forme juridique}},
immatriculé(e) au RCCM sous le n° {{employeur_rccm|N° RCCM}} et au NINEA sous le n°
{{employeur_ninea|N° NINEA}}, dont le siège est sis à {{employeur_adresse|Adresse du siège}},
représenté(e) par {{employeur_representant|Nom et qualité du représentant}},
ci-après dénommé(e) « l'Employeur »,

ET :

{{salarie_nom|Nom et prénoms du salarié}}, né(e) le {{salarie_naissance|Date de naissance}}
à {{salarie_lieu_naissance|Lieu de naissance}}, titulaire de la pièce d'identité n°
{{salarie_piece|N° de pièce}}, demeurant à {{salarie_adresse|Adresse du salarié}},
ci-après dénommé(e) « le Salarié ».

ARTICLE 1 — ENGAGEMENT
L'Employeur engage le Salarié, qui accepte, en qualité de {{poste|Poste / fonction}},
classification {{classification|Catégorie / coefficient de la convention collective}},
à compter du {{date_effet|Date d'effet}}.
Le présent contrat est conclu pour une durée indéterminée et régi par le Code du
travail (loi n° 97-17 du 1er décembre 1997) et par la convention collective
{{convention_collective|Convention collective applicable}}.

ARTICLE 2 — FONCTIONS ET LIEU DE TRAVAIL
Le Salarié exerce les fonctions décrites à l'article 1, à {{lieu_travail|Lieu de
travail}}. Il pourra être affecté à tout autre établissement de l'Employeur au
Sénégal dans le respect de la loi.
La durée hebdomadaire de travail est de {{duree_hebdo|Durée hebdomadaire}} heures.

ARTICLE 3 — PÉRIODE D'ESSAI
Le contrat est assorti d'une période d'essai de {{essai|Durée de l'essai}},
renouvelable une fois par écrit dans les limites de la convention collective.

ARTICLE 4 — RÉMUNÉRATION
Le Salarié perçoit une rémunération mensuelle brute de {{salaire|Salaire mensuel
brut}} F CFA, versée {{periodicite_paiement|Périodicité de paie (ex. en fin de mois)}}.
S'y ajoutent : {{avantages|Primes et avantages en nature ou en espèces}}.

ARTICLE 5 — OBLIGATIONS DU SALARIÉ
Le Salarié s'engage à exécuter loyalement ses fonctions, à respecter le règlement
intérieur, à garder la confidentialité des informations de l'Employeur et à ne pas
exercer, pendant le contrat, d'activité concurrente.

ARTICLE 6 — CONGÉS ET PROTECTION SOCIALE
Le Salarié bénéficie des congés et des régimes de sécurité sociale prévus par la
loi (IPRES, CSS, IPM selon affiliation de l'Employeur).

ARTICLE 7 — RUPTURE
Chacune des parties peut mettre fin au contrat moyennant le respect du préavis
prévu par la loi et la convention collective. La rupture est notifiée par écrit
et ses motifs sont précisés conformément au Code du travail.

ARTICLE 8 — FORMALITÉS
Le présent contrat est établi en autant d'exemplaires originaux qu'il y a de
parties ; un exemplaire est remis au Salarié et un autre déposé à l'Inspection
du travail territorialement compétente.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

L'Employeur                              Le Salarié (lu et approuvé)
_______________________                  _______________________`,
  },
  {
    code: "TPL_CONTRAT_TRAVAIL_CDD",
    titre: "Contrat de travail à durée déterminée",
    typeCode: "TRAVAIL_CDD",
    validationMinimale: "AVOCAT",
    contenu: `CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE
Référence : {{reference_transaction|Référence}}

ENTRE :

{{employeur_nom|Nom ou raison sociale de l'employeur}}, {{employeur_forme|Forme juridique}},
immatriculé(e) au RCCM n° {{employeur_rccm|N° RCCM}} et au NINEA n° {{employeur_ninea|N° NINEA}},
siège : {{employeur_adresse|Adresse du siège}}, représenté(e) par
{{employeur_representant|Nom et qualité du représentant}},
ci-après dénommé(e) « l'Employeur »,

ET :

{{salarie_nom|Nom et prénoms du salarié}}, né(e) le {{salarie_naissance|Date de naissance}},
titulaire de la pièce n° {{salarie_piece|N° de pièce}}, demeurant à
{{salarie_adresse|Adresse du salarié}},
ci-après dénommé(e) « le Salarié ».

ARTICLE 1 — ENGAGEMENT ET TERME
L'Employeur engage le Salarié en qualité de {{poste|Poste / fonction}} pour une
durée déterminée du {{date_effet|Date de début}} au {{date_fin|Date de fin}},
soit {{duree|Durée du contrat}}.
Le recours à un contrat à durée déterminée est justifié par : {{motif_cdd|Motif
de recours au CDD (accroissement temporaire d'activité, remplacement, emploi
saisonnier…)}}.

ARTICLE 2 — PRÉCISIONS SUR LE TERME
Le terme est fixé au {{date_fin|Date de fin}} (ou à la réalisation de l'objet :
{{terme_objet|Objet déterminant le terme, le cas échéant}}).
Conformément au Code du travail, le présent contrat ne peut excéder une durée
totale de deux ans, renouvellement compris ; tout renouvellement fait l'objet
d'un écrit.

ARTICLE 3 — FONCTIONS, LIEU ET DURÉE DU TRAVAIL
Fonctions : {{poste|Poste / fonction}}. Lieu : {{lieu_travail|Lieu de travail}}.
Durée hebdomadaire : {{duree_hebdo|Durée hebdomadaire}} heures.

ARTICLE 4 — RÉMUNÉRATION
Rémunération mensuelle brute : {{salaire|Salaire mensuel brut}} F CFA.
{{avantages|Primes et avantages}}

ARTICLE 5 — RUPTURE ANTICIPÉE
Hors faute lourde, inaptitude ou force majeure, la rupture anticipée du CDD
n'intervient que d'un commun accord écrit des parties ou dans les cas prévus
par la loi ; elle donne lieu, le cas échéant, aux indemnités prévues par le
Code du travail.

ARTICLE 6 — FORMALITÉS
Contrat établi par écrit en autant d'exemplaires originaux que de parties ; un
exemplaire est déposé à l'Inspection du travail compétente.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

L'Employeur                              Le Salarié (lu et approuvé)
_______________________                  _______________________`,
  },
  {
    code: "TPL_AVENANT_TRAVAIL",
    titre: "Avenant au contrat de travail",
    typeCode: "TRAVAIL_AVENANT",
    validationMinimale: "AVOCAT",
    contenu: `AVENANT AU CONTRAT DE TRAVAIL
Référence : {{reference_transaction|Référence}}

ENTRE :

{{employeur_nom|Nom ou raison sociale de l'employeur}}, représenté(e) par
{{employeur_representant|Nom et qualité du représentant}},
ci-après « l'Employeur »,

ET :

{{salarie_nom|Nom et prénoms du salarié}},
ci-après « le Salarié ».

PRÉAMBULE
Les parties ont conclu un contrat de travail en date du {{date_contrat_initial|
Date du contrat initial}} portant sur les fonctions de {{poste_initial|Poste
initial}}. Elles conviennent des modifications suivantes.

ARTICLE 1 — MODIFICATIONS APPORTÉES
À compter du {{date_effet|Date d'effet de l'avenant}}, le contrat est modifié
ainsi qu'il suit :
{{modifications|Description précise des modifications (poste, lieu, horaires,
rémunération, classification…) avec rappel des stipulations antérieures}}.

ARTICLE 2 — ACCORD DU SALARIÉ
Le Salarié reconnaît avoir été informé des modifications et les accepter
librement. Les dispositions du contrat initial non modifiées demeurent en
vigueur.

ARTICLE 3 — FORMALITÉS
Le présent avenant est établi en autant d'exemplaires originaux que de parties.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

L'Employeur                              Le Salarié (lu et approuvé)
_______________________                  _______________________`,
  },
  {
    code: "TPL_RUPTURE_CONVENTIONNELLE",
    titre: "Convention de rupture conventionnelle",
    typeCode: "TRAVAIL_RUPTURE",
    validationMinimale: "AVOCAT",
    contenu: `CONVENTION DE RUPTURE CONVENTIONNELLE DU CONTRAT DE TRAVAIL
Référence : {{reference_transaction|Référence}}

ENTRE :

{{employeur_nom|Nom ou raison sociale de l'employeur}}, représenté(e) par
{{employeur_representant|Nom et qualité du représentant}},
ci-après « l'Employeur »,

ET :

{{salarie_nom|Nom et prénoms du salarié}}, titulaire de la pièce n°
{{salarie_piece|N° de pièce}},
ci-après « le Salarié ».

PRÉAMBULE
Le Salarié est employé en qualité de {{poste|Poste}} depuis le
{{date_engagement|Date d'engagement}}. Les parties constatant leur volonté
commune de mettre fin au contrat de travail conviennent ce qui suit.

ARTICLE 1 — RUPTURE D'UN COMMUN ACCORD
Les parties conviennent de la rupture du contrat de travail à compter du
{{date_rupture|Date de rupture}}. La présente convention est soumise à
l'homologation de l'Inspecteur du travail territorialement compétent.

ARTICLE 2 — INDEMNITÉS
À la date de rupture, l'Employeur versera au Salarié :
- l'indemnité conventionnelle de rupture : {{indemnite_rupture|Montant}} F CFA ;
- l'indemnité compensatrice de congés payés : {{indemnite_conges|Montant}} F CFA ;
- autres sommes dues : {{autres_sommes|Autres sommes (rappels, primes…)}}.

ARTICLE 3 — DOCUMENTS DE FIN DE CONTRAT
L'Employeur remettra au Salarié le certificat de travail, le solde de tout
compte et le reçu pour solde de tout compte.

ARTICLE 4 — NON-CONTENTIEUX
Les parties déclarent n'avoir rien à se réclamer l'une de l'autre au titre de
l'exécution et de la rupture du contrat, sous réserve des droits dont la
renonciation n'est pas permise par la loi.

ARTICLE 5 — HOMOLOGATION
La présente convention n'est opposable qu'après homologation par l'Inspecteur
du travail. Elle est établie en autant d'exemplaires originaux que nécessaires
pour les parties et l'Administration.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

L'Employeur                              Le Salarié (lu et approuvé)
_______________________                  _______________________`,
  },
  {
    code: "TPL_CONVENTION_STAGE",
    titre: "Convention de stage",
    typeCode: "TRAVAIL_STAGE",
    validationMinimale: "JURISTE",
    contenu: `CONVENTION DE STAGE
Référence : {{reference_transaction|Référence}}

ENTRE :

{{employeur_nom|Nom ou raison sociale de la structure d'accueil}}, représentée par
{{employeur_representant|Nom et qualité du représentant}},
ci-après « la Structure d'accueil »,

ET :

{{stagiaire_nom|Nom et prénoms du stagiaire}}, né(e) le
{{stagiaire_naissance|Date de naissance}}, demeurant à
{{stagiaire_adresse|Adresse du stagiaire}},
{{etablissement|Établissement de formation (le cas échéant)}},
ci-après « le Stagiaire ».

ARTICLE 1 — OBJET
La Structure d'accueil accepte le Stagiaire pour un stage de
{{duree|Durée du stage}}, du {{date_debut|Date de début}} au
{{date_fin|Date de fin}}, dans le service {{service|Service / département}},
en vue de {{objectif_stage|Objectif pédagogique ou professionnel du stage}}.

ARTICLE 2 — ENCADREMENT
Le Stagiaire est placé sous la responsabilité de {{tuteur|Nom du tuteur}},
qui assure son encadrement et son évaluation.

ARTICLE 3 — GRATIFICATION
Le Stagiaire perçoit une gratification de {{gratification|Montant de la
gratification}} F CFA par mois (ou : le stage n'est pas gratifié).

ARTICLE 4 — OBLIGATIONS
Le Stagiaire s'engage à observer le règlement intérieur, les horaires et la
confidentialité des informations de la Structure d'accueil. Le stage ne
constitue pas un contrat de travail et ne se substitue pas à un emploi.

ARTICLE 5 — ÉVALUATION ET TERMINAISON
Une attestation de stage est délivrée en fin de période. Chaque partie peut
mettre fin au stage en cas de manquement grave, par écrit motivé.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

La Structure d'accueil                    Le Stagiaire (lu et approuvé)
_______________________                   _______________________`,
  },

  /* ================== Contrats commerciaux ================== */
  {
    code: "TPL_CONTRAT_PRESTATION",
    titre: "Contrat de prestation de services",
    typeCode: "PRESTATION_SERVICES",
    validationMinimale: "AVOCAT",
    contenu: `CONTRAT DE PRESTATION DE SERVICES
Référence : {{reference_transaction|Référence}}

ENTRE :

{{donneur_ordre_nom|Nom ou raison sociale du donneur d'ordre}}, {{donneur_ordre_forme|Forme
juridique}}, immatriculé(e) au RCCM n° {{donneur_ordre_rccm|N° RCCM}}, siège :
{{donneur_ordre_adresse|Adresse}}, représenté(e) par {{donneur_ordre_representant|Représentant}},
ci-après « le Client »,

ET :

{{prestataire_nom|Nom ou raison sociale du prestataire}}, {{prestataire_forme|Forme juridique}},
immatriculé(e) au RCCM n° {{prestataire_rccm|N° RCCM}} et NINEA n° {{prestataire_ninea|NINEA}},
siège : {{prestataire_adresse|Adresse}}, représenté(e) par {{prestataire_representant|Représentant}},
ci-après « le Prestataire ».

ARTICLE 1 — OBJET
Le Prestataire réalise pour le Client les prestations décrites au cahier des
charges annexé et résumées ainsi : {{objet_prestations|Objet des prestations}}.

ARTICLE 2 — DURÉE
Le contrat est conclu pour une durée de {{duree|Durée}} à compter du
{{date_effet|Date d'effet}}. {{renouvellement|Modalités de renouvellement}}.

ARTICLE 3 — PRIX ET PAIEMENT
Prix : {{prix_vente|Prix (ou tarif)}} {{devise|Devise}}, payable {{modalites_paiement|
Modalités de paiement (avance, acomptes, solde)}}.
Les débours sont refacturés sur justificatifs : {{debours|Modalités des débours}}.

ARTICLE 4 — LIVRABLES ET RÉCEPTION
Les livrables sont réceptionnés selon les critères du cahier des charges ; le
Client dispose de {{delai_reception|Délai de réception}} pour émettre ses
observations. À défaut de réserve écrite dans ce délai, la réception est réputée
acquise.

ARTICLE 5 — INDÉPENDANCE
Le Prestataire agit en toute indépendance, organise librement ses moyens et
n'est soumis à aucun lien de subordination avec le Client. Il déclare être à
jour de ses obligations fiscales et sociales.

ARTICLE 6 — CONFIDENTIALITÉ ET PROPRIÉTÉ
Chaque partie garde confidentielles les informations de l'autre.
{{propriete_livrables|Propriété intellectuelle des livrables (cessions, licences)}}.

ARTICLE 7 — RESPONSABILITÉ ET RÉSILIATION
Le Prestataire est tenu à une obligation {{nature_obligation|de moyens / de
résultat}}. Le contrat peut être résilié pour manquement grave après mise en
demeure restée {{delai_mise_en_demeure|Délai}} sans effet.

ARTICLE 8 — LITIGES
Tout litige est réglé à l'amiable ; à défaut, il est soumis aux juridictions de
{{juridiction|Juridiction compétente}}.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Le Client                                Le Prestataire
_______________________                  _______________________`,
  },
  {
    code: "TPL_CONTRAT_SOUS_TRAITANCE",
    titre: "Contrat de sous-traitance",
    typeCode: "SOUS_TRAITANCE",
    validationMinimale: "AVOCAT",
    contenu: `CONTRAT DE SOUS-TRAITANCE
Référence : {{reference_transaction|Référence}}

ENTRE :

{{donneur_ordre_nom|Nom ou raison sociale du donneur d'ordre}}, représenté(e) par
{{donneur_ordre_representant|Représentant}}, ci-après « le Donneur d'ordre »,

ET :

{{prestataire_nom|Nom ou raison sociale du sous-traitant}}, immatriculé(e) au RCCM
n° {{prestataire_rccm|N° RCCM}}, représenté(e) par {{prestataire_representant|Représentant}},
ci-après « le Sous-traitant ».

ARTICLE 1 — OBJET
Dans le cadre du contrat principal {{reference_marche|Référence du contrat ou
marché principal}} conclu avec {{maitre_ouvrage|Maître d'ouvrage}}, le Donneur
d'ordre confie au Sous-traitant : {{objet_sous_traitance|Travaux ou prestations
sous-traités}}.

ARTICLE 2 — CONDITIONS FINANCIÈRES
Prix de la sous-traitance : {{prix_vente|Montant}} {{devise|Devise}}, payable
{{modalites_paiement|Modalités de paiement}}.
Le Sous-traitant accepte, le cas échéant, le paiement direct par le maître
d'ouvrage : {{paiement_direct|Modalités de paiement direct}}.

ARTICLE 3 — OBLIGATIONS DU SOUS-TRAITANT
Le Sous-traitant exécute les prestations dans les délais et les règles de l'art,
justifie être à jour de ses obligations fiscales et sociales, et demeure
responsable de son personnel.

ARTICLE 4 — RESPONSABILITÉS
Le Donneur d'ordre reste responsable envers le maître d'ouvrage ; il garantit
au Sous-traitant le paiement des sommes dues dans la limite du marché
sous-traité. {{garanties|Garanties, retenues de garantie, pénalités}}.

ARTICLE 5 — DURÉE ET RÉSILIATION
Durée : {{duree|Durée}}. Résiliation pour manquement grave après mise en
demeure restée sans effet {{delai_mise_en_demeure|Délai}}.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Le Donneur d'ordre                        Le Sous-traitant
_______________________                   _______________________`,
  },
  {
    code: "TPL_CONTRAT_APPORTEUR",
    titre: "Convention d'apporteur d'affaires",
    typeCode: "APPORTEUR_AFFAIRES",
    validationMinimale: "AVOCAT",
    contenu: `CONVENTION D'APPORTEUR D'AFFAIRES
Référence : {{reference_transaction|Référence}}

ENTRE :

{{donneur_ordre_nom|Nom ou raison sociale du donneur d'ordre}}, représenté(e) par
{{donneur_ordre_representant|Représentant}}, ci-après « le Bénéficiaire »,

ET :

{{apporteur_nom|Nom ou raison sociale de l'apporteur d'affaires}}, représenté(e) par
{{apporteur_representant|Représentant}}, ci-après « l'Apporteur ».

ARTICLE 1 — MISSION
L'Apporteur met en relation le Bénéficiaire avec des prospects susceptibles de
conclure : {{nature_affaires|Nature des affaires visées (marchés, ventes,
contrats)}}. L'Apporteur n'a pas qualité pour engager le Bénéficiaire ni pour
conclure les contrats en son nom.

ARTICLE 2 — COMMISSION
Pour chaque affaire effectivement conclue grâce à son apport, l'Apporteur
perçoit une commission de {{commission|Taux ou montant de la commission}},
calculée sur {{commission_base|Base de calcul}}, exigible à {{exigibilite|
Conditions d'exigibilité (signature, encaissement)}}.

ARTICLE 3 — DÉCLARATION DES AFFAIRES
Toute affaire apportée est déclarée par écrit ; l'attribution de la commission
est subordonnée à la preuve du lien entre l'apport et la conclusion.

ARTICLE 4 — INDÉPENDANCE ET LOYAUTÉ
L'Apporteur agit en indépendant, sans subordination ; il s'interdit tout
démarchage contraire aux intérêts du Bénéficiaire et garde la confidentialité.

ARTICLE 5 — DURÉE ET FIN
Durée : {{duree|Durée}} à compter du {{date_effet|Date d'effet}}. La convention
peut être dénoncée moyennant un préavis de {{preavis|Préavis}} ; les commissions
des affaires en cours restent dues selon l'article 2.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Le Bénéficiaire                           L'Apporteur
_______________________                   _______________________`,
  },
  {
    code: "TPL_CONTRAT_DISTRIBUTION",
    titre: "Contrat de distribution / agence commerciale",
    typeCode: "DISTRIBUTION_COMMERCIALE",
    validationMinimale: "AVOCAT",
    contenu: `CONTRAT DE DISTRIBUTION COMMERCIALE
Référence : {{reference_transaction|Référence}}

ENTRE :

{{donneur_ordre_nom|Nom ou raison sociale du fournisseur / concédant}}, représenté(e)
par {{donneur_ordre_representant|Représentant}}, ci-après « le Fournisseur »,

ET :

{{prestataire_nom|Nom ou raison sociale du distributeur / agent}}, immatriculé(e) au
RCCM n° {{prestataire_rccm|N° RCCM}}, représenté(e) par {{prestataire_representant|Représentant}},
ci-après « le Distributeur ».

ARTICLE 1 — OBJET ET TERRITOIRE
Le Fournisseur confie au Distributeur la distribution des produits
{{produits|Produits concernés}} sur le territoire {{territoire|Territoire}},
{{exclusivite|avec ou sans exclusivité — préciser}}.

ARTICLE 2 — OBLIGATIONS DES PARTIES
Le Fournisseur s'engage à approvisionner le Distributeur aux conditions
tarifaires en vigueur et à lui fournir la documentation commerciale.
Le Distributeur s'engage à {{objectifs|Objectifs de vente / seuils}}, à respecter
l'image de marque et à ne pas distribuer des produits concurrents sans accord.

ARTICLE 3 — CONDITIONS COMMERCIALES
Prix d'achat : {{conditions_tarifaires|Conditions tarifaires}}.
Conditions de paiement : {{modalites_paiement|Modalités}}.
{{redevance|Redevance ou commission éventuelle}}.

ARTICLE 4 — DURÉE ET RUPTURE
Durée : {{duree|Durée}} à compter du {{date_effet|Date d'effet}}.
Chaque partie peut dénoncer le contrat moyennant un préavis écrit de
{{preavis|Préavis}}. La rupture sans préavis suffisant ou abusive expose son
auteur à indemnisation.

ARTICLE 5 — STOCKS ET RETOURS
{{modalites_stocks|Modalités de reprise des stocks et retours en fin de contrat}}.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Le Fournisseur                            Le Distributeur
_______________________                   _______________________`,
  },
  {
    code: "TPL_ACCORD_CONFIDENTIALITE",
    titre: "Accord de confidentialité (NDA)",
    typeCode: "NDA_CONFIDENTIALITE",
    validationMinimale: "JURISTE",
    contenu: `ACCORD DE CONFIDENTIALITÉ
Référence : {{reference_transaction|Référence}}

ENTRE LES PARTIES SOUSSIGNÉES :

{{partie_1_nom|Partie 1 — nom ou raison sociale}}, représentée par
{{partie_1_representant|Représentant}},

ET :

{{partie_2_nom|Partie 2 — nom ou raison sociale}}, représentée par
{{partie_2_representant|Représentant}}.

ARTICLE 1 — OBJET
Dans le cadre de {{contexte|Contexte des échanges (négociation, audit,
partenariat)}}, les parties s'exposeront mutuellement des informations
confidentielles : {{perimetre|Périmètre des informations (techniques,
commerciales, financières, données)}}.

ARTICLE 2 — ENGAGEMENTS
Chaque partie s'engage à :
- utiliser les informations uniquement aux fins de l'objet ci-dessus ;
- les protéger avec le même soin que ses propres informations ;
- n'y donner accès qu'aux personnes ayant besoin d'en connaître ;
- ne pas les divulguer à des tiers sans accord écrit préalable.

ARTICLE 3 — EXCLUSIONS
Ne sont pas confidentielles les informations publiques, déjà licitement
connues, développées indépendamment, ou dont la divulgation est imposée par
la loi ou une autorité compétente.

ARTICLE 4 — DONNÉES PERSONNELLES
Si des données personnelles sont échangées, les parties se conforment à la
loi n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère
personnel.

ARTICLE 5 — DURÉE
L'accord prend effet le {{date_effet|Date d'effet}} pour une durée de
{{duree|Durée}} ; les obligations de confidentialité survivent {{survie|Durée
de survie}} après la fin des échanges.

ARTICLE 6 — SANCTIONS
Tout manquement expose son auteur à réparation du préjudice subi.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Partie 1                                  Partie 2
_______________________                   _______________________`,
  },
  {
    code: "TPL_PROTOCOLE_ACCORD",
    titre: "Lettre d'intention / protocole d'accord",
    typeCode: "PROTOCOLE_ACCORD",
    validationMinimale: "AVOCAT",
    contenu: `PROTOCOLE D'ACCORD / LETTRE D'INTENTION
Référence : {{reference_transaction|Référence}}

ENTRE LES PARTIES SOUSSIGNÉES :

{{partie_1_nom|Partie 1 — nom ou raison sociale}}, représentée par
{{partie_1_representant|Représentant}},

ET :

{{partie_2_nom|Partie 2 — nom ou raison sociale}}, représentée par
{{partie_2_representant|Représentant}}.

ARTICLE 1 — CONTEXTE ET INTENTION
Les parties envisagent {{projet|Projet ou opération envisagée}} et entendent
fixer le cadre de leurs discussions : {{perimetre|Périmètre des discussions}}.

ARTICLE 2 — CLAUSES CONTRAIGNANTES
Pendant la durée des discussions :
- Exclusivité : {{exclusivite|Exclusivité de négociation — étendue et durée}} ;
- Confidentialité : les informations échangées restent confidentielles ;
- Frais : chaque partie supporte ses propres frais ; {{frais|Répartition
particulière des frais, le cas échéant}}.

ARTICLE 3 — NATURE DU DOCUMENT
Le présent protocole est une lettre d'intention : à l'exception de l'article 2,
il ne vaut pas engagement définitif de conclure l'opération. La conclusion
demeure subordonnée à {{conditions|Conditions (due diligence, accords internes,
autorisations)}}.

ARTICLE 4 — CALENDRIER
Les parties s'efforcent de conclure avant le {{echeance|Échéance visée}}.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Partie 1                                  Partie 2
_______________________                   _______________________`,
  },

  /* ==================== Sociétés (OHADA) ==================== */
  {
    code: "TPL_CESSION_PARTS",
    titre: "Acte de cession de parts sociales / actions",
    typeCode: "CESSION_PARTS",
    validationMinimale: "AVOCAT",
    contenu: `ACTE DE CESSION DE PARTS SOCIALES
Référence : {{reference_transaction|Référence}}

ENTRE :

{{cedant_nom|Nom ou raison sociale du cédant}}, demeurant à {{cedant_adresse|Adresse}},
{{cedant_representant|Représentant (personne morale)}},
ci-après « le Cédant »,

ET :

{{cessionnaire_nom|Nom ou raison sociale du cessionnaire}}, demeurant à
{{cessionnaire_adresse|Adresse}}, {{cessionnaire_representant|Représentant}},
ci-après « le Cessionnaire ».

ARTICLE 1 — SOCIÉTÉ ET TITRES CÉDÉS
Société : {{societe_nom|Dénomination sociale}}, {{societe_forme|Forme (SARL, SA,
SAS…)}}, au capital de {{capital|Capital}} F CFA, immatriculée au RCCM de
{{rccm_ville|Ville}} sous le n° {{rccm|N° RCCM}}.
Le Cédant cède au Cessionnaire {{nb_parts|Nombre de parts / actions}} parts
(soit {{pourcentage|Pourcentage du capital}} % du capital), numérotées
{{numeros_parts|Numérotation des titres}}.

ARTICLE 2 — PRIX
Le prix de cession est fixé à {{prix_vente|Prix total}} {{devise|Devise}},
payé {{modalites_paiement|Modalités de paiement}}.

ARTICLE 3 — AGRÉMENT ET PROCÉDURE
Cession entre associés / au profit d'un tiers : {{agrement|Mentionner
l'agrément des associés recueilli aux conditions statutaires, le cas échéant
le PV d'assemblage}}.
Le Cessionnaire se substitue au Cédant dans la jouissance des droits attachés
aux titres.

ARTICLE 4 — GARANTIES
Le Cédant garantit être propriétaire des titres cédés, qu'ils sont libres de
toute charge ou sûreté, et que les apports correspondants sont libérés.
{{garanties_complementaires|Garanties complémentaires (actif/passif, comptes,
pacte de garantie)}}.

ARTICLE 5 — FORMALITÉS
La cession est enregistrée auprès des services compétents ; l'inscription
modificative est portée au RCCM et les statuts sont mis à jour.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Le Cédant                                 Le Cessionnaire
_______________________                   _______________________`,
  },
  {
    code: "TPL_PACTE_ASSOCIES",
    titre: "Pacte d'associés / convention d'actionnaires",
    typeCode: "PACTE_ASSOCIES",
    validationMinimale: "AVOCAT",
    contenu: `PACTE D'ASSOCIÉS
Référence : {{reference_transaction|Référence}}

ENTRE LES ASSOCIÉS SOUSSIGNÉS :

{{liste_parties|Liste des associés parties au pacte (noms et parts détenues)}}

détenteurs ensemble de {{pourcentage_total|Pourcentage du capital concerné}} %
du capital de la société {{societe_nom|Dénomination sociale}}, immatriculée au
RCCM n° {{rccm|N° RCCM}}.

ARTICLE 1 — OBJET
Le présent pacte organise les relations entre associés au-delà des statuts :
{{objet_pacte|Objet du pacte (gouvernance, transmissions, majorités, sorties)}}.

ARTICLE 2 — GOUVERNANCE
{{gouvernance|Répartition des mandats, règles de majorité, droits de vote ou
de veto}}.

ARTICLE 3 — TRANSMISSIONS DE TITRES
{{clauses_transmission|Clauses d'agrément, préemption, inaliénabilité (10 ans
maximum), portage, promesses de cession}}.

ARTICLE 4 — SORTIE
{{modalites_sortie|Modalités de sortie (bon de sortie, évaluation des titres,
clauses de départ forcé ou de conjointement)}}.

ARTICLE 5 — CONFIDENTIALITÉ ET SANCTIONS
Le pacte est confidentiel entre les parties ; tout manquement expose à
{{sanctions|Sanctions conventionnelles}}.

ARTICLE 6 — DURÉE
Durée : {{duree|Durée du pacte}} à compter du {{date_effet|Date d'effet}}.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Les Associés (lu et approuvé)
_______________________  _______________________  _______________________`,
  },
  {
    code: "TPL_CESSION_FONDS_COMMERCE",
    titre: "Contrat de cession de fonds de commerce",
    typeCode: "CESSION_FONDS_COMMERCE",
    validationMinimale: "AVOCAT",
    contenu: `CONTRAT DE CESSION DE FONDS DE COMMERCE
Référence : {{reference_transaction|Référence}}

ENTRE :

{{cedant_nom|Nom ou raison sociale du cédant}}, exploitant le fonds de commerce
« {{nom_fonds|Nom / enseigne du fonds}} » sis à {{adresse_fonds|Adresse du fonds}},
immatriculé au RCCM n° {{rccm|N° RCCM}},
ci-après « le Cédant »,

ET :

{{cessionnaire_nom|Nom ou raison sociale du cessionnaire}}, demeurant à
{{cessionnaire_adresse|Adresse}},
ci-après « le Cessionnaire ».

ARTICLE 1 — ÉLÉMENTS CÉDÉS
Le Cédant vend au Cessionnaire le fonds de commerce comprenant :
{{elements_fonds|Éléments du fonds : clientèle, enseigne, matériel et mobilier,
marchandises, droit au bail, licences}}.

ARTICLE 2 — PRIX ET PAIEMENT
Prix de cession : {{prix_vente|Prix total}} {{devise|Devise}}, réparti ainsi :
{{repartition_prix|Répartition du prix entre les éléments}}.
Paiement : {{modalites_paiement|Modalités de paiement}}.

ARTICLE 3 — ORIGINE ET GARANTIE
Le Cédant justifie de la propriété du fonds par {{origine_propriete|Origine de
propriété (acquisition, création)}} et de l'exercice depuis
{{exploitation_depuis|Date}}. Il garantit contre l'éviction et les vices
cachés ; l'état des charges et sûretés grevant le fonds est annexé.

ARTICLE 4 — BAIL
{{bail_local|Bail du local d'exploitation : référence, consentement du bailleur
le cas échéant, cession du droit au bail}}.

ARTICLE 5 — FORMALITÉS
La vente est enregistrée et publiée dans un journal d'annonces légales ; les
créanciers du Cédant disposent du délai d'opposition prévu par l'AUSCGIE.
L'inscription modificative est portée au RCCM.

ARTICLE 6 — NON-CONCURRENCE
{{non_concurrence|Clause de non-concurrence du cédant (étendue, durée,
indemnité)}}.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Le Cédant                                 Le Cessionnaire
_______________________                   _______________________`,
  },
  {
    code: "TPL_CAUTIONNEMENT",
    titre: "Acte de cautionnement",
    typeCode: "CAUTIONNEMENT",
    validationMinimale: "AVOCAT",
    contenu: `ACTE DE CAUTIONNEMENT
Référence : {{reference_transaction|Référence}}

ENTRE :

{{creancier_nom|Nom ou raison sociale du créancier}}, représenté(e) par
{{creancier_representant|Représentant}},
ci-après « le Créancier »,

ET :

{{caution_nom|Nom et prénoms de la caution}}, né(e) le {{caution_naissance|Date de
naissance}}, demeurant à {{caution_adresse|Adresse de la caution}},
ci-après « la Caution ».

ARTICLE 1 — DETTE GARANTIE
Par le présent acte, la Caution se porte caution {{nature_cautionnement|simple
et indivisible / solidaire}} du paiement des obligations de
{{debiteur_nom|Nom du débiteur principal}} au titre de {{nature_dette|Nature
de la dette garantie (prêt, bail, marché) — référence}}, pour un montant
plafond de {{plafond|Montant maximum en chiffres}} F CFA.

ARTICLE 2 — ÉTENDUE ET DURÉE
Le cautionnement couvre : {{etendue|Étendue (principal, intérêts, accessoires,
pénalités)}}. Il est consenti pour {{duree_cautionnement|Durée déterminée ou
indéterminée — préciser}}.

ARTICLE 3 — MENTION DE LA CAUTION
Conformément à l'Acte uniforme OHADA sur les sûretés, la Caution appose
elle-même, à la suite des signatures, la mention suivante en toutes lettres :
« Je m'engage, en qualité de caution, à payer au créancier ce que doit le
débiteur en cas de défaillance, dans la limite de la somme de
{{plafond_lettres|Montant du plafond en toutes lettres}} francs CFA, de son
principal et accessoires. »

ARTICLE 4 — RENSEIGNEMENTS
Le Créancier informe la Caution de l'évolution de la dette garantie et des
incidents de paiement, dans les conditions prévues par la loi.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Le Créancier                              La Caution (mention manuscrite)
_______________________                   _______________________`,
  },

  /* ================= Obligations & actes civils ================= */
  {
    code: "TPL_PROCURATION",
    titre: "Procuration générale ou spéciale",
    typeCode: "PROCURATION",
    validationMinimale: "JURISTE",
    contenu: `PROCURATION
Référence : {{reference_transaction|Référence}}

Je soussigné(e), {{mandant_nom|Nom et prénoms du mandant}}, né(e) le
{{mandant_naissance|Date de naissance}}, titulaire de la pièce n°
{{mandant_piece|N° de pièce}}, demeurant à {{mandant_adresse|Adresse}},

donne pouvoir à : {{mandataire_nom|Nom et prénoms du mandataire}}, titulaire
de la pièce n° {{mandataire_piece|N° de pièce}}, demeurant à
{{mandataire_adresse|Adresse}},

à l'effet de, en mon nom et pour mon compte :

{{etendue_pouvoirs|Énumération précise des actes que le mandataire peut
accomplir (administrer, signer, encaisser, représenter…) ; préciser si des
actes de disposition sont inclus et pour quels biens}}.

Le présent pouvoir est consenti pour la durée : {{duree|Durée ou « jusqu'à
révocation »}}. Il est révocable à tout moment par notification écrite ;
les actes accomplis avant la révocation demeurent valables à l'égard des
tiers de bonne foi.

Le mandataire est tenu de rendre compte de sa gestion et de remettre les
pièces justificatives.

${CLAUSE_CABINET}

Fait à {{lieu_signature|Lieu}}, le {{date_signature|Date}}.

Le Mandant (signature précédée de « bon pour pouvoir »)
_______________________`,
  },
  {
    code: "TPL_RECONNAISSANCE_DETTE",
    titre: "Reconnaissance de dette",
    typeCode: "RECONNAISSANCE_DETTE",
    validationMinimale: "JURISTE",
    contenu: `RECONNAISSANCE DE DETTE
Référence : {{reference_transaction|Référence}}

Je soussigné(e), {{debiteur_nom|Nom et prénoms du débiteur}}, né(e) le
{{debiteur_naissance|Date de naissance}}, titulaire de la pièce n°
{{debiteur_piece|N° de pièce}}, demeurant à {{debiteur_adresse|Adresse}},

reconnais devoir à : {{creancier_nom|Nom ou raison sociale du créancier}},
demeurant à {{creancier_adresse|Adresse}},

la somme de {{montant_chiffres|Montant en chiffres}} F CFA
({{montant_lettres|Montant en toutes lettres}} francs CFA), au titre de :
{{origine_dette|Origine de la dette (prêt, marchandises, prestations,
restitution)}}.

Cette dette sera remboursée selon l'échéancier suivant :
{{echeancier|Échéancier de paiement (dates et montants)}}.

À défaut de paiement d'un terme, la totalité des sommes restantes devient
immédiatement exigible, {{interets|Intérêts de retard éventuels}}.

La présente reconnaissance est établie en autant d'originaux que de parties ;
elle vaut titre entre elles.

${CLAUSE_CABINET}

Fait à {{lieu_signature|Lieu}}, le {{date_signature|Date}}.

Le Débiteur (bon pour la somme de … F CFA)
_______________________`,
  },
  {
    code: "TPL_TRANSACTION_AMIABLE",
    titre: "Protocole transactionnel",
    typeCode: "TRANSACTION_AMIABLE",
    validationMinimale: "AVOCAT",
    contenu: `PROTOCOLE TRANSACTIONNEL
Référence : {{reference_transaction|Référence}}

ENTRE :

{{partie_1_nom|Partie 1 — nom ou raison sociale}}, représentée par
{{partie_1_representant|Représentant}},
ci-après « la Partie 1 »,

ET :

{{partie_2_nom|Partie 2 — nom ou raison sociale}}, représentée par
{{partie_2_representant|Représentant}},
ci-après « la Partie 2 ».

PRÉAMBULE — LE DIFFÉREND
{{expose_differend|Exposé du différend (contrat, faits, prétentions de chaque
partie, procédures en cours)}}.

ARTICLE 1 — TRANSACTION
Aux termes du présent protocole, qui constitue une transaction au sens du
Code des obligations civiles et commerciales, les parties mettent fin au
différend par des concessions réciproques :

- La Partie 1 s'engage à : {{engagements_partie_1|Engagements de la partie 1
(paiement, livraison, désistement, restitution)}}.
- La Partie 2 s'engage à : {{engagements_partie_2|Engagements de la partie 2}}.

ARTICLE 2 — CALENDRIER
Les engagements seront exécutés selon le calendrier : {{calendrier|Calendrier
d'exécution}}.

ARTICLE 3 — RENONCIATIONS
Chaque partie renonce, sous réserve de l'exécution intégrale du protocole,
à toute action ou réclamation au titre du différend exposé ci-dessus ; les
procédures en cours seront closes : {{desistement|Désistements d'instance
à formaliser}}.

ARTICLE 4 — AUTORITÉ
La transaction a entre les parties l'autorité de la chose jugée ; elle ne
pourra être contestée que dans les cas et formes prévus par la loi.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

La Partie 1                               La Partie 2
_______________________                   _______________________`,
  },
  {
    code: "TPL_PRET_PARTICULIERS",
    titre: "Contrat de prêt entre particuliers",
    typeCode: "PRET_PARTICULIERS",
    validationMinimale: "JURISTE",
    contenu: `CONTRAT DE PRÊT ENTRE PARTICULIERS
Référence : {{reference_transaction|Référence}}

ENTRE :

{{creancier_nom|Nom et prénoms du prêteur}}, demeurant à
{{creancier_adresse|Adresse}},
ci-après « le Prêteur »,

ET :

{{debiteur_nom|Nom et prénoms de l'emprunteur}}, né(e) le
{{debiteur_naissance|Date de naissance}}, demeurant à {{debiteur_adresse|Adresse}},
ci-après « l'Emprunteur ».

ARTICLE 1 — PRÊT
Le Prêteur prête à l'Emprunteur la somme de {{montant_chiffres|Montant en
chiffres}} F CFA ({{montant_lettres|Montant en toutes lettres}} francs CFA),
versée le {{date_versement|Date de versement}} par {{mode_versement|Mode de
versement}}, dont l'Emprunteur reconnaît la réception.

ARTICLE 2 — REMBOURSEMENT
L'Emprunteur remboursera le prêt au plus tard le {{echeance|Date d'échéance}},
selon l'échéancier suivant : {{echeancier|Échéancier de remboursement}}.
Mode de remboursement : {{mode_remboursement|Mode de remboursement}}.

ARTICLE 3 — INTÉRÊTS
Le prêt {{interets|est gratuit / est assorti d'un intérêt au taux de … % l'an,
dans la limite du taux d'usure applicable}}.

ARTICLE 4 — DÉFAUT
À défaut de paiement d'un terme, les sommes restantes deviennent exigibles
par anticipation ; l'Emprunteur supportera {{penalites|Pénalités ou intérêts
de retard éventuels}}.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Le Prêteur                                L'Emprunteur (bon pour …)
_______________________                   _______________________`,
  },
  {
    code: "TPL_CESSION_CREANCE",
    titre: "Acte de cession de créance",
    typeCode: "CESSION_CREANCE",
    validationMinimale: "AVOCAT",
    contenu: `ACTE DE CESSION DE CRÉANCE
Référence : {{reference_transaction|Référence}}

ENTRE :

{{cedant_nom|Nom ou raison sociale du cédant}}, représenté(e) par
{{cedant_representant|Représentant}},
ci-après « le Cédant »,

ET :

{{cessionnaire_nom|Nom ou raison sociale du cessionnaire}}, représenté(e) par
{{cessionnaire_representant|Représentant}},
ci-après « le Cessionnaire ».

ARTICLE 1 — CRÉANCE CÉDÉE
Le Cédant cède au Cessionnaire la créance qu'il détient sur
{{debiteur_cede|Identité du débiteur cédé}}, d'un montant de
{{montant_creance|Montant de la créance}} F CFA, au titre de
{{origine_creance|Origine de la créance (contrat, facture, jugement —
références)}}.

ARTICLE 2 — PRIX
Prix de la cession : {{prix_vente|Prix}} {{devise|Devise}}, payé
{{modalites_paiement|Modalités de paiement}}.

ARTICLE 3 — GARANTIES
Le Cédant garantit l'existence et la cessibilité de la créance ; il déclare
{{garantie_solvabilite|si la solvabilité du débiteur est garantie, et dans
quelle mesure}}. Les pièces justificatives sont remises au Cessionnaire.

ARTICLE 4 — OPOSABILITÉ
La cession sera signifiée au débiteur cédé par acte d'huissier (ou acceptée
par acte authentique) ; elle ne lui est opposable qu'à compter de cette
signification. Les frais de signification sont à la charge de
{{charge_signification|Partie supportant les frais}}.

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Le Cédant                                 Le Cessionnaire
_______________________                   _______________________`,
  },

  /* ==================== Actes du cabinet ==================== */
  {
    code: "TPL_CONVENTION_HONORAIRES",
    titre: "Convention d'honoraires",
    typeCode: "CONVENTION_HONORAIRES",
    validationMinimale: "AVOCAT",
    contenu: `CONVENTION D'HONORAIRES
Référence : {{reference_transaction|Référence}}

ENTRE :

Le Cabinet {{cabinet_nom|Nom du cabinet}}, {{cabinet_adresse|Adresse}},
représenté par {{signataire_nom|Nom du signataire}}, en sa qualité de
{{signataire_qualite|Qualité}},
ci-après « le Cabinet »,

ET :

{{mandant_nom|Nom ou raison sociale du client}}, demeurant à
{{mandant_adresse|Adresse}}, représenté(e) par {{mandant_representant|Représentant}},
ci-après « le Client ».

ARTICLE 1 — MISSION
Le Client confie au Cabinet la mission suivante : {{objet_mission|Objet de la
mission confiée au cabinet}}.

ARTICLE 2 — HONORAIRES
Les honoraires du Cabinet sont calculés ainsi : {{mode_calcul|Mode de calcul
(au temps passé — taux horaire, au forfait, honoraire de résultat en
complément d'un honoraire de base)}}.
Montant ou taux : {{honoraires|Honoraires convenus}}.
Une provision de {{provision|Provision}} F CFA est demandée à la signature,
imputée sur les honoraires finals ; elle ne constitue pas le prix mais un
premier acompte.

ARTICLE 3 — FRAIS ET DÉBOURS
Les débours (droits d'enregistrement, frais d'huissier, déplacements,
transcriptions) sont refacturés en sus sur justificatifs ou forfaitisés à
{{debours|Modalité des débours}}.

ARTICLE 4 — FACTURATION ET RÉVISION
Facturation : {{facturation|Périodicité et modalités de facturation}}.
Les honoraires peuvent être révisés en cas d'extension de la mission, après
information du Client.

ARTICLE 5 — CONTESTATION
Toute contestation des honoraires est portée devant l'organe compétent de la
profession concernée avant saisine du juge.

Fait à {{lieu_signature|Lieu de signature}}, le {{date_signature|Date de
signature}}, en deux exemplaires originaux.

Le Client (lu et approuvé)                Le Cabinet
_______________________                   _______________________`,
  },
  {
    code: "TPL_LETTRE_MISSION",
    titre: "Lettre de mission / engagement",
    typeCode: "LETTRE_MISSION",
    validationMinimale: "JURISTE",
    contenu: `LETTRE DE MISSION
Référence : {{reference_transaction|Référence}}

{{cabinet_nom|Nom du cabinet}}
{{cabinet_adresse|Adresse du cabinet}}

À l'attention de : {{mandant_nom|Nom du client}}
{{mandant_adresse|Adresse du client}}

Objet : lettre de mission — {{objet_mission|Objet de la mission}}

Madame, Monsieur,

Vous nous avez demandé d'assurer la mission décrite ci-après ; nous vous
confirmons nos conditions d'intervention.

1. MISSION
{{description_mission|Description détaillée de la mission, travaux compris
et exclus, hypothèses}}.

2. LIVRABLES ET CALENDRIER
{{livrables|Livrables attendus}} — {{calendrier|Calendrier d'exécution}}.

3. HONORAIRES ET DÉBOURS
Honoraires : {{honoraires|Honoraires convenus (montant, mode de calcul)}}.
Débours : {{debours|Modalités des débours}}.
Facturation : {{facturation|Périodicité de facturation}}.

4. RESPONSABILITÉS
Le Cabinet est tenu à une obligation de moyens ; le Client s'engage à
communiquer les informations nécessaires à l'exécution de la mission.

5. CONFIDENTIALITÉ
Les informations échangées demeurent strictement confidentielles entre les
parties.

La présente lettre, signée par le Client, vaut contrat d'engagement entre
les parties.

Fait à {{lieu_signature|Lieu}}, le {{date_signature|Date}},
en deux exemplaires originaux.

Le Cabinet                                Le Client (bon pour accord)
_______________________                   _______________________`,
  },

  /* ============== Mandats & locations immobilières ============== */
  {
    code: "TPL_MANDAT_GESTION_LOCATIVE",
    titre: "Mandat de gestion locative",
    typeCode: "MANDAT_GESTION_LOCATIVE",
    validationMinimale: "JURISTE",
    contenu: `MANDAT DE GESTION LOCATIVE
Référence : {{reference_transaction|Référence}}

PRÉAMBULE
Le présent mandat de gestion est conclu entre les parties désignées ci-après,
en vue de confier au Mandataire la mission de gestion locative décrite à
l'article 3, conformément aux dispositions du Code des obligations civiles et
commerciales régissant le mandat.

ARTICLE 1 — PARTIES AU CONTRAT
Le Mandant (propriétaire) : {{mandant_nom|Nom complet du mandant}},
{{mandant_qualite|Qualité}}, domicilié à {{mandant_adresse|Adresse}},
tél. {{mandant_telephone|Téléphone}}, {{mandant_identite_piece|Pièce d'identité
ou RCCM}}.

Le Mandataire : {{mandataire_nom|Nom du mandataire}},
{{mandataire_qualite|Qualité / raison sociale}}, RCCM {{mandataire_rccm|RCCM le
cas échéant}}, sis à {{mandataire_adresse|Adresse}},
tél. {{mandataire_telephone|Téléphone}}.

ARTICLE 2 — NATURE ET DURÉE DU MANDAT
Type : mandat de gestion locative, à compter du {{date_debut|Date de début}}
pour une durée de {{duree|Durée / indéterminée}}.

ARTICLE 3 — ÉTENDUE DE LA MISSION
Le Mandataire est chargé, pour le compte du Mandant, de :
- rechercher et sélectionner les locataires ;
- rédiger et faire signer les baux de location ;
- percevoir les loyers et charges pour le compte du Mandant ;
- gérer les travaux d'entretien et réparations courantes dans la limite de
  {{plafond_travaux|Plafond par intervention sans accord préalable}} ;
- assurer le suivi administratif et comptable ;
- représenter le Mandant auprès des locataires et des tiers.

[[CONFIDENTIEL]]
ARTICLE 4 — RÉMUNÉRATION DU MANDATAIRE
Mode de calcul : {{mode_remuneration|Pourcentage / montant fixe}} —
{{remuneration|Taux ou montant}}, calculé {{base_calcul|Base de calcul (ex. :
sur les loyers encaissés TTC)}}, exigible à la perception du loyer.
[[/CONFIDENTIEL]]

ARTICLE 5 — BIENS COUVERTS PAR LE MANDAT
{{liste_biens|Liste des biens : désignation, référence, localisation, type,
surface, loyer mensuel, statut}}

ARTICLE 6 — OBLIGATIONS DES PARTIES
Le Mandant s'engage à fournir tous les documents utiles à la gestion, à
informer le Mandataire de toute modification affectant les biens, à régler
les charges et travaux hors mission du Mandataire et à respecter les
engagements tarifaires convenus.
Le Mandataire s'engage à exécuter la mission avec diligence et
professionnalisme, à rendre compte régulièrement de sa gestion, à reverser
les fonds perçus dans les délais convenus et à tenir une comptabilité
rigoureuse des opérations.

ARTICLE 7 — REVERSEMENTS
Les sommes encaissées pour le compte du Mandant sont reversées
{{periodicite_reversement|mensuellement / trimestriellement}}, au plus tard
le {{jour_reversement|jour}} du mois, par {{mode_reversement|virement /
espèces / chèque}}, déduction faite de la rémunération et des dépenses
dûment justifiées. Chaque reversement donne lieu à un reçu détaillé.

ARTICLE 8 — RÉSILIATION
Le présent mandat peut être résilié par l'une ou l'autre des parties, sous
réserve du respect d'un préavis de {{preavis|30}} jours notifié par lettre
recommandée avec accusé de réception. La résiliation anticipée sans motif
légitime expose la partie défaillante à des dommages et intérêts.

ARTICLE 9 — CONDITIONS PARTICULIÈRES
{{clauses_particulieres|Clauses particulières}}

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Le Mandant (signature + mention « Lu et approuvé »)
_______________________

Le Mandataire (signature + cachet)
_______________________`,
  },
  {
    code: "TPL_RECU_REVERSEMENT_BAILLEUR",
    titre: "Reçu de reversement au bailleur",
    typeCode: "MANDAT_GESTION_LOCATIVE",
    validationMinimale: "ASSISTANT",
    contenu: `REÇU DE REVERSEMENT
N° {{reference_transaction|Référence}}
Période : {{periode|Période concernée}} — Émis le {{date_signature|Date}}

Bailleur / bénéficiaire : {{mandant_nom|Nom du bailleur}},
{{mandant_adresse|Adresse}}, tél. {{mandant_telephone|Téléphone}}.

Mandataire : {{mandataire_nom|Nom du mandataire}}, {{mandataire_adresse|Adresse}}.

DÉTAIL DES SOMMES COLLECTÉES
{{detail_loyers|Biens / contrats concernés et loyers du mois}}

DÉCOMPTE FINANCIER
Loyers perçus : {{loyers_percus|Montant}} F CFA
Dépôts / avances inclus : {{depots_inclus|Montant le cas échéant}} F CFA
[[CONFIDENTIEL]]
Commission du mandataire : {{commission|Montant ou taux}} F CFA
[[/CONFIDENTIEL]]
Frais et dépenses déduits : {{frais_deduits|Montant et nature}} F CFA

Net reversé au bailleur : {{net_reverse|Montant}} F CFA
Date du versement : {{date_versement|Date}} — Mode : {{mode_versement|Mode}}

Le présent document atteste que {{mandataire_nom|le mandataire}} a procédé au
reversement de {{net_reverse|montant}} F CFA au bailleur {{mandant_nom|nom}}
au titre des sommes collectées pour la période de {{periode|période}}.

Signature du bailleur (reçu la somme de {{net_reverse|montant}} F CFA)
_______________________

Cachet et signature du mandataire
_______________________`,
  },
  {
    code: "TPL_MANDAT_VENTE_IMMO",
    titre: "Mandat de vente immobilière",
    typeCode: "MANDAT_VENTE_IMMO",
    validationMinimale: "JURISTE",
    contenu: `MANDAT DE VENTE
Référence : {{reference_transaction|Référence}}

ENTRE :
{{mandant_nom|Nom du mandant}}, {{mandant_qualite|Qualité}}, domicilié à
{{mandant_adresse|Adresse}}, ci-après « le Mandant »,

ET :
{{mandataire_nom|Nom du mandataire}}, {{mandataire_qualite|Qualité}}, sis à
{{mandataire_adresse|Adresse}}, ci-après « le Mandataire ».

ARTICLE 1 — OBJET
Le Mandant confie au Mandataire, qui l'accepte, la mission de rechercher un
acquéreur pour le bien désigné : {{designation_bien|Désignation du bien}},
sis à {{adresse_bien|Adresse}}, référence {{reference_bien|Référence / titre
foncier}}, superficie {{superficie|Superficie}}.
Le Mandant certifie être propriétaire du bien ou disposer du droit de le
vendre : {{justificatif_droit|Titre / justificatif}}.

ARTICLE 2 — ÉTENDUE ET NATURE
Mandat {{nature_mandat|simple / exclusif}} : le Mandataire procède à la
recherche, à la sélection et à la présentation des candidats acquéreurs, à
l'organisation des visites et à la coordination des négociations.
{{#if nature_mandat == "exclusif"}}Pendant la durée du mandat exclusif, le
Mandant s'interdit de vendre directement ou par un autre intermédiaire, sous
peine de versement au Mandataire de la pénalité prévue à l'article 4.{{/if}}

ARTICLE 3 — PRIX
Prix de mise en vente : {{prix_vente|Montant}} F CFA ; prix net vendeur :
{{prix_net_vendeur|Montant}} F CFA. Toute offre inférieure est soumise à
l'accord écrit du Mandant.

[[CONFIDENTIEL]]
ARTICLE 4 — RÉMUNÉRATION
Commission du Mandataire : {{commission|Taux ou montant}}, due au succès,
lors de la signature effective de l'acte de vente ou de la promesse
synallagmatique.
{{penalite_exclusivite|Pénalité en cas de vente directe pendant l'exclusivité}}
[[/CONFIDENTIEL]]

ARTICLE 5 — DURÉE
Le mandat est consenti pour {{duree|Durée}} à compter du
{{date_debut|Date de début}}, renouvelable {{renouvellement|par tacite
reconduction / par avenant}}. Résiliation : préavis de {{preavis|Durée}}
notifié par écrit.

ARTICLE 6 — CONDITIONS PARTICULIÈRES
{{clauses_particulieres|Clauses particulières}}

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Le Mandant (lu et approuvé)                  Le Mandataire
_______________________                      _______________________`,
  },
  {
    code: "TPL_BAIL_SAISONNIER",
    titre: "Contrat de location meublée de courte durée",
    typeCode: "BAIL_SAISONNIER",
    validationMinimale: "JURISTE",
    contenu: `CONTRAT DE LOCATION MEUBLÉE DE COURTE DURÉE
Référence : {{reference_transaction|Référence}}

ARTICLE 1 — PARTIES AU CONTRAT
Le Bailleur : {{bailleur_nom|Nom du bailleur}}, {{bailleur_qualite|Qualité}},
domicilié à {{bailleur_adresse|Adresse}}, tél. {{bailleur_telephone|Téléphone}}.
Le Locataire : {{locataire_nom|Nom du locataire}},
{{locataire_identite_piece|Pièce d'identité}}, demeurant à
{{locataire_adresse|Adresse}}, tél. {{locataire_telephone|Téléphone}}.

ARTICLE 2 — DÉSIGNATION DU BIEN LOUÉ
{{designation_bien|Désignation du logement meublé}}, sis à
{{adresse_bien|Adresse}}, superficie {{superficie|Superficie}},
{{nb_pieces|Pièces}} pièces dont {{nb_chambres|Chambres}} chambres, étage
{{etage|Étage}}. L'inventaire du mobilier est annexé au présent contrat.

ARTICLE 3 — DURÉE DU SÉJOUR
Arrivée (check-in) : {{date_arrivee|Date et heure d'arrivée}} ;
départ (check-out) : {{date_depart|Date et heure de départ}} ;
durée : {{nb_nuits|Nombre de nuits}} nuits.
Le séjour est ponctuel et ne donne lieu à aucune tacite reconduction ni
droit au maintien dans les lieux.

ARTICLE 4 — CONDITIONS FINANCIÈRES
Tarif par nuit : {{tarif_nuit|Montant}} F CFA, soit un total séjour de
{{total_sejour|Montant}} F CFA.
Frais annexes : {{frais_annexes|Ménage, électricité, forfaits — montants}}.
Caution : {{caution|Montant}} F CFA, versée à l'arrivée et restituée au
départ après état des lieux contradictoire, déduction faite des
dégradations constatées.
Mode de règlement : {{mode_reglement|Espèces / virement / mobile money}}.
Total à régler à l'arrivée : {{total_arrivee|Montant}} F CFA.

ARTICLE 5 — OBLIGATIONS DES PARTIES
Le Bailleur s'engage à délivrer le logement en bon état d'usage, meublé et
équipé conformément à l'inventaire, et à assurer la jouissance paisible du
séjour.
Le Locataire s'engage à occuper le logement en bon père de famille, à en
respecter la destination, à n'y excéder {{nb_occupants|Nombre}} occupants,
à ne pas sous-louer, à régler les sommes dues et à restituer le logement
dans l'état constaté à l'arrivée.

ARTICLE 6 — ÉTAT DES LIEUX
Un état des lieux d'entrée est dressé contradictoirement à l'arrivée ; un
état des lieux de sortie est dressé au départ. Ils sont annexés au contrat
et font foi entre les parties.

ARTICLE 7 — CONDITIONS PARTICULIÈRES
{{clauses_particulieres|Horaires d'arrivée et de départ, ménage, animaux,
etc.}}

${CLAUSE_CABINET}
${SIGNATURE_FIN}

Le Bailleur (lu et approuvé)                 Le Locataire (lu et approuvé)
_______________________                      _______________________`,
  },
];

/* ------------------------------------------------------------------ */
/* Application                                                         */
/* ------------------------------------------------------------------ */
(async () => {
  const pub = new PublicClient();
  let tenants = await pub.tenant.findMany();
  if (TENANT_ARG) tenants = tenants.filter((t) => t.slug === TENANT_ARG || t.id === TENANT_ARG);
  const base = process.env.DATABASE_URL;

  for (const t of tenants) {
    const url = t.databaseUrl || `${base}${base.includes("?") ? "&" : "?"}schema=${t.schemaName}`;
    const db = new TenantClient({ datasources: { db: { url } } });
    console.log(`\n===== TENANT ${t.slug || t.id} (${t.schemaName}) =====`);

    const typeIds = {};
    for (const spec of TYPES) {
      const { pieces, ...typeData } = spec;
      if (DRY_RUN) {
        console.log(`  [dry] type ${spec.code} (${pieces.length} pièces)`);
        continue;
      }
      const type = await db.transactionType.upsert({
        where: { code: spec.code },
        create: { ...typeData, pieces: { create: pieces.map((pc, i) => ({ ...pc, condition: pc.condition || null, ordre: i + 1 })) } },
        update: {},
      });
      typeIds[spec.code] = type.id;
      const existantes = await db.transactionTypePiece.findMany({ where: { typeId: type.id }, select: { code: true } });
      const codes = new Set(existantes.map((x) => x.code));
      const manquantes = pieces.filter((x) => !codes.has(x.code));
      if (manquantes.length) {
        await db.transactionTypePiece.createMany({
          data: manquantes.map((pc) => ({ ...pc, condition: pc.condition || null, typeId: type.id, ordre: pieces.indexOf(pc) + 1 })),
        });
        console.log(`  + ${manquantes.length} pièces ajoutées à ${spec.code}`);
      }
      console.log(`  type ${spec.code} OK (${pieces.length} pièces)`);
    }

    for (const m of MODELES) {
      if (DRY_RUN) {
        console.log(`  [dry] modèle ${m.code}`);
        continue;
      }
      const { typeCode, ...data } = m;
      await db.transactionModele.upsert({
        where: { code: m.code },
        create: { ...data, typeId: typeCode ? typeIds[typeCode] || null : null },
        update: {},
      });
      console.log(`  modèle ${m.code} OK`);
    }

    await db.$disconnect();
  }
  await pub.$disconnect();
  console.log("\nTerminé.");
})();
