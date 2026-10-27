/**
 * Seed du module « Transactions & contrats » (ventes, baux, mandats —
 * Sénégal) : catalogue des 14 types, check-lists de pièces par type et
 * modèles de documents TPL_* (avant-contrats, contrats, PV, quittances).
 *
 * Idempotent : upsert par code. Les modifications de paramétrage faites
 * dans l'interface ne sont PAS écrasées : seules les lignes manquantes
 * sont créées.
 *
 * Usage : node scripts/seed-transactions.js [--dry-run] [--tenant=<slug>]
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

// Catégories : DIC = DOCUMENT_INTERNE_CABINET, DAO = DOCUMENT_ADMINISTRATIF_A_OBTENIR,
// PC = PIECE_CLIENT, PT = PIECE_TECHNIQUE, PDS = PREUVE_DE_DEPOT_ET_SUIVI,
// AN = ACTE_NOTARIE, CS = CONTRAT_SIGNE
const DIC = "DOCUMENT_INTERNE_CABINET";
const DAO = "DOCUMENT_ADMINISTRATIF_A_OBTENIR";
const PC = "PIECE_CLIENT";
const PT = "PIECE_TECHNIQUE";
const PDS = "PREUVE_DE_DEPOT_ET_SUIVI";
const AN = "ACTE_NOTARIE";
const CS = "CONTRAT_SIGNE";

const p = (code, libelle, categorie, extra = {}) => ({ code, libelle, categorie, ...extra });

/* ------------------------------------------------------------------ */
/* Catalogue des 14 types + check-lists                                */
/* ------------------------------------------------------------------ */
const PIECES_BAILLEUR = [
  p("bailleur_identite", "Pièce d'identité du bailleur, coordonnées et qualité", PC, { partieConcernee: "BAILLEUR" }),
  p("bailleur_droit_louer", "Titre de propriété ou justification du droit de louer", PC, { partieConcernee: "BAILLEUR" }),
  p("bailleur_procuration", "Procuration ou mandat de gestion (si applicable)", PC, { niveau: "CONDITIONNELLE", condition: "Bailleur représenté ou gestionnaire", partieConcernee: "BAILLEUR" }),
  p("bailleur_societe", "Documents société : NINEA, RCCM, statuts, pouvoir de signature", PC, { niveau: "CONDITIONNELLE", condition: "Bailleur personne morale", partieConcernee: "BAILLEUR" }),
  p("accord_coproprietaires", "Accord des copropriétaires / indivisaires", PC, { niveau: "CONDITIONNELLE", condition: "Indivision ou copropriété", partieConcernee: "BAILLEUR" }),
  p("infos_charges_equipements", "Charges, équipements, compteurs et services inclus", PC, { partieConcernee: "BAILLEUR" }),
];
const PIECES_LOCATAIRE = [
  p("locataire_identite", "Pièce d'identité du locataire, adresse et coordonnées", PC, { partieConcernee: "LOCATAIRE" }),
  p("locataire_activite", "Profession, activité, employeur ou justificatifs", PC, { partieConcernee: "LOCATAIRE" }),
  p("locataire_societe", "Documents entreprise : NINEA, RCCM, statuts, pouvoirs", PC, { niveau: "CONDITIONNELLE", condition: "Locataire personne morale", partieConcernee: "LOCATAIRE" }),
  p("garant_pieces", "Pièces du garant / caution solidaire", PC, { niveau: "CONDITIONNELLE", condition: "Garantie prévue", partieConcernee: "GARANT" }),
  p("preuve_paiement_initial", "Preuve du dépôt de garantie et du premier loyer", PDS, { partieConcernee: "LOCATAIRE" }),
];
const PIECES_BAIL_COMMUNES = [
  p("projet_bail", "Projet de contrat de bail", DIC, { sourceAttendue: "CABINET" }),
  p("bail_signe", "Contrat de bail signé par toutes les parties", CS, { sourceAttendue: "CABINET" }),
  p("etat_lieux_entree", "État des lieux d'entrée (et inventaire si meublé)", DIC, { sourceAttendue: "CABINET" }),
  p("pv_remise_cles", "PV de remise des clés", PDS, { sourceAttendue: "CABINET" }),
  p("recepisse_enregistrement", "Récépissé / quittance d'enregistrement du bail", PDS, { niveau: "CONDITIONNELLE", condition: "Enregistrement requis", sourceAttendue: "ADMINISTRATION" }),
];

const TYPES = [
  {
    code: "VENTE_IMMOBILIER_TF",
    libelle: "Vente d'immeuble sous titre foncier",
    famille: "VENTE_IMMOBILIER",
    workflow: "VENTE_TF",
    circuitPrincipal: "Notaire, DGID, Conservation foncière, Cadastre, Domaines selon besoin",
    bienRequis: true,
    notaireObligatoire: true,
    mutationFonciere: true,
    enregistrementAEvaluer: true,
    qualificationObligatoire: true,
    validationAvocat: true,
    sensible: true,
    nbExemplaires: 3,
    avertissement:
      "Une vente privée ne transfère pas la propriété d'un immeuble sous titre foncier : la mutation passe par un notaire territorialement compétent puis la Conservation de la propriété et des droits fonciers, et n'est achevée qu'après inscription de l'acquéreur au livre foncier.",
    pieces: [
      // Vendeur
      p("vendeur_identite", "Pièce d'identité du vendeur, coordonnées", PC, { partieConcernee: "VENDEUR" }),
      p("vendeur_matrimonial", "Situation matrimoniale et pièces utiles", PC, { partieConcernee: "VENDEUR" }),
      p("vendeur_procuration", "Procuration / mandat du vendeur représenté", PC, { niveau: "CONDITIONNELLE", condition: "Vendeur représenté", partieConcernee: "VENDEUR" }),
      p("titre_droit", "Titre foncier, bail, droit de superficie ou autorisation d'occuper", PC, { partieConcernee: "VENDEUR" }),
      p("etat_droits_reels", "État des droits réels récent (bien immatriculé)", DAO, { partieConcernee: "VENDEUR", sourceAttendue: "ADMINISTRATION" }),
      p("pieces_cadastrales", "NICAD, CIC, extrait de plan cadastral, plans disponibles", DAO, { partieConcernee: "VENDEUR", sourceAttendue: "ADMINISTRATION" }),
      p("quittances_droit_occupation", "Quittances de redevances / obligations du droit d'occupation", PC, { niveau: "CONDITIONNELLE", condition: "Droit d'occupation ou bail domanial", partieConcernee: "VENDEUR" }),
      p("docs_urbanisme", "Autorisation de construire, plans et documents urbanistiques", PT, { niveau: "CONDITIONNELLE", condition: "Bien bâti ou projet", partieConcernee: "VENDEUR", sourceAttendue: "ARCHITECTE" }),
      p("mainlevee_radiation", "Mainlevée, radiation ou décision en présence d'une charge", DAO, { niveau: "CONDITIONNELLE", condition: "Hypothèque, saisie ou prénotation", partieConcernee: "VENDEUR", sourceAttendue: "ADMINISTRATION" }),
      p("baux_occupants", "Baux en cours, occupants et droits de tiers", PC, { niveau: "CONDITIONNELLE", condition: "Bien occupé ou loué", partieConcernee: "VENDEUR" }),
      p("declaration_litiges", "Déclaration des litiges, réclamations et contentieux connus", PC, { partieConcernee: "VENDEUR" }),
      p("vendeur_societe", "Société vendeuse : NINEA, RCCM, statuts, décision sociale, pouvoir", PC, { niveau: "CONDITIONNELLE", condition: "Vendeur personne morale", partieConcernee: "VENDEUR" }),
      p("docs_succession", "Succession / indivision : qualité et accord des personnes concernées", PC, { niveau: "CONDITIONNELLE", condition: "Succession ou indivision", partieConcernee: "VENDEUR" }),
      // Acheteur
      p("acheteur_identite", "Pièce d'identité de l'acheteur, coordonnées", PC, { partieConcernee: "ACHETEUR" }),
      p("acheteur_procuration", "Procuration de l'acheteur représenté", PC, { niveau: "CONDITIONNELLE", condition: "Acheteur représenté", partieConcernee: "ACHETEUR" }),
      p("acheteur_societe", "Société acheteuse : NINEA, RCCM, statuts, pouvoirs", PC, { niveau: "CONDITIONNELLE", condition: "Acheteur personne morale", partieConcernee: "ACHETEUR" }),
      p("infos_financement", "Informations de financement (banque, crédit)", PC, { niveau: "CONDITIONNELLE", condition: "Financement externe", partieConcernee: "ACHETEUR" }),
      p("acceptation_ecrite", "Acceptation écrite du prix, des conditions et des réserves", CS, { partieConcernee: "ACHETEUR" }),
      // Cabinet
      p("mandat_cabinet", "Mandat d'assistance et d'intermédiation signé", CS, { sourceAttendue: "CABINET" }),
      p("rapport_due_diligence", "Rapport de due diligence foncière et administrative", DIC, { sourceAttendue: "CABINET" }),
      p("note_risques", "Note de risques et réserves", DIC, { sourceAttendue: "CABINET" }),
      p("avant_contrat", "Promesse / protocole d'accord de vente", DIC, { sourceAttendue: "CABINET" }),
      p("bordereau_notaire", "Bordereau de transmission au notaire", DIC, { sourceAttendue: "CABINET" }),
      // Actes & preuves
      p("acte_notarie", "Acte notarié de vente signé", AN, { sourceAttendue: "NOTAIRE" }),
      p("recepisse_conservation", "Récépissé de dépôt à la Conservation foncière", PDS, { sourceAttendue: "ADMINISTRATION" }),
      p("quittance_enregistrement", "Quittance d'enregistrement / droits", PDS, { sourceAttendue: "ADMINISTRATION" }),
      p("preuve_mutation", "État de droits réels final / preuve d'inscription de la mutation au livre foncier", PDS, { sourceAttendue: "ADMINISTRATION" }),
    ],
  },
  {
    code: "PROMESSE_VENTE_IMMOBILIER",
    libelle: "Promesse ou compromis de vente",
    famille: "VENTE_IMMOBILIER",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet, puis notaire",
    bienRequis: true,
    validationAvocat: true,
    sensible: true,
    avertissement:
      "La promesse ouvre le circuit : la mutation définitive d'un bien sous titre foncier exige ensuite l'acte notarié et l'inscription au livre foncier.",
    pieces: [
      p("promettant_identite", "Pièce d'identité du promettant (vendeur)", PC, { partieConcernee: "VENDEUR" }),
      p("beneficiaire_identite", "Pièce d'identité du bénéficiaire (acheteur)", PC, { partieConcernee: "ACHETEUR" }),
      p("titre_droit", "Titre foncier ou titre de droit sur le bien", PC, { partieConcernee: "VENDEUR" }),
      p("etat_droits_reels", "État des droits réels si bien immatriculé", DAO, { niveau: "CONDITIONNELLE", condition: "Bien immatriculé", sourceAttendue: "ADMINISTRATION" }),
      p("mandat_cabinet", "Mandat d'assistance du cabinet signé", CS, { sourceAttendue: "CABINET" }),
      p("promesse_signee", "Promesse / compromis signé par les parties", CS, { sourceAttendue: "CABINET" }),
      p("preuve_sequestre", "Preuve de dépôt des fonds / indemnité d'immobilisation", PDS, { niveau: "CONDITIONNELLE", condition: "Séquestre ou indemnité", sourceAttendue: "ADMINISTRATION" }),
    ],
  },
  {
    code: "VENTE_BAIL_DROIT_SUPERFICIE",
    libelle: "Cession de bail ou droit de superficie",
    famille: "VENTE_IMMOBILIER",
    workflow: "GENERIQUE",
    circuitPrincipal: "Domaines, DGID, notaire selon le droit concerné",
    bienRequis: true,
    validationAvocat: true,
    enregistrementAEvaluer: true,
    avertissement: "La cessibilité du droit domanial doit être vérifiée auprès des Domaines avant toute cession.",
    pieces: [
      p("cedant_identite", "Pièce d'identité du cédant", PC, { partieConcernee: "VENDEUR" }),
      p("cessionnaire_identite", "Pièce d'identité du cessionnaire", PC, { partieConcernee: "ACHETEUR" }),
      p("droit_domanial", "Bail, droit de superficie ou titre du droit cédé", PC, { partieConcernee: "VENDEUR" }),
      p("quittances_redevances", "Quittances de redevances à jour", PC, { partieConcernee: "VENDEUR" }),
      p("accord_domaines", "Accord / autorisation des Domaines pour la cession", DAO, { sourceAttendue: "ADMINISTRATION" }),
      p("acte_cession", "Acte de cession signé", CS, { sourceAttendue: "CABINET" }),
      p("preuve_enregistrement", "Preuve d'enregistrement de la cession", PDS, { sourceAttendue: "ADMINISTRATION" }),
    ],
  },
  {
    code: "VENTE_AUTORISATION_OCCUPER",
    libelle: "Cession / régularisation d'une autorisation d'occuper",
    famille: "VENTE_IMMOBILIER",
    workflow: "GENERIQUE",
    circuitPrincipal: "Domaines, Cadastre, autorités territoriales",
    bienRequis: true,
    validationAvocat: true,
    avertissement: "Une autorisation d'occuper est précaire : vérifier la cessibilité et la régularisation auprès des Domaines.",
    pieces: [
      p("titulaire_identite", "Pièce d'identité du titulaire", PC, { partieConcernee: "VENDEUR" }),
      p("beneficiaire_identite", "Pièce d'identité du bénéficiaire", PC, { partieConcernee: "ACHETEUR" }),
      p("autorisation_occuper", "Autorisation d'occuper / permis en cours de validité", PC, { partieConcernee: "VENDEUR" }),
      p("avis_domaines", "Avis ou autorisation des Domaines", DAO, { sourceAttendue: "ADMINISTRATION" }),
      p("acte_cession", "Acte de cession signé", CS, { sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "VENTE_BIEN_MEUBLE",
    libelle: "Vente de bien meuble / actif non immobilier",
    famille: "VENTE_AUTRE",
    workflow: "GENERIQUE",
    circuitPrincipal: "Contrat et formalité selon la nature du bien",
    bienRequis: false,
    avertissement: "Vérifier la propriété du bien, les sûretés (RCCM) et les formalités de transfert propres à sa nature.",
    pieces: [
      p("vendeur_identite", "Pièce d'identité du vendeur", PC, { partieConcernee: "VENDEUR" }),
      p("acheteur_identite", "Pièce d'identité de l'acheteur", PC, { partieConcernee: "ACHETEUR" }),
      p("preuve_propriete", "Preuve de propriété / facture d'origine du bien", PC, { partieConcernee: "VENDEUR" }),
      p("descriptif_bien", "Descriptif détaillé et état du bien", DIC, { sourceAttendue: "CABINET" }),
      p("contrat_vente", "Contrat de vente signé", CS, { sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "BAIL_HABITATION_VIDE",
    libelle: "Bail d'habitation non meublée",
    famille: "BAIL",
    workflow: "BAIL",
    circuitPrincipal: "Contrat, état des lieux, formalités si requises",
    bienRequis: true,
    enregistrementAEvaluer: true,
    avertissement: "Vérifier le droit de louer du bailleur ; l'enregistrement est évalué selon la nature et la durée du bail.",
    pieces: [...PIECES_BAILLEUR, ...PIECES_LOCATAIRE, ...PIECES_BAIL_COMMUNES],
  },
  {
    code: "BAIL_HABITATION_MEUBLEE",
    libelle: "Bail d'habitation meublée",
    famille: "BAIL",
    workflow: "BAIL",
    circuitPrincipal: "Contrat, inventaire, état des lieux",
    bienRequis: true,
    enregistrementAEvaluer: true,
    avertissement: "L'inventaire du mobilier est obligatoire pour un bail meublé.",
    pieces: [
      ...PIECES_BAILLEUR,
      ...PIECES_LOCATAIRE,
      p("inventaire_mobilier", "Inventaire détaillé du mobilier", DIC, { sourceAttendue: "CABINET" }),
      ...PIECES_BAIL_COMMUNES,
    ],
  },
  {
    code: "BAIL_PROFESSIONNEL",
    libelle: "Bail professionnel",
    famille: "BAIL",
    workflow: "BAIL",
    circuitPrincipal: "Contrat, destination et fiscalité à vérifier",
    bienRequis: true,
    validationAvocat: true,
    enregistrementAEvaluer: true,
    avertissement: "Vérifier la destination professionnelle, les autorisations d'activité et la fiscalité applicable.",
    pieces: [...PIECES_BAILLEUR, ...PIECES_LOCATAIRE, ...PIECES_BAIL_COMMUNES],
  },
  {
    code: "BAIL_COMMERCIAL",
    libelle: "Bail commercial",
    famille: "BAIL",
    workflow: "BAIL",
    circuitPrincipal: "Contrat, régime OHADA et formalités à vérifier",
    bienRequis: true,
    validationAvocat: true,
    sensible: true,
    enregistrementAEvaluer: true,
    avertissement: "Bail commercial soumis au régime OHADA : vérifier RCCM, fonds de commerce, pas-de-porte et droit au renouvellement.",
    pieces: [
      ...PIECES_BAILLEUR,
      ...PIECES_LOCATAIRE,
      p("locataire_rccm_commerce", "RCCM / immatriculation du commerce du preneur", PC, { partieConcernee: "LOCATAIRE" }),
      ...PIECES_BAIL_COMMUNES,
    ],
  },
  {
    code: "BAIL_MIXTE",
    libelle: "Bail à usage mixte",
    famille: "BAIL",
    workflow: "BAIL",
    circuitPrincipal: "Contrat, destination, urbanisme selon cas",
    bienRequis: true,
    enregistrementAEvaluer: true,
    avertissement: "Préciser la répartition des usages et vérifier les contraintes d'urbanisme.",
    pieces: [...PIECES_BAILLEUR, ...PIECES_LOCATAIRE, ...PIECES_BAIL_COMMUNES],
  },
  {
    code: "AVENANT_BAIL",
    libelle: "Avenant, renouvellement ou prorogation de bail",
    famille: "AVENANT_RESILIATION",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet",
    bienRequis: false,
    avertissement: "Vérifier que l'avenant ne modifie pas des éléments exigeant une nouvelle formalité.",
    pieces: [
      p("bail_initial", "Contrat de bail initial et avenants antérieurs", PC, { partieConcernee: "BAILLEUR" }),
      p("accord_parties", "Accord des parties sur les modifications", DIC, { sourceAttendue: "CABINET" }),
      p("avenant_signe", "Avenant signé par toutes les parties", CS, { sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "RESILIATION_AMIABLE_BAIL",
    libelle: "Résiliation amiable de bail",
    famille: "AVENANT_RESILIATION",
    workflow: "GENERIQUE",
    circuitPrincipal: "Cabinet, état des lieux, solde",
    bienRequis: false,
    avertissement: "Tracer l'état des lieux de sortie, le solde des loyers et la restitution du dépôt de garantie.",
    pieces: [
      p("bail_initial", "Contrat de bail en cours", PC, { partieConcernee: "BAILLEUR" }),
      p("convention_resiliation", "Convention de résiliation amiable signée", CS, { sourceAttendue: "CABINET" }),
      p("etat_lieux_sortie", "État des lieux de sortie", DIC, { sourceAttendue: "CABINET" }),
      p("solde_compte", "Solde des loyers, charges et restitution du dépôt", DIC, { sourceAttendue: "CABINET" }),
      p("pv_restitution_cles", "PV de restitution des clés", PDS, { sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "ETAT_LIEUX",
    libelle: "État des lieux (entrée ou sortie)",
    famille: "ETAT_LIEUX",
    workflow: "GENERIQUE",
    circuitPrincipal: "Annexe contractuelle ou constat d'huissier",
    bienRequis: true,
    avertissement: "L'état des lieux contradictoire engage les parties : photos, compteurs et signatures à archiver.",
    pieces: [
      p("bail_reference", "Référence du bail concerné", PC, { partieConcernee: "BAILLEUR" }),
      p("releves_compteurs", "Relevés des compteurs et photos datées", PT, { sourceAttendue: "CABINET" }),
      p("etat_lieux_signe", "État des lieux signé par les parties", CS, { sourceAttendue: "CABINET" }),
    ],
  },
  {
    code: "MANDAT_INTERMEDIATION",
    libelle: "Mandat d'assistance et d'intermédiation du cabinet",
    famille: "MANDAT",
    workflow: "GENERIQUE",
    circuitPrincipal: "Contrat interne cabinet",
    bienRequis: false,
    avertissement: "Le mandat définit les limites de l'intervention du cabinet : il n'est jamais partie au contrat final.",
    pieces: [
      p("mandant_identite", "Pièce d'identité / documents du mandant", PC, { partieConcernee: "MANDANT" }),
      p("mandant_pouvoirs", "Pouvoirs du signataire (société, procuration)", PC, { niveau: "CONDITIONNELLE", condition: "Mandant représenté ou personne morale", partieConcernee: "MANDANT" }),
      p("biens_couverts", "Liste des biens couverts par le mandat", DIC, { niveau: "CONDITIONNELLE", condition: "Mandat de gestion", sourceAttendue: "CABINET" }),
      p("mandat_signe", "Mandat signé par le mandant et le cabinet", CS, { sourceAttendue: "CABINET" }),
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

const MODELES = [
  {
    code: "TPL_MANDAT_INTERMEDIATION_IMMO",
    titre: "Mandat d'assistance et d'intermédiation",
    typeCode: "MANDAT_INTERMEDIATION",
    validationMinimale: "AVOCAT",
    contenu: `MANDAT D'ASSISTANCE ET D'INTERMÉDIATION
Référence : {{reference_transaction|Référence de la transaction}}

ENTRE :

{{mandant_nom|Nom complet du mandant}}, {{mandant_qualite|Qualité du mandant}},
demeurant à {{mandant_adresse|Adresse du mandant}},
ci-après dénommé « le Mandant »,

ET :

Le Cabinet {{cabinet_nom|Nom du cabinet}}, {{cabinet_adresse|Adresse du cabinet}},
représenté par {{signataire_nom|Nom du signataire}}, en sa qualité de {{signataire_qualite|Qualité}},
ci-après dénommé « le Cabinet ».

ARTICLE 1 — OBJET
Le Mandant confie au Cabinet, qui l'accepte, un mandat de type {{type_mandat|Type de mandat (simple / exclusif / gestion)}} portant sur {{objet_mandat|Objet du mandat}}, pour une durée de {{duree_mandat|Durée du mandat}} à compter du {{date_debut|Date de début}}.

ARTICLE 2 — MISSIONS
Le Cabinet est chargé de :
- la recherche et la sélection des cocontractants ;
- la collecte et le contrôle des pièces ;
- la préparation des projets d'actes et contrats ;
- la coordination avec le notaire, les administrations et les professionnels ;
- le suivi des formalités et des paiements ;
- la représentation du Mandant dans la limite du présent mandat.

[[CONFIDENTIEL]]
ARTICLE 3 — RÉMUNÉRATION
La rémunération du Cabinet est fixée à {{commission|Montant ou taux de rémunération}},
calculée sur la base des loyers encaissés ({{base_calcul|Base de calcul}}).
Les débours et formalités externes sont facturés en sus sur justificatifs.
[[/CONFIDENTIEL]]

ARTICLE 4 — BIENS COUVERTS
{{liste_biens|Liste et description des biens couverts}}

ARTICLE 5 — OBLIGATIONS DES PARTIES
Le Mandant s'engage à fournir des informations exactes, à transmettre les pièces
nécessaires et à ne pas conclure sans informer le Cabinet. Le Cabinet s'engage à
agir avec diligence, à rendre compte régulièrement et à conserver les preuves.

ARTICLE 6 — RÉSILIATION
Chaque partie peut résilier le mandat moyennant un préavis de {{preavis|Durée du préavis}},
notifié par écrit. Les missions engagées et les frais exposés restent dus.

ARTICLE 7 — CLAUSES PARTICULIÈRES
{{clauses_particulieres|Clauses particulières}}

${CLAUSE_CABINET}

Fait à {{lieu_signature|Lieu de signature}}, le {{date_signature|Date de signature}},
en {{nb_originaux|Nombre d'exemplaires}} exemplaires originaux.

Le Mandant (lu et approuvé)                    Le Cabinet
_______________________                        _______________________`,
  },
  {
    code: "TPL_FICHE_DUE_DILIGENCE_IMMO",
    titre: "Rapport de vérification foncière et administrative",
    typeCode: "VENTE_IMMOBILIER_TF",
    validationMinimale: "AVOCAT",
    contenu: `RAPPORT DE DUE DILIGENCE FONCIÈRE ET ADMINISTRATIVE
Transaction : {{reference_transaction|Référence de la transaction}}
Bien : {{designation_bien|Désignation du bien}}
Date du rapport : {{date_rapport|Date du rapport}}

1. PARTIES ET CAPACITÉ
Vendeur : {{vendeur_nom|Nom du vendeur}} — identité {{vendeur_identite_statut|vérifiée / à vérifier}}.
Acheteur : {{acheteur_nom|Nom de l'acheteur}} — identité {{acheteur_identite_statut|vérifiée / à vérifier}}.
Pouvoirs de signature : {{pouvoirs|Pouvoirs vérifiés / observations}}.

2. TITULARITÉ
Droit invoqué : {{type_droit|Type de droit}} — référence {{reference_droit|Référence du droit}}.
Titulaire inscrit : {{titulaire_inscrit|Titulaire inscrit}}.

3. CONSERVATION FONCIÈRE
État des droits réels du {{date_edr|Date de l'état}} : {{resultat_edr|Résultat}}.
Charges, hypothèques, saisies, prénotations : {{charges|Charges relevées}}.

4. CADASTRE
NICAD : {{nicad|NICAD}} — superficie {{superficie|Superficie}}.
Cohérence plan / titre / réalité : {{coherence_cadastrale|Observations}}.

5. DOMAINES ET OCCUPATION
Nature du droit d'occupation : {{droit_occupation|Nature}}.
Occupants, locataires, sous-locations : {{occupants|Situation d'occupation}}.

6. URBANISME ET FISCALITÉ
Documents urbanistiques : {{urbanisme|Observations}}.
Situation fiscale et droits à prévoir : {{fiscalite|Observations}}.

7. SUCCESSION / SOCIÉTÉ (le cas échéant)
{{succession_societe|Observations}}

8. CONCLUSION ET RÉSERVES
{{conclusion|Conclusion et réserves émises}}

${CLAUSE_CABINET}

Établi par {{signataire_nom|Nom}} — {{signataire_qualite|Qualité}}
Validé par {{validateur_nom|Avocat validateur}} le {{date_validation|Date}}.`,
  },
  {
    code: "TPL_FICHE_RISQUES_VENTE",
    titre: "Note de risques et réserves",
    typeCode: "VENTE_IMMOBILIER_TF",
    validationMinimale: "AVOCAT",
    contenu: `NOTE DE RISQUES ET RÉSERVES
Transaction : {{reference_transaction|Référence}} — {{objet_transaction|Objet}}

RISQUES IDENTIFIÉS

1. {{risque_1|Risque 1 — description, probabilité, impact}}
2. {{risque_2|Risque 2}}
3. {{risque_3|Risque 3}}

RÉSERVES ÉMISES

{{reserves|Réserves émises et conditions de levée}}

RECOMMANDATIONS

{{recommandations|Recommandations du cabinet}}

${CLAUSE_CABINET}

{{signataire_nom|Nom}} — {{signataire_qualite|Qualité}}
{{date_signature|Date}}`,
  },
  {
    code: "TPL_PROMESSE_VENTE_IMMO",
    titre: "Promesse de vente",
    typeCode: "PROMESSE_VENTE_IMMOBILIER",
    validationMinimale: "AVOCAT",
    contenu: `PROMESSE DE VENTE
Référence : {{reference_transaction|Référence}}

ENTRE :

{{vendeur_nom|Nom du promettant-vendeur}}, {{vendeur_qualite|Qualité}},
demeurant à {{vendeur_adresse|Adresse}}, ci-après « le Promettant »,

ET :

{{acheteur_nom|Nom du bénéficiaire-acheteur}}, {{acheteur_qualite|Qualité}},
demeurant à {{acheteur_adresse|Adresse}}, ci-après « le Bénéficiaire ».

ARTICLE 1 — PROMESSE
Le Promettant promet de vendre au Bénéficiaire, qui accepte, le bien désigné
ci-après, au prix et aux conditions définis au présent acte.

ARTICLE 2 — DÉSIGNATION DU BIEN
{{designation_bien|Désignation complète du bien}} — {{adresse_bien|Adresse}},
superficie {{superficie|Superficie}}, droit : {{type_droit|Type de droit}}
{{reference_droit|Référence}}.

ARTICLE 3 — PRIX ET MODALITÉS
Prix de vente : {{prix_vente|Prix}} {{devise|Devise}}.
Indemnité d'immobilisation / séquestre : {{indemnite|Montant et modalités}}.
{{modalites_paiement|Modalités de paiement}}.

ARTICLE 4 — CONDITIONS SUSPENSIVES
{{conditions_suspensives|Conditions suspensives (financement, autorisations…)}}

ARTICLE 5 — DURÉE DE L'OPTION
La présente promesse vaut jusqu'au {{date_validite|Date limite}}.
Passé ce délai sans réalisation, l'indemnité d'immobilisation sera {{sort_indemnite|acquise / restituée}}.

ARTICLE 6 — CIRCUIT DE RÉALISATION
La vente définitive sera réalisée par acte authentique devant
{{notaire_nom|Nom du notaire territorialement compétent}}, puis soumise aux
formalités d'enregistrement et de publicité foncière. La propriété n'est
transférée qu'après inscription de l'acquéreur au livre foncier.

ARTICLE 7 — DÉCLARATIONS
Le Promettant déclare être titulaire du droit cédé et ne pas avoir disposé
du bien. Les charges, occupations et litiges déclarés : {{declarations|Déclarations}}.

${CLAUSE_CABINET}

Fait à {{lieu_signature|Lieu}}, le {{date_signature|Date}},
en {{nb_originaux|Nombre}} exemplaires originaux.

Le Promettant (lu et approuvé)                 Le Bénéficiaire (lu et approuvé)
_______________________                        _______________________`,
  },
  {
    code: "TPL_PROTOCOLE_ACCORD_VENTE",
    titre: "Protocole d'accord de vente",
    typeCode: "VENTE_IMMOBILIER_TF",
    validationMinimale: "AVOCAT",
    contenu: `PROTOCOLE D'ACCORD DE VENTE
Référence : {{reference_transaction|Référence}}

ENTRE :
{{vendeur_nom|Vendeur}}, {{vendeur_qualite|Qualité}}, ci-après « le Vendeur »,
ET :
{{acheteur_nom|Acheteur}}, {{acheteur_qualite|Qualité}}, ci-après « l'Acheteur ».

1. OBJET : accord de principe sur la vente de {{designation_bien|bien}},
   {{adresse_bien|adresse}} — {{reference_droit|référence du droit}}.
2. PRIX : {{prix_vente|prix}} {{devise|devise}} — modalités : {{modalites|modalités}}.
3. CONDITIONS : {{conditions|conditions suspensives et réserves}}.
4. CALENDRIER : signature de l'acte authentique prévue le {{date_signature_prevue|date}},
   devant {{notaire_nom|notaire}}.
5. FORMALITÉS : enregistrement et publicité foncière suivis par le cabinet ;
   la mutation est achevée par l'inscription de l'acquéreur au livre foncier.
6. CLAUSES : {{clauses|clauses particulières}}.

${CLAUSE_CABINET}

Fait à {{lieu_signature|lieu}}, le {{date_signature|date}}.

Le Vendeur                                   L'Acheteur
_______________________                        _______________________`,
  },
  {
    code: "TPL_BORDEREAU_NOTAIRE",
    titre: "Bordereau de transmission au notaire",
    typeCode: "VENTE_IMMOBILIER_TF",
    validationMinimale: "JURISTE",
    contenu: `BORDEREAU DE TRANSMISSION AU NOTAIRE
Transaction : {{reference_transaction|Référence}}

À l'attention de {{notaire_nom|Maître}}, Notaire
Étude : {{notaire_etude|Étude notariale}} — {{notaire_adresse|Adresse}}

Objet : transmission du dossier de vente — {{designation_bien|Bien}}
Vendeur : {{vendeur_nom|Vendeur}} — Acquéreur : {{acheteur_nom|Acquéreur}}

PIÈCES TRANSMISES :
{{liste_pieces|Liste des pièces transmises}}

INSTRUCTIONS :
{{instructions|Instructions particulières}}

Nous restons à votre disposition pour tout complément.

${CLAUSE_CABINET}

{{cabinet_nom|Cabinet}} — {{signataire_nom|Signataire}}, {{signataire_qualite|Qualité}}
{{date_envoi|Date}}`,
  },
  {
    code: "TPL_LETTRE_INSTRUCTIONS_NOTAIRE",
    titre: "Lettre d'instructions au notaire",
    typeCode: "VENTE_IMMOBILIER_TF",
    validationMinimale: "AVOCAT",
    contenu: `LETTRE D'INSTRUCTIONS AU NOTAIRE
{{cabinet_nom|Cabinet}} — {{cabinet_adresse|Adresse}}

À l'attention de {{notaire_nom|Maître}}, Notaire territorialement compétent
{{notaire_etude|Étude}} — {{notaire_adresse|Adresse}}

Objet : instructions pour la vente de {{designation_bien|bien}}
Référence : {{reference_transaction|Référence}}

Maître,

Nous vous prions de bien vouloir instrumenter la vente ci-dessus référencée
entre {{vendeur_nom|le vendeur}} et {{acheteur_nom|l'acquéreur}}, au prix de
{{prix_vente|prix}} {{devise|devise}}.

INSTRUCTIONS PARTICULIÈRES :
{{instructions|Instructions (clauses, conditions suspensives, échéances)}}

PIÈCES JOINTES :
{{liste_pieces|Pièces jointes}}

Nous vous remercions de nous transmettre le projet d'acte pour contrôle avant
signature, puis de procéder aux formalités d'enregistrement et de publicité
foncière à la Conservation de la propriété et des droits fonciers.

${CLAUSE_CABINET}

{{signataire_nom|Signataire}} — {{signataire_qualite|Qualité}}
{{date_signature|Date}}`,
  },
  {
    code: "TPL_DEMANDE_ETAT_DROITS_REELS",
    titre: "Demande d'état des droits réels",
    typeCode: "VENTE_IMMOBILIER_TF",
    validationMinimale: "JURISTE",
    contenu: `DEMANDE D'ÉTAT DES DROITS RÉELS
{{cabinet_nom|Cabinet}} — {{cabinet_adresse|Adresse}}

À Monsieur le Conservateur de la propriété et des droits fonciers
de {{bureau_conservation|Bureau territorialement compétent}}

Objet : demande d'état des droits réels
Référence : {{reference_transaction|Référence}}

Monsieur le Conservateur,

Dans le cadre de la transaction immobilière ci-dessus référencée, nous vous
prions de bien vouloir nous délivrer l'état des droits réels relatif au bien :

- Titre foncier : {{titre_foncier|Numéro du titre foncier}}
- Titulaire inscrit : {{titulaire|Titulaire}}
- Localisation : {{localisation|Commune, quartier}}
- NICAD : {{nicad|NICAD}}
- Superficie : {{superficie|Superficie}}

Demandeur : {{demandeur_nom|Nom et qualité du demandeur}}
Motif : {{motif|Motif de la demande}}

Pièces jointes : {{liste_pieces|Pièces jointes}}

{{signataire_nom|Signataire}} — {{signataire_qualite|Qualité}}
{{date_signature|Date}}`,
  },
  {
    code: "TPL_DEMANDE_CADASTRE_TRANSACTION",
    titre: "Demande d'extrait cadastral / CIC / NICAD",
    typeCode: "VENTE_IMMOBILIER_TF",
    validationMinimale: "JURISTE",
    contenu: `DEMANDE AU BUREAU DU CADASTRE
{{cabinet_nom|Cabinet}} — {{cabinet_adresse|Adresse}}

À Monsieur le Chef du Bureau du Cadastre de {{bureau_cadastre|Bureau compétent}}

Objet : {{objet_demande|Demande d'extrait de plan / CIC / vérification NICAD}}
Référence : {{reference_transaction|Référence}}

Monsieur le Chef du Bureau,

Nous vous prions de bien vouloir nous délivrer {{document_demande|le document demandé}}
relatif à la parcelle / au bien ci-après :

- Localisation : {{localisation|Commune, quartier, repères}}
- NICAD : {{nicad|NICAD}}
- Titre / droit : {{reference_droit|Référence du droit}}
- Demandeur : {{demandeur_nom|Nom et qualité}}

Pièces jointes : {{liste_pieces|Pièces jointes}}

${CLAUSE_CABINET}

{{signataire_nom|Signataire}} — {{signataire_qualite|Qualité}}
{{date_signature|Date}}`,
  },
  {
    code: "TPL_DECLARATION_DOMAINES_TRANSACTION",
    titre: "Déclaration / demande aux Domaines",
    typeCode: "VENTE_BAIL_DROIT_SUPERFICIE",
    validationMinimale: "AVOCAT",
    contenu: `DEMANDE AUX DOMAINES
{{cabinet_nom|Cabinet}} — {{cabinet_adresse|Adresse}}

À Monsieur le Directeur / Chef du Bureau des Domaines de {{bureau_domaines|Bureau compétent}}

Objet : {{objet_demande|Objet de la demande (cession, régularisation, autorisation)}}
Référence : {{reference_transaction|Référence}}

Monsieur,

Nous vous prions de bien vouloir {{demande|formulation de la demande}} concernant
le droit ci-après :

- Nature du droit : {{type_droit|bail / droit de superficie / autorisation d'occuper}}
- Référence : {{reference_droit|Référence}}
- Titulaire : {{titulaire|Titulaire}}
- Localisation : {{localisation|Localisation}}

Pièces jointes : {{liste_pieces|Pièces jointes}}

${CLAUSE_CABINET}

{{signataire_nom|Signataire}} — {{signataire_qualite|Qualité}}
{{date_signature|Date}}`,
  },
  {
    code: "TPL_BAIL_HABITATION",
    titre: "Bail d'habitation",
    typeCode: "BAIL_HABITATION_VIDE",
    validationMinimale: "JURISTE",
    contenu: `CONTRAT DE BAIL D'HABITATION
Référence : {{reference_transaction|Référence}}

ENTRE :

{{bailleur_nom|Nom du bailleur}}, {{bailleur_qualite|Qualité (propriétaire / mandataire)}},
demeurant à {{bailleur_adresse|Adresse}}, ci-après « le Bailleur »,

ET :

{{locataire_nom|Nom du locataire}}, {{locataire_qualite|Qualité}},
demeurant à {{locataire_adresse|Adresse}}, ci-après « le Locataire ».

ARTICLE 1 — DROIT DE LOUER
Le Bailleur déclare être {{droit_bailleur|propriétaire / titulaire d'un droit de louer}}
du bien désigné ci-après et disposer de tout pouvoir pour le donner à bail.
Justificatif : {{justificatif_droit|Titre / mandat}}.

ARTICLE 2 — DÉSIGNATION DU BIEN
{{designation_bien|Désignation complète du bien}} — {{adresse_bien|Adresse}},
{{nb_pieces|Nombre de pièces}} pièces, {{etage|Étage}}, superficie {{superficie|Superficie}}.
Dépendances et équipements : {{dependances|Dépendances, compteurs, équipements}}.

ARTICLE 3 — DESTINATION
Le bien est loué à usage de {{destination|habitation / usage autorisé}}.
Tout changement de destination est soumis à l'accord écrit du Bailleur.

ARTICLE 4 — DURÉE
Le bail prend effet le {{date_effet|Date d'effet}} pour une durée de
{{duree|Durée}}, {{renouvellement|modalités de renouvellement}}.

ARTICLE 5 — CONDITIONS FINANCIÈRES
Loyer mensuel : {{loyer|Montant du loyer}} {{devise|Devise}}, payable
{{modalite_paiement|mode et lieu de paiement}} au plus tard le {{jour_echeance|jour}}
de chaque mois.
Dépôt de garantie : {{depot_garantie|Montant}} {{devise|Devise}}.
Charges : {{charges|Charges locatives et répartition}}.
Avance de loyer : {{avance_loyer|Montant, le cas échéant}}.

ARTICLE 6 — ÉTAT DES LIEUX ET INVENTAIRE
Un état des lieux contradictoire {{etat_lieux|est annexé / sera établi le …}}.
{{inventaire|Inventaire du mobilier le cas échéant}}.

ARTICLE 7 — OBLIGATIONS DU BAILLEUR
Délivrer le bien en bon état, assurer la jouissance paisible, effectuer les
réparations relevant de sa charge, remettre les quittances de loyer.

ARTICLE 8 — OBLIGATIONS DU LOCATAIRE
Payer le loyer et les charges aux échéances, user du bien en bon père de
famille, ne pas sous-louer ni ceder sans accord écrit, restituer le bien dans
l'état de l'état des lieux.

ARTICLE 9 — CLAUSES PARTICULIÈRES
{{clauses_particulieres|Animaux, sous-location, révision, clés, etc.}}

ARTICLE 10 — RÉSILIATION ET NOTIFICATIONS
{{resiliation|Préavis, mise en demeure, restitution des lieux}}

ARTICLE 11 — FORMALITÉS
{{enregistrement|Formalité d'enregistrement évaluée : requis / non requis — modalités}}

${CLAUSE_CABINET}

Fait à {{lieu_signature|Lieu}}, le {{date_signature|Date}},
en {{nb_originaux|Nombre}} exemplaires originaux.

Le Bailleur (lu et approuvé)                   Le Locataire (lu et approuvé)
_______________________                        _______________________
{{garant_signature|Le Garant (le cas échéant) : _______________________}}`,
  },
  {
    code: "TPL_BAIL_PROFESSIONNEL",
    titre: "Bail professionnel",
    typeCode: "BAIL_PROFESSIONNEL",
    validationMinimale: "AVOCAT",
    contenu: `CONTRAT DE BAIL PROFESSIONNEL
Référence : {{reference_transaction|Référence}}

ENTRE : {{bailleur_nom|Bailleur}}, {{bailleur_qualite|qualité}}, ci-après « le Bailleur »,
ET : {{locataire_nom|Locataire}}, {{locataire_qualite|qualité}}, ci-après « le Locataire ».

1. DROIT DE LOUER : {{droit_bailleur|droit du bailleur et justificatif}}.
2. BIEN : {{designation_bien|désignation}}, {{adresse_bien|adresse}} — {{superficie|superficie}}.
3. DESTINATION : usage professionnel de {{destination|activité autorisée}} — toute
   autre activité soumise à accord écrit.
4. DURÉE : {{duree|durée}} à compter du {{date_effet|date}} — {{renouvellement|renouvellement}}.
5. LOYER : {{loyer|montant}} {{devise|devise}} / mois — dépôt de garantie :
   {{depot_garantie|montant}} — charges : {{charges|répartition}}.
6. FISCALITÉ ET AUTORISATIONS : le locataire justifie de {{autorisations|NINEA,
   autorisations d'activité}} ; fiscalité applicable : {{fiscalite|observations}}.
7. ÉTAT DES LIEUX : {{etat_lieux|état des lieux annexe}}.
8. CLAUSES : {{clauses_particulieres|clauses particulières}}.
9. FORMALITÉS : {{enregistrement|enregistrement évalué}}.

${CLAUSE_CABINET}

Fait à {{lieu_signature|lieu}}, le {{date_signature|date}}.

Le Bailleur                                  Le Locataire
_______________________                        _______________________`,
  },
  {
    code: "TPL_BAIL_COMMERCIAL",
    titre: "Bail commercial",
    typeCode: "BAIL_COMMERCIAL",
    validationMinimale: "AVOCAT",
    contenu: `CONTRAT DE BAIL COMMERCIAL
Référence : {{reference_transaction|Référence}}

ENTRE : {{bailleur_nom|Bailleur}}, {{bailleur_qualite|qualité}}, ci-après « le Bailleur »,
ET : {{locataire_nom|Preneur}}, {{locataire_qualite|qualité}}, RCCM {{rccm|RCCM}},
ci-après « le Preneur ».

1. DROIT DE LOUER : {{droit_bailleur|droit du bailleur et justificatif}}.
2. BIEN : {{designation_bien|local commercial}}, {{adresse_bien|adresse}} — {{superficie|superficie}}.
3. DESTINATION COMMERCIALE : {{destination|commerce autorisé}} ; pas-de-porte :
   {{pas_de_porte|montant / néant}} ; fonds de commerce : {{fonds|observations}}.
4. DURÉE : {{duree|durée}} à compter du {{date_effet|date}} — droit au
   renouvellement : {{renouvellement|modalités}}.
5. LOYER : {{loyer|montant}} {{devise|devise}} / {{periodicite|mois / trimestre}} ;
   dépôt de garantie : {{depot_garantie|montant}} ; charges : {{charges|répartition}} ;
   révision : {{revision|modalités}}.
6. TRAVAUX : {{travaux|répartition des travaux et autorisations}}.
7. CESSION / SOUS-LOCATION : {{cession|conditions}}.
8. ÉTAT DES LIEUX : {{etat_lieux|état des lieux annexe}}.
9. FORMALITÉS : {{enregistrement|enregistrement évalué}} ; régime OHADA :
   {{ohada|observations}}.

${CLAUSE_CABINET}

Fait à {{lieu_signature|lieu}}, le {{date_signature|date}}.

Le Bailleur                                  Le Preneur
_______________________                        _______________________`,
  },
  {
    code: "TPL_ETAT_LIEUX_ENTREE",
    titre: "État des lieux d'entrée",
    typeCode: "ETAT_LIEUX",
    contenu: `ÉTAT DES LIEUX D'ENTRÉE
Référence : {{reference_transaction|Référence}} — Bail : {{reference_bail|Référence du bail}}

Bailleur : {{bailleur_nom|Nom}} — Locataire : {{locataire_nom|Nom}}
Bien : {{designation_bien|Désignation}} — {{adresse_bien|Adresse}}
Date et heure : {{date_etat|Date}} — Contradictoire : {{contradictoire|oui / non}}

RELEVÉS DES COMPTEURS : {{compteurs|Relevés eau / électricité}}
CLÉS REMISES : {{cles|Nombre et nature des clés}}

ÉTAT DES LIEUX :
{{etat_detail|Description pièce par pièce : murs, sols, plafonds, menuiseries,
installations, équipements}}

PHOTOS ANNEXÉES : {{photos|Liste / nombre de photos datées}}

Observations et réserves : {{reserves|Réserves}}

Signatures :
Le Bailleur                                   Le Locataire
_______________________                        _______________________
{{cabinet_nom|Cabinet}} (le cas échéant) : _______________________`,
  },
  {
    code: "TPL_ETAT_LIEUX_SORTIE",
    titre: "État des lieux de sortie",
    typeCode: "ETAT_LIEUX",
    contenu: `ÉTAT DES LIEUX DE SORTIE
Référence : {{reference_transaction|Référence}} — Bail : {{reference_bail|Référence du bail}}

Bailleur : {{bailleur_nom|Nom}} — Locataire : {{locataire_nom|Nom}}
Bien : {{designation_bien|Désignation}} — {{adresse_bien|Adresse}}
Date et heure : {{date_etat|Date}}

RELEVÉS DES COMPTEURS : {{compteurs|Relevés de sortie}}
CLÉS RESTITUÉES : {{cles|Clés restituées}}

COMPARAISON AVEC L'ÉTAT D'ENTRÉE :
{{comparaison|État comparé, dégradations éventuelles}}

DÉGRADATIONS / RETENUES ÉVENTUELLES : {{degradations|Dégradations constatées}}
RESTITUTION DU DÉPÔT DE GARANTIE : {{restitution|Montant et modalités}}

Signatures :
Le Bailleur                                   Le Locataire
_______________________                        _______________________
{{cabinet_nom|Cabinet}} (le cas échéant) : _______________________`,
  },
  {
    code: "TPL_INVENTAIRE_MOBILIER",
    titre: "Inventaire du mobilier",
    typeCode: "BAIL_HABITATION_MEUBLEE",
    contenu: `INVENTAIRE DU MOBILIER
Référence : {{reference_transaction|Référence}} — Bail : {{reference_bail|Référence du bail}}
Bien : {{designation_bien|Désignation}} — {{adresse_bien|Adresse}}
Date : {{date_inventaire|Date}}

LISTE DES ÉLÉMENTS (désignation, quantité, état) :
{{inventaire|Liste détaillée des meubles et équipements}}

Photos annexées : {{photos|Photos}}

Signatures :
Le Bailleur                                   Le Locataire
_______________________                        _______________________`,
  },
  {
    code: "TPL_QUITTANCE_LOYER",
    titre: "Quittance de loyer",
    typeCode: "BAIL_HABITATION_VIDE",
    contenu: `QUITTANCE DE LOYER
Référence : {{reference_quittance|Référence}}

Le Bailleur {{bailleur_nom|Nom}} reconnaît avoir reçu du Locataire
{{locataire_nom|Nom}} la somme de {{montant|Montant en chiffres}} {{devise|Devise}}
({{montant_lettres|Montant en lettres}}) au titre du loyer du bien situé
{{adresse_bien|Adresse}} pour la période du {{periode_debut|Début}}
au {{periode_fin|Fin}}.

Mode de paiement : {{mode_paiement|Mode}} — Référence : {{reference_paiement|Référence}}
Détail : loyer {{loyer|montant}} + charges {{charges|montant}} = {{total|total}}.

Fait à {{lieu|Lieu}}, le {{date|Date}}.

Le Bailleur / Le Cabinet pour le compte du Bailleur
_______________________`,
  },
  {
    code: "TPL_RECU_DEPOT_GARANTIE",
    titre: "Reçu de dépôt de garantie",
    typeCode: "BAIL_HABITATION_VIDE",
    contenu: `REÇU DE DÉPÔT DE GARANTIE
Référence : {{reference_recu|Référence}}

Nous soussigné(e)s, {{bailleur_nom|Bailleur}} / {{cabinet_nom|Cabinet}} agissant
pour le compte du Bailleur, reconnaissons avoir reçu de {{locataire_nom|Locataire}}
la somme de {{montant|Montant}} {{devise|Devise}} ({{montant_lettres|en lettres}})
au titre du dépôt de garantie du bail portant sur {{adresse_bien|le bien}}.

Ce dépôt sera restitué dans les conditions du bail, déduction faite des sommes
légitimement dues, après l'état des lieux de sortie.

Mode de versement : {{mode|Mode}} — Référence : {{reference_paiement|Référence}}

Fait à {{lieu|Lieu}}, le {{date|Date}}.

_______________________`,
  },
  {
    code: "TPL_AVENANT_BAIL",
    titre: "Avenant au bail",
    typeCode: "AVENANT_BAIL",
    validationMinimale: "JURISTE",
    contenu: `AVENANT AU CONTRAT DE BAIL
Référence : {{reference_transaction|Référence}} — Bail initial : {{reference_bail|Référence}}

ENTRE : {{bailleur_nom|Bailleur}}, ci-après « le Bailleur »,
ET : {{locataire_nom|Locataire}}, ci-après « le Locataire ».

Les parties conviennent de modifier le bail susvisé comme suit :

{{modifications|Modifications apportées (loyer, durée, destination, charges…)}}

Toutes les autres clauses du bail demeurent inchangées.
Date d'effet : {{date_effet|Date d'effet de l'avenant}}.

${CLAUSE_CABINET}

Fait à {{lieu_signature|Lieu}}, le {{date_signature|Date}}.

Le Bailleur                                  Le Locataire
_______________________                        _______________________`,
  },
  {
    code: "TPL_RESILIATION_AMIABLE_BAIL",
    titre: "Convention de résiliation amiable",
    typeCode: "RESILIATION_AMIABLE_BAIL",
    validationMinimale: "AVOCAT",
    contenu: `CONVENTION DE RÉSILIATION AMIABLE DE BAIL
Référence : {{reference_transaction|Référence}} — Bail : {{reference_bail|Référence du bail}}

ENTRE : {{bailleur_nom|Bailleur}}, ci-après « le Bailleur »,
ET : {{locataire_nom|Locataire}}, ci-après « le Locataire ».

1. Les parties conviennent de mettre fin au bail susvisé à compter du
   {{date_effet_resiliation|Date d'effet}}.
2. SOLDE : les comptes entre les parties sont arrêtés comme suit :
   {{solde|Loyers dus, charges, travaux — montants}}.
3. DÉPÔT DE GARANTIE : restitué au Locataire pour {{restitution|montant}},
   sous {{delai_restitution|délai}} après l'état des lieux de sortie.
4. ÉTAT DES LIEUX DE SORTIE : prévu le {{date_etat_sortie|date}} ; clés
   restituées selon PV annexé.
5. Les parties se donnent mutuellement quittance définitive sous réserve du
   paiement des sommes ci-dessus.

${CLAUSE_CABINET}

Fait à {{lieu_signature|Lieu}}, le {{date_signature|Date}}.

Le Bailleur                                  Le Locataire
_______________________                        _______________________`,
  },
  {
    code: "TPL_PV_REMISE_CLES",
    titre: "PV de remise des clés",
    typeCode: "BAIL_HABITATION_VIDE",
    contenu: `PROCÈS-VERBAL DE REMISE DES CLÉS
Référence : {{reference_transaction|Référence}}

Le {{date_remise|Date}}, à {{heure|Heure}}, ont été remises au Locataire
{{locataire_nom|Nom}} les clés du bien situé {{adresse_bien|adresse}} :

{{cles|Détail des clés / badges / télécommandes remis}}

Remises par : {{remis_par|Bailleur / cabinet / mandataire}}
Observations : {{observations|Observations}}

Le Bailleur / Représentant                     Le Locataire (lu et approuvé)
_______________________                        _______________________`,
  },
  {
    code: "TPL_PV_RESTITUTION_CLES",
    titre: "PV de restitution des clés",
    typeCode: "RESILIATION_AMIABLE_BAIL",
    contenu: `PROCÈS-VERBAL DE RESTITUTION DES CLÉS
Référence : {{reference_transaction|Référence}}

Le {{date_restitution|Date}}, le Locataire {{locataire_nom|Nom}} a restitué
au Bailleur {{bailleur_nom|Nom}} / à {{destinataire|son représentant}} les clés
du bien situé {{adresse_bien|adresse}} :

{{cles|Détail des clés / badges restitués}}

Le local est restitué libre de toute occupation. Référence à l'état des lieux
de sortie du {{date_etat_sortie|date}}.

Le Locataire                                 Le Bailleur / Représentant
_______________________                        _______________________`,
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
      const type = await db.transactionType.upsert({
        where: { code: spec.code },
        create: { ...typeData, pieces: { create: pieces.map((pc, i) => ({ ...pc, condition: pc.condition || null, ordre: i + 1 })) } },
        update: {}, // Ne pas écraser le paramétrage existant.
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

    // --- Modèles TPL ---
    for (const m of MODELES) {
      if (DRY_RUN) {
        console.log(`  [dry] modèle ${m.code}`);
        continue;
      }
      const { typeCode, ...data } = m;
      await db.transactionModele.upsert({
        where: { code: m.code },
        create: { ...data, typeId: typeCode ? typeIds[typeCode] || null : null },
        update: {}, // Ne pas écraser un modèle personnalisé.
      });
      console.log(`  modèle ${m.code} OK`);
    }

    await db.$disconnect();
  }
  await pub.$disconnect();
  console.log("\nTerminé.");
})();
