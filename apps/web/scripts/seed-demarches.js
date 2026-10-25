/**
 * Seed du module « Démarches administratives » (foncier, urbanisme,
 * fiscalité — Sénégal) : catalogue des 16 types, check-lists de pièces,
 * autorités par défaut et modèles de documents TPL_*.
 *
 * Idempotent : upsert par code. Les modifications de paramétrage faites
 * dans l'interface ne sont PAS écrasées : seules les lignes manquantes
 * sont créées (les pièces/types/modèles existants sont laissés tels quels).
 *
 * Usage : node scripts/seed-demarches.js [--dry-run] [--tenant=<slug>]
 */
process.loadEnvFile(".env");
const { PrismaClient: TenantClient } = require("@prisma/client");
const { PrismaClient: PublicClient } = require("../prisma/generated/public");

const DRY_RUN = process.argv.includes("--dry-run");
const TENANT_ARG = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1];

/* ------------------------------------------------------------------ */
/* Catalogue des types + check-lists                                   */
/* ------------------------------------------------------------------ */
// Catégories : DIC = DOCUMENT_INTERNE_CABINET, DAO = DOCUMENT_ADMINISTRATIF_A_OBTENIR,
// PC = PIECE_CLIENT, PT = PIECE_TECHNIQUE, PDS = PREUVE_DE_DEPOT_ET_SUIVI
const TYPES = [
  {
    code: "URB_LOTIR",
    libelle: "Autorisation de lotir",
    famille: "URBANISME",
    autoritePrincipale: "Maire de la commune d'implantation",
    natureResultat: "Autorisation administrative",
    parcelleRequise: true,
    nbExemplaires: 3,
    avertissement:
      "L'autorisation de lotir est délivrée par le maire compétent. Le cabinet prépare et suit le dossier sans garantir la décision.",
    pieces: [
      { code: "demande_maire", libelle: "Demande manuscrite ou lettre adressée au maire compétent", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "titre_propriete", libelle: "Titre foncier ou titre de propriété", categorie: "PIECE_CLIENT" },
      { code: "fiche_renseignement", libelle: "Fiche de renseignement", categorie: "PIECE_CLIENT" },
      { code: "devis_descriptif", libelle: "Devis descriptif et estimatif des travaux", categorie: "PIECE_TECHNIQUE", sourceAttendue: "ARCHITECTE" },
      { code: "plan_lotissement", libelle: "Plan de lotissement / plans techniques", categorie: "PIECE_TECHNIQUE", sourceAttendue: "GEOMETRE" },
      { code: "assainissement", libelle: "Dispositif d'assainissement", categorie: "PIECE_TECHNIQUE", sourceAttendue: "ARCHITECTE" },
      { code: "extrait_plan_cadastral", libelle: "Extrait de plan cadastral visé", categorie: "DOCUMENT_ADMINISTRATIF_A_OBTENIR", sourceAttendue: "ADMINISTRATION" },
      { code: "taxe_urbanisme", libelle: "Justificatif de paiement de la taxe d'urbanisme", categorie: "PIECE_CLIENT" },
      { code: "timbre_fiscal", libelle: "Timbre fiscal", categorie: "PIECE_CLIENT" },
      { code: "procuration", libelle: "Procuration (si dépôt par mandataire)", categorie: "PIECE_CLIENT", niveau: "CONDITIONNELLE", condition: "Dépôt par le cabinet ou un mandataire" },
      { code: "recepisse", libelle: "Récépissé de dépôt", categorie: "PREUVE_DE_DEPOT_ET_SUIVI", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "URB_CONSTRUIRE",
    libelle: "Autorisation de construire",
    famille: "URBANISME",
    autoritePrincipale: "Maire de la commune d'implantation",
    natureResultat: "Autorisation administrative",
    parcelleRequise: true,
    nbExemplaires: 2,
    avertissement:
      "2 exemplaires pour un dossier simple, 3 pour un dossier complexe — règle paramétrable. La décision appartient à la commune.",
    pieces: [
      { code: "demande_maire", libelle: "Demande manuscrite ou lettre adressée au maire compétent", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "titre_propriete", libelle: "Titre de propriété (titre foncier, bail, délibération)", categorie: "PIECE_CLIENT" },
      { code: "fiche_renseignement", libelle: "Fiche de renseignement", categorie: "PIECE_CLIENT" },
      { code: "devis_descriptif", libelle: "Devis descriptif et estimatif", categorie: "PIECE_TECHNIQUE", sourceAttendue: "ARCHITECTE" },
      { code: "plans_architecte", libelle: "Plans architecturaux visés", categorie: "PIECE_TECHNIQUE", sourceAttendue: "ARCHITECTE" },
      { code: "assainissement", libelle: "Dispositif d'assainissement", categorie: "PIECE_TECHNIQUE", sourceAttendue: "ARCHITECTE" },
      { code: "extrait_plan_cadastral", libelle: "Extrait de plan cadastral visé", categorie: "DOCUMENT_ADMINISTRATIF_A_OBTENIR", sourceAttendue: "ADMINISTRATION" },
      { code: "taxe_urbanisme", libelle: "Taxe d'urbanisme (preuve de paiement)", categorie: "PIECE_CLIENT" },
      { code: "timbre_fiscal", libelle: "Timbre fiscal", categorie: "PIECE_CLIENT" },
      { code: "procuration", libelle: "Procuration (si dépôt par mandataire)", categorie: "PIECE_CLIENT", niveau: "CONDITIONNELLE", condition: "Dépôt par le cabinet ou un mandataire" },
      { code: "recepisse", libelle: "Récépissé de dépôt", categorie: "PREUVE_DE_DEPOT_ET_SUIVI", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "CAD_AVIS_FAVORABLE",
    libelle: "Avis favorable cadastral / technique",
    famille: "CADASTRE",
    autoritePrincipale: "Service compétent à préciser selon l'objet",
    natureResultat: "Avis",
    qualificationObligatoire: true,
    avertissement:
      "Demande potentiellement ambiguë : préciser l'objet de l'avis, le service sollicité et l'opération concernée avant toute préparation.",
    sousTypes: [
      { code: "AVIS_CONFORMITE_PLAN", libelle: "Avis de conformité de plan" },
      { code: "AVIS_PREALABLE", libelle: "Avis préalable" },
      { code: "AVIS_IDENTIFICATION", libelle: "Avis / identification de parcelle" },
      { code: "AVIS_TECHNIQUE", libelle: "Avis technique (préciser)" },
      { code: "AUTRE", libelle: "Autre (préciser)" },
    ],
    pieces: [
      { code: "demande_qualifiee", libelle: "Demande précisant l'objet de l'avis et le service sollicité", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "justificatif_droit", libelle: "Justificatif du droit du demandeur", categorie: "PIECE_CLIENT" },
      { code: "plan_parcelle", libelle: "Plan ou croquis de la parcelle", categorie: "PIECE_TECHNIQUE", niveau: "CONDITIONNELLE" },
      { code: "piece_identite", libelle: "Pièce d'identité du demandeur", categorie: "PIECE_CLIENT" },
      { code: "recepisse", libelle: "Récépissé de dépôt", categorie: "PREUVE_DE_DEPOT_ET_SUIVI", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "CAD_EXTRAIT_PLAN",
    libelle: "Extrait de plan cadastral certifié",
    famille: "CADASTRE",
    autoritePrincipale: "Bureau du Cadastre de la localité de la parcelle",
    natureResultat: "Extrait certifié",
    parcelleRequise: true,
    pieces: [
      { code: "demande_bureau", libelle: "Demande adressée au Bureau du Cadastre compétent", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "titre_ou_acte", libelle: "Copie du titre foncier ou de l'acte d'attribution", categorie: "PIECE_CLIENT" },
      { code: "piece_identite", libelle: "Pièce d'identité du propriétaire ou mandataire", categorie: "PIECE_CLIENT" },
      { code: "references_parcelle", libelle: "Références de la parcelle (localisation, NICAD)", categorie: "PIECE_CLIENT" },
      { code: "recepisse", libelle: "Récépissé de dépôt", categorie: "PREUVE_DE_DEPOT_ET_SUIVI", sourceAttendue: "ADMINISTRATION" },
      { code: "extrait_delivre", libelle: "Extrait de plan cadastral certifié délivré", categorie: "DOCUMENT_ADMINISTRATIF_A_OBTENIR", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "CAD_CIC",
    libelle: "Certificat d'identification cadastrale (CIC)",
    famille: "CADASTRE",
    autoritePrincipale: "Bureau du Cadastre compétent",
    natureResultat: "Certificat",
    parcelleRequise: true,
    pieces: [
      { code: "demande_bureau", libelle: "Demande adressée au Bureau du Cadastre", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "justificatif_droit", libelle: "Justificatif du droit du demandeur (titre, acte, attestation)", categorie: "PIECE_CLIENT" },
      { code: "piece_identite", libelle: "Pièce d'identité du demandeur", categorie: "PIECE_CLIENT" },
      { code: "plan_situation", libelle: "Plan de situation", categorie: "PIECE_TECHNIQUE", niveau: "CONDITIONNELLE" },
      { code: "recepisse", libelle: "Récépissé de dépôt", categorie: "PREUVE_DE_DEPOT_ET_SUIVI", sourceAttendue: "ADMINISTRATION" },
      { code: "cic_delivre", libelle: "CIC délivré", categorie: "DOCUMENT_ADMINISTRATIF_A_OBTENIR", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "CAD_NICAD",
    libelle: "Attribution / recherche de NICAD",
    famille: "CADASTRE",
    autoritePrincipale: "Bureau du Cadastre de la localité de la parcelle",
    natureResultat: "Attribution NICAD",
    parcelleRequise: true,
    pieces: [
      { code: "demande_bureau", libelle: "Demande adressée au Bureau du Cadastre compétent (localité de la parcelle)", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "titre_ou_acte", libelle: "Copie du titre foncier ou de l'acte d'attribution", categorie: "PIECE_CLIENT" },
      { code: "plan_situation", libelle: "Plan de situation", categorie: "PIECE_TECHNIQUE" },
      { code: "piece_identite", libelle: "Pièce d'identité du propriétaire", categorie: "PIECE_CLIENT" },
      { code: "recepisse", libelle: "Récépissé de dépôt", categorie: "PREUVE_DE_DEPOT_ET_SUIVI", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "FON_RAD",
    libelle: "Radiation d'inscription ou de charge",
    famille: "LIVRE_FONCIER",
    autoritePrincipale: "Conservation foncière compétente",
    natureResultat: "Radiation au registre foncier",
    qualificationObligatoire: true,
    parcelleRequise: true,
    avertissement:
      "Qualification obligatoire : préciser ce qui est radié (hypothèque, prénotation, saisie, inscription, servitude, bail…) et le fondement.",
    sousTypes: [
      { code: "HYPOTHEQUE", libelle: "Radiation d'hypothèque" },
      { code: "PRENOTATION", libelle: "Radiation de prénotation" },
      { code: "SAISIE", libelle: "Radiation de saisie" },
      { code: "INSCRIPTION", libelle: "Radiation d'inscription" },
      { code: "SERVITUDE", libelle: "Radiation de servitude" },
      { code: "BAIL", libelle: "Radiation de bail inscrit" },
      { code: "AUTRE", libelle: "Autre (préciser)" },
    ],
    pieces: [
      { code: "demande_radiation", libelle: "Demande de radiation qualifiée (inscription visée + motif juridique)", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "certificat_mainlevee", libelle: "Mainlevée, certificat ou acte justifiant l'extinction", categorie: "PIECE_CLIENT" },
      { code: "piece_identite", libelle: "Pièce d'identité du demandeur / mandataire", categorie: "PIECE_CLIENT" },
      { code: "reference_inscription", libelle: "Référence de l'inscription à radier (livre foncier)", categorie: "PIECE_CLIENT" },
      { code: "recepisse", libelle: "Récépissé de dépôt", categorie: "PREUVE_DE_DEPOT_ET_SUIVI", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "FON_MAINLEVEE",
    libelle: "Mainlevée",
    famille: "LIVRE_FONCIER",
    autoritePrincipale: "Selon la sûreté : créancier (amiable) ou juridiction (judiciaire)",
    natureResultat: "Certificat ou acte de mainlevée",
    qualificationObligatoire: true,
    parcelleRequise: true,
    avertissement:
      "Préciser : mainlevée amiable ou judiciaire, créancier, dette éteinte et référence de la sûreté.",
    sousTypes: [
      { code: "AMIABLE", libelle: "Mainlevée amiable" },
      { code: "JUDICIAIRE", libelle: "Mainlevée judiciaire" },
      { code: "PARTIELLE", libelle: "Mainlevée partielle" },
      { code: "AUTRE", libelle: "Autre (préciser)" },
    ],
    pieces: [
      { code: "acte_juridique", libelle: "Acte ou jugement fondant la mainlevée", categorie: "PIECE_CLIENT" },
      { code: "reference_inscription", libelle: "Référence de la sûreté / inscription concernée", categorie: "PIECE_CLIENT" },
      { code: "justificatif_dette", libelle: "Justificatif d'extinction de la dette ou de l'obligation", categorie: "PIECE_CLIENT" },
      { code: "piece_identite", libelle: "Pièce d'identité du demandeur / mandataire", categorie: "PIECE_CLIENT" },
      { code: "mainlevee_delivree", libelle: "Mainlevée obtenue", categorie: "DOCUMENT_ADMINISTRATIF_A_OBTENIR", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "ADM_DUPLICATA",
    libelle: "Duplicata d'un document administratif",
    famille: "TRANSVERSAL",
    autoritePrincipale: "Administration émettrice du document original",
    natureResultat: "Duplicata",
    qualificationObligatoire: true,
    avertissement:
      "Préciser la nature du document, l'autorité émettrice et le motif (perte, vol, détérioration).",
    sousTypes: [
      { code: "PERTE", libelle: "Perte du document" },
      { code: "VOL", libelle: "Vol du document" },
      { code: "DETERIORATION", libelle: "Détérioration du document" },
      { code: "AUTRE", libelle: "Autre motif (préciser)" },
    ],
    pieces: [
      { code: "demande_duplicata", libelle: "Demande de duplicata qualifiée (document + autorité + motif)", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "decl_perte", libelle: "Déclaration de perte / vol ou justificatif du motif", categorie: "PIECE_CLIENT", niveau: "CONDITIONNELLE" },
      { code: "piece_identite", libelle: "Pièce d'identité du demandeur", categorie: "PIECE_CLIENT" },
      { code: "copie_original", libelle: "Copie ou référence du document original si disponible", categorie: "PIECE_CLIENT", niveau: "CONDITIONNELLE" },
      { code: "recepisse", libelle: "Récépissé de dépôt", categorie: "PREUVE_DE_DEPOT_ET_SUIVI", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "FIS_ENREG_PROC",
    libelle: "Enregistrement d'un acte ou d'une procédure",
    famille: "FISCALITE",
    autoritePrincipale: "Direction de l'Enregistrement, des Domaines et du Timbre",
    natureResultat: "Enregistrement / droit liquidé",
    qualificationObligatoire: true,
    avertissement:
      "Préciser la nature exacte de l'acte ou de la décision à enregistrer — le régime de droits en dépend.",
    sousTypes: [
      { code: "BAIL", libelle: "Bail" },
      { code: "VENTE", libelle: "Vente" },
      { code: "DONATION", libelle: "Donation" },
      { code: "JUGEMENT", libelle: "Jugement" },
      { code: "CONVENTION", libelle: "Convention" },
      { code: "MANDAT", libelle: "Mandat / procuration" },
      { code: "ACTE_SOCIETE", libelle: "Acte de société" },
      { code: "AUTRE", libelle: "Autre (préciser)" },
    ],
    pieces: [
      { code: "acte_original", libelle: "Acte ou décision à enregistrer (original + copies)", categorie: "PIECE_CLIENT" },
      { code: "piece_identite", libelle: "Pièce d'identité du déclarant", categorie: "PIECE_CLIENT" },
      { code: "documents_societe", libelle: "Documents de société (statuts, NINEA) si applicable", categorie: "PIECE_CLIENT", niveau: "CONDITIONNELLE" },
      { code: "declaration", libelle: "Déclaration fiscale jointe", categorie: "DOCUMENT_INTERNE_CABINET", niveau: "CONDITIONNELLE" },
      { code: "quittance", libelle: "Quittance / preuve de paiement des droits", categorie: "PREUVE_DE_DEPOT_ET_SUIVI", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "FIS_DECES",
    libelle: "Déclaration après décès",
    famille: "FISCALITE",
    autoritePrincipale: "Centre des services fiscaux du domicile du défunt",
    natureResultat: "Déclaration / quittances de succession",
    qualificationObligatoire: true,
    sensible: true,
    validationAvocat: true,
    avertissement:
      "Dossier sensible : succession, héritiers, actifs, passifs, biens immobiliers, testament et qualité du déclarant à documenter. Validation avocat requise.",
    sousTypes: [
      { code: "SUCCESSION_SIMPLE", libelle: "Succession simple" },
      { code: "SUCCESSION_TESTAMENT", libelle: "Succession avec testament" },
      { code: "SUCCESSION_IMMOBILIERE", libelle: "Succession avec biens immobiliers" },
      { code: "AUTRE", libelle: "Autre (préciser)" },
    ],
    pieces: [
      { code: "declaration_succession", libelle: "Déclaration de succession complétée", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "acte_deces", libelle: "Acte de décès du défunt", categorie: "PIECE_CLIENT" },
      { code: "pieces_heritiers", libelle: "Pièces d'identité et actes des héritiers", categorie: "PIECE_CLIENT" },
      { code: "acte_notoriete", libelle: "Acte de notoriété / jugement héréditaire", categorie: "PIECE_CLIENT" },
      { code: "titres_propriete", libelle: "Titres et documents des biens de la succession", categorie: "PIECE_CLIENT" },
      { code: "testament", libelle: "Testament (s'il existe)", categorie: "PIECE_CLIENT", niveau: "CONDITIONNELLE" },
      { code: "quittance_succession", libelle: "Quittances de succession", categorie: "DOCUMENT_ADMINISTRATIF_A_OBTENIR", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "FIS_NON_IMPOSITION",
    libelle: "Attestation de non-imposition",
    famille: "FISCALITE",
    autoritePrincipale: "Centre des services fiscaux du domicile",
    natureResultat: "Attestation",
    avertissement:
      "Délivrée par le CSF du domicile — vérifier la cohérence adresse / centre compétent.",
    pieces: [
      { code: "demande_csf", libelle: "Demande adressée au Centre des services fiscaux compétent", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "attestation_chomage", libelle: "Attestation de chômage", categorie: "PIECE_CLIENT" },
      { code: "piece_identite", libelle: "Copie de la CNI", categorie: "PIECE_CLIENT" },
      { code: "certificat_residence", libelle: "Certificat de résidence ou de domicile", categorie: "PIECE_CLIENT" },
      { code: "attestation_hebergement", libelle: "Attestation d'hébergement (si applicable)", categorie: "PIECE_CLIENT", niveau: "CONDITIONNELLE" },
      { code: "recepisse", libelle: "Récépissé de dépôt", categorie: "PREUVE_DE_DEPOT_ET_SUIVI", sourceAttendue: "ADMINISTRATION" },
      { code: "attestation_delivree", libelle: "Attestation de non-imposition délivrée", categorie: "DOCUMENT_ADMINISTRATIF_A_OBTENIR", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "FIS_AVIS_IMPOSITION",
    libelle: "Avis / attestation d'imposition",
    famille: "FISCALITE",
    autoritePrincipale: "Centre des services fiscaux compétent",
    natureResultat: "Avis / attestation",
    pieces: [
      { code: "demande_csf", libelle: "Demande adressée au Centre des services fiscaux", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "declaration_fiscale", libelle: "Déclaration fiscale", categorie: "PIECE_CLIENT" },
      { code: "bulletin_salaire", libelle: "Bulletin de salaire (salariés)", categorie: "PIECE_CLIENT", niveau: "CONDITIONNELLE", condition: "Demandeur salarié" },
      { code: "piece_identite", libelle: "CNI du demandeur", categorie: "PIECE_CLIENT" },
      { code: "preuve_domicile", libelle: "Certificat de résidence ou de domicile", categorie: "PIECE_CLIENT" },
      { code: "recepisse", libelle: "Récépissé de dépôt", categorie: "PREUVE_DE_DEPOT_ET_SUIVI", sourceAttendue: "ADMINISTRATION" },
      { code: "avis_delivre", libelle: "Avis / attestation d'imposition délivré", categorie: "DOCUMENT_ADMINISTRATIF_A_OBTENIR", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "DOM_BAIL_TF",
    libelle: "Transformation d'un bail en titre foncier",
    famille: "DOMAINES",
    autoritePrincipale: "Direction de l'Enregistrement, des Domaines et du Timbre",
    natureResultat: "Titre foncier",
    parcelleRequise: true,
    sensible: true,
    avertissement:
      "Circuit long : instruction par les services compétents et le cas échéant une commission ad hoc. Vérifier la concordance titulaire / titre d'occupation.",
    pieces: [
      { code: "demande_dedt", libelle: "Demande adressée à la Direction de l'Enregistrement, des Domaines et du Timbre", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "copie_bail", libelle: "Copie certifiée conforme du bail (et de son certificat d'enregistrement)", categorie: "PIECE_CLIENT" },
      { code: "piece_identite", libelle: "Copie certifiée de la CNI ou documents de société", categorie: "PIECE_CLIENT" },
      { code: "quittance_redevances", libelle: "Quittances prouvant le paiement des redevances d'occupation", categorie: "PIECE_CLIENT" },
      { code: "plans_parcelle", libelle: "Plans / références cadastrales de la parcelle (NICAD)", categorie: "PIECE_TECHNIQUE" },
      { code: "pouvoirs_signataire", libelle: "Pièces justifiant les pouvoirs du signataire / régime matrimonial", categorie: "PIECE_CLIENT", niveau: "CONDITIONNELLE" },
      { code: "recepisse", libelle: "Récépissé de dépôt", categorie: "PREUVE_DE_DEPOT_ET_SUIVI", sourceAttendue: "ADMINISTRATION" },
      { code: "titre_delivre", libelle: "Titre foncier délivré", categorie: "DOCUMENT_ADMINISTRATIF_A_OBTENIR", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "DOM_PERMIS_TF",
    libelle: "Transformation d'un permis / autorisation d'occuper en titre foncier",
    famille: "DOMAINES",
    autoritePrincipale: "Direction de l'Enregistrement, des Domaines et du Timbre",
    natureResultat: "Titre foncier",
    parcelleRequise: true,
    sensible: true,
    avertissement:
      "Permis ou autorisation d'occuper — vérifier la concordance titulaire / titre d'occupation et l'état des redevances.",
    pieces: [
      { code: "demande_dedt", libelle: "Demande adressée à la Direction de l'Enregistrement, des Domaines et du Timbre", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "copie_titre_occupation", libelle: "Copie certifiée conforme du permis / de l'autorisation d'occuper", categorie: "PIECE_CLIENT" },
      { code: "piece_identite", libelle: "Copie certifiée de la CNI ou documents de société", categorie: "PIECE_CLIENT" },
      { code: "quittance_redevances", libelle: "Quittances prouvant le paiement des redevances d'occupation", categorie: "PIECE_CLIENT" },
      { code: "plans_parcelle", libelle: "Plans / références cadastrales de la parcelle (NICAD)", categorie: "PIECE_TECHNIQUE" },
      { code: "pouvoirs_signataire", libelle: "Pièces justifiant les pouvoirs du signataire / régime matrimonial", categorie: "PIECE_CLIENT", niveau: "CONDITIONNELLE" },
      { code: "recepisse", libelle: "Récépissé de dépôt", categorie: "PREUVE_DE_DEPOT_ET_SUIVI", sourceAttendue: "ADMINISTRATION" },
      { code: "titre_delivre", libelle: "Titre foncier délivré", categorie: "DOCUMENT_ADMINISTRATIF_A_OBTENIR", sourceAttendue: "ADMINISTRATION" },
    ],
  },
  {
    code: "FIS_ACQUIESCEMENT",
    libelle: "Acte d'acquiescement fiscal",
    famille: "FISCALITE",
    autoritePrincipale: "Service fiscal émetteur de la décision",
    natureResultat: "Acquiescement enregistré",
    qualificationObligatoire: true,
    sensible: true,
    validationAvocat: true,
    avertissement:
      "Décision, impôt, période, montant et portée à qualifier. Validation avocat / fiscaliste et confirmation explicite du client requises avant génération finale.",
    sousTypes: [
      { code: "AVIS_IMPOSITION", libelle: "Acquiescement à un avis d'imposition" },
      { code: "REDRESSEMENT", libelle: "Acquiescement à un redressement" },
      { code: "TAXATION_OFFICE", libelle: "Acquiescement à une taxation" },
      { code: "AUTRE", libelle: "Autre (préciser)" },
    ],
    pieces: [
      { code: "copie_acte", libelle: "Copie de l'avis, décision, proposition de redressement ou acte visé", categorie: "PIECE_CLIENT" },
      { code: "acte_acquiescement", libelle: "Lettre / acte d'acquiescement explicite (références, montant, période, portée)", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "identite_ninea", libelle: "Pièce d'identité et/ou NINEA du signataire", categorie: "PIECE_CLIENT" },
      { code: "pouvoirs_signataire", libelle: "Justificatif des pouvoirs du signataire", categorie: "PIECE_CLIENT" },
      { code: "procuration", libelle: "Mandat / procuration du cabinet", categorie: "PIECE_CLIENT", niveau: "CONDITIONNELLE" },
      { code: "calculs_paiement", libelle: "Calculs, échéancier ou preuve de paiement", categorie: "PIECE_TECHNIQUE", niveau: "CONDITIONNELLE" },
      { code: "note_conseil", libelle: "Note de conseil approuvée par avocat / fiscaliste", categorie: "DOCUMENT_INTERNE_CABINET" },
      { code: "confirmation_client", libelle: "Confirmation explicite écrite du client", categorie: "PIECE_CLIENT" },
      { code: "preuve_depot", libelle: "Preuve de dépôt / transmission", categorie: "PREUVE_DE_DEPOT_ET_SUIVI" },
      { code: "accuse_admin", libelle: "Accusé / décision administrative", categorie: "DOCUMENT_ADMINISTRATIF_A_OBTENIR", sourceAttendue: "ADMINISTRATION" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Autorités par défaut (paramétrables ensuite)                        */
/* ------------------------------------------------------------------ */
const AUTORITES = [
  { nom: "Mairie de Dakar", typeAutorite: "MAIRIE", commune: "Dakar", region: "Dakar", adresse: "Place de l'Indépendance, Dakar" },
  { nom: "Bureau du Cadastre de Dakar", typeAutorite: "CADASTRE", commune: "Dakar", region: "Dakar" },
  { nom: "DGID — Direction de l'Enregistrement, des Domaines et du Timbre", typeAutorite: "DGID", commune: "Dakar", region: "Dakar" },
  { nom: "Centre des services fiscaux de Dakar-Plateau", typeAutorite: "CENTRE_FISCAL", commune: "Dakar", region: "Dakar" },
  { nom: "Centre des services fiscaux de Dakar-Sud", typeAutorite: "CENTRE_FISCAL", commune: "Dakar", region: "Dakar" },
  { nom: "Conservation foncière de Dakar", typeAutorite: "CONSERVATION", commune: "Dakar", region: "Dakar" },
  { nom: "Direction de l'Urbanisme et de l'Habitat", typeAutorite: "AUTRE", commune: "Dakar", region: "Dakar" },
];

/* ------------------------------------------------------------------ */
/* Modèles de documents TPL_*                                          */
/* ------------------------------------------------------------------ */
const MODELES = [
  {
    code: "TPL_DEMANDE_ADMINISTRATIVE",
    titre: "Demande administrative (générique)",
    typeCode: null,
    ordre: 1,
    contenu: `{{ville|Ville}}, le {{date|Date}}

À Monsieur / Madame [Titre et fonction du destinataire]
{{autorite|Autorité destinataire}}
{{adresse_depot|Adresse de l'autorité}}

Objet : {{objet|Objet de la demande}}
Réf. dossier : {{reference_demarche|Référence}}

Madame, Monsieur,

{{corps_demande|Corps de la demande — explication précise de l'objet, du bien ou de l'acte visé, et de la finalité}}

Demandeur : {{demandeur_nom_complet|Nom complet du demandeur}}
En qualité de : {{qualite_demandeur|Qualité du demandeur}}
Domicilié à : {{adresse_demandeur|Adresse du demandeur}}

Bien / parcelle concerné : {{localisation_parcelle|Localisation de la parcelle}}
Références foncières : {{references_foncieres|Références (TF, NICAD, bail…)}}

Nous joignons à la présente les pièces suivantes :
{{liste_pieces|Liste des pièces jointes}}

Dans l'attente de votre réponse, nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.

{{signataire_nom|Nom et prénom du signataire}}
{{signataire_qualite|Qualité du signataire}}`,
  },
  {
    code: "TPL_PROCURATION",
    titre: "Procuration",
    typeCode: null,
    ordre: 2,
    contenu: `PROCURATION

Je soussigné(e), {{demandeur_nom_complet|Nom complet du mandant}}, en qualité de {{qualite_demandeur|Qualité}}, domicilié(e) à {{adresse_demandeur|Adresse du mandant}},

donne par la présente procuration à {{nom_cabinet|Nom du cabinet}}, représenté par {{signataire_nom|Nom du mandataire du cabinet}}, à l'effet de :

— préparer, signer et déposer toute demande relative à : {{objet|Objet de la démarche}} ;
— recevoir les correspondances, récépissés et documents administratifs ;
— produire toute pièce complémentaire demandée par l'administration ;
— retirer et remettre le document final au mandant ou son représentant.

La présente procuration est valable pour la seule démarche décrite ci-dessus.

{{ville|Ville}}, le {{date|Date}}

Le mandant
Signature`,
  },
  {
    code: "TPL_BORDEREAU_DEPOT",
    titre: "Bordereau de dépôt",
    typeCode: null,
    ordre: 3,
    contenu: `BORDEREAU DE DÉPÔT

Référence : {{reference_demarche|Référence}}
Démarche : {{type_demarche|Type de démarche}} — {{objet|Objet}}
Demandeur : {{demandeur_nom_complet|Nom complet du demandeur}}
Autorité destinataire : {{autorite|Autorité destinataire}}
Adresse de dépôt : {{adresse_depot|Adresse de dépôt}}
Nombre d'exemplaires : {{nb_exemplaires|Nombre d'exemplaires}}

Pièces constituant le paquet :
{{liste_pieces|Liste des pièces}}

Déposé le : {{date_depot|Date de dépôt}}
Déposé par : {{depose_par|Nom du déposant}}
Canal : {{canal_depot|Canal de dépôt}}

Récépissé / visa de l'administration : [Visa et numéro de récépissé]`,
  },
  {
    code: "TPL_RELANCE",
    titre: "Lettre de relance",
    typeCode: null,
    ordre: 4,
    contenu: `{{ville|Ville}}, le {{date|Date}}

À Monsieur / Madame [Titre et fonction du destinataire]
{{autorite|Autorité destinataire}}

Objet : Relance — {{type_demarche|Type de démarche}}
Votre référence / récépissé : {{numero_recepisse|N° de récépissé}}
Notre référence : {{reference_demarche|Référence}}

Madame, Monsieur,

Sauf erreur de notre part, notre demande déposée le {{date_depot|Date de dépôt}} reste sans réponse à ce jour.

Nous vous saurions gré de bien vouloir nous faire connaître l'état d'avancement de l'instruction et, le cas échéant, les compléments à fournir.

Demandeur : {{demandeur_nom_complet|Nom complet du demandeur}}
Objet : {{objet|Objet de la demande}}

Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.

{{signataire_nom|Nom et prénom du signataire}}
{{signataire_qualite|Qualité du signataire}}`,
  },
  {
    code: "TPL_COMPTE_RENDU_DEPOT",
    titre: "Compte rendu de dépôt",
    typeCode: null,
    ordre: 5,
    contenu: `COMPTE RENDU DE DÉPÔT — INTERNE

Référence : {{reference_demarche|Référence}}
Démarche : {{type_demarche|Type de démarche}} — {{objet|Objet}}
Demandeur : {{demandeur_nom_complet|Nom complet du demandeur}}

Autorité : {{autorite|Autorité destinataire}}
Date de dépôt : {{date_depot|Date de dépôt}}
Déposant : {{depose_par|Nom du déposant}}
Canal : {{canal_depot|Canal}}
Récépissé n° : {{numero_recepisse|N° de récépissé}}

Frais engagés : {{frais_detail|Détail des frais engagés}}

Observations : [Observations du déposant]

Prochaine relance prévue le : {{prochaine_relance|Date de relance prévue}}`,
  },
  {
    code: "TPL_REMISE_DOCUMENT",
    titre: "Accusé de remise de document",
    typeCode: null,
    ordre: 6,
    contenu: `ACCUSÉ DE REMISE DE DOCUMENT

Je soussigné(e), {{receveur|Nom du receveur}}, en qualité de {{qualite_receveur|Qualité du receveur}},

reconnais avoir reçu ce jour, {{date|Date}}, le document suivant :

— {{document_remis|Nature et référence du document remis}} (original / copie)

délivré par : {{autorite|Autorité émettrice}}
dans le cadre de la démarche : {{type_demarche|Type de démarche}} — {{objet|Objet}} (réf. {{reference_demarche|Référence}}).

{{ville|Ville}}, le {{date|Date}}

Signature du receveur                    Signature du cabinet`,
  },
  {
    code: "TPL_NOTE_RECEVABILITE",
    titre: "Note de recevabilité",
    typeCode: null,
    ordre: 7,
    contenu: `NOTE DE RECEVABILITÉ — INTERNE

Référence : {{reference_demarche|Référence}}
Démarche : {{type_demarche|Type de démarche}} — {{objet|Objet}}

1. Qualification de la demande
Sous-type : {{sous_type|Sous-type}}
Autorité compétente : {{autorite|Autorité compétente}}
Fondement : {{fondement|Fondement de la demande}}

2. Éléments de qualification relevés
{{qualification_detail|Éléments de qualification documentés}}

3. Analyse de recevabilité
{{analyse_recevabilite|Analyse : qualité du demandeur, compétence de l'autorité, pièces exigées, délais}}

4. Réserves et risques
{{reserves|Réserves éventuelles}}

5. Conclusion
{{conclusion|Conclusion (recevable / à corriger / à requalifier)}}

Rédigée par : {{signataire_nom|Nom du rédacteur}}
{{date|Date}}`,
  },
  {
    code: "TPL_EXTRAIT_PLAN_CADASTRAL",
    titre: "Demande d'extrait de plan cadastral",
    typeCode: "CAD_EXTRAIT_PLAN",
    ordre: 10,
    contenu: `{{ville|Ville}}, le {{date|Date}}

À Monsieur le Chef du {{bureau_cadastre|Bureau du Cadastre compétent}}
{{adresse_depot|Adresse du bureau}}

Objet : Demande d'extrait de plan cadastral certifié
Notre référence : {{reference_demarche|Référence}}

Monsieur le Chef du Bureau,

Je soussigné(e), {{demandeur_nom_complet|Nom complet du demandeur}}, en qualité de {{qualite_demandeur|Qualité du demandeur}}, domicilié(e) à {{adresse_demandeur|Adresse du demandeur}},

viens respectueusement solliciter de vos services la délivrance d'un extrait de plan cadastral certifié concernant la parcelle située à {{localisation_parcelle|Localisation de la parcelle}},

dont les références sont : {{references_foncieres|Références (titre foncier, NICAD, bail…)}}.

Cet extrait est demandé aux fins de : {{finalite|Finalité (bail, immatriculation, autorisation de construire, morcellement…)}}.

Pièces jointes :
{{liste_pieces|Liste des pièces jointes}}

Dans l'attente de la délivrance du document, nous vous prions d'agréer, Monsieur le Chef du Bureau, l'expression de notre haute considération.

{{signataire_nom|Nom et prénom du signataire}}
{{signataire_qualite|Qualité du signataire}}`,
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

    // --- Types + check-lists ---
    const typeIds = {};
    for (const spec of TYPES) {
      const { pieces, ...typeData } = spec;
      if (DRY_RUN) {
        console.log(`  [dry] type ${spec.code} (${pieces.length} pièces)`);
        continue;
      }
      const type = await db.demarcheType.upsert({
        where: { code: spec.code },
        create: { ...typeData, pieces: { create: pieces.map((p, i) => ({ ...p, condition: p.condition || null, ordre: i + 1 })) } },
        update: {}, // Ne pas écraser le paramétrage existant.
      });
      typeIds[spec.code] = type.id;
      // Ajouter uniquement les pièces manquantes (code absent).
      const existantes = await db.demarcheTypePiece.findMany({ where: { typeId: type.id }, select: { code: true } });
      const codes = new Set(existantes.map((p) => p.code));
      const manquantes = pieces.filter((p) => !codes.has(p.code));
      if (manquantes.length) {
        await db.demarcheTypePiece.createMany({
          data: manquantes.map((p, i) => ({ ...p, condition: p.condition || null, typeId: type.id, ordre: pieces.indexOf(p) + 1 })),
        });
      }
      console.log(`  ok type ${spec.code} (${pieces.length} pièces, ${manquantes.length} ajoutées)`);
    }

    // --- Autorités ---
    for (const a of AUTORITES) {
      if (DRY_RUN) { console.log(`  [dry] autorité ${a.nom}`); continue; }
      const exist = await db.demarcheAutorite.findFirst({ where: { nom: a.nom } });
      if (!exist) {
        await db.demarcheAutorite.create({ data: a });
        console.log(`  ok autorité ${a.nom}`);
      }
    }

    // --- Modèles ---
    for (const m of MODELES) {
      if (DRY_RUN) { console.log(`  [dry] modèle ${m.code}`); continue; }
      const typeId = m.typeCode ? typeIds[m.typeCode] ?? (await db.demarcheType.findUnique({ where: { code: m.typeCode } }))?.id : null;
      const existing = await db.demarcheModele.findUnique({ where: { code: m.code } });
      if (!existing) {
        await db.demarcheModele.create({
          data: { code: m.code, titre: m.titre, contenu: m.contenu, typeId: typeId ?? null, ordre: m.ordre },
        });
        console.log(`  ok modèle ${m.code}`);
      }
    }

    await db.$disconnect();
  }
  console.log("\nTerminé.");
  await pub.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
