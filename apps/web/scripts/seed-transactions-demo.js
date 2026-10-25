/**
 * Données FICTIVES de démonstration du module « Transactions & contrats ».
 *
 * Crée des transactions exemples réparties sur les workflows :
 *  - ventes sous titre foncier (ouverture → dossier notarial → mutation
 *    inscrite → blocage hypothécaire),
 *  - baux (habitation, commercial — projet, en cours),
 *  - promesse de vente, mandat d'intermédiation, état des lieux,
 *  - avec parties (demandeurs fictifs), check-lists matérialisées,
 *    formalités externes, paiements tracés (bénéficiaires réels),
 *    journal d'événements et biens rattachés aux parcelles.
 *
 * Rappel juridique encodé : une vente privée seule ne clôture jamais une
 * vente TF — la démo s'arrête avant CLOTURE quand la preuve de mutation
 * au livre foncier manque.
 *
 * Idempotent : les transactions dont l'objet commence par « [DÉMO] » sont
 * ignorées si déjà présentes.
 *
 * Usage : node scripts/seed-transactions-demo.js [--dry-run] [--tenant=<slug>]
 */
process.loadEnvFile(".env");
const { PrismaClient: TenantClient } = require("@prisma/client");
const { PrismaClient: PublicClient } = require("../prisma/generated/public");

const DRY_RUN = process.argv.includes("--dry-run");
const TENANT_ARG = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1];
const MARK = "[DÉMO]";
const ANNEE = new Date().getFullYear();
const jours = (n) => new Date(Date.now() + n * 86400000);

/* Partage des personnes avec seed-demarches-demo (idempotent par nom). */
const DEMANDEURS = [
  { typePersonne: "PHYSIQUE", civilite: "M.", nom: "Ndiaye", prenoms: "Mamadou", nationalite: "Sénégalaise", profession: "Commerçant", pieceIdentiteType: "CNI", pieceIdentiteNumero: "1 852 1990 02341", adresse: "HLM Grand Yoff, villa 412", commune: "Dakar", region: "Dakar", telephone: "+221 77 555 12 34" },
  { typePersonne: "PHYSIQUE", civilite: "Mme", nom: "Fall", prenoms: "Aïssatou", nationalite: "Sénégalaise", profession: "Enseignante", pieceIdentiteType: "CNI", pieceIdentiteNumero: "2 741 1985 11872", adresse: "Sacré-Cœur 3, villa 9280", commune: "Dakar", region: "Dakar", telephone: "+221 78 410 55 21" },
  { typePersonne: "PHYSIQUE", civilite: "M.", nom: "Sarr", prenoms: "Ousmane", nationalite: "Sénégalaise", profession: "Retraité", pieceIdentiteType: "CNI", pieceIdentiteNumero: "1 120 1958 07314", adresse: "Mbao, quartier Colombiane", commune: "Rufisque", region: "Dakar", telephone: "+221 77 632 90 08" },
  { typePersonne: "PHYSIQUE", civilite: "Mme", nom: "Diop", prenoms: "Khady", nationalite: "Sénégalaise", profession: "Fonctionnaire", pieceIdentiteType: "CNI", pieceIdentiteNumero: "1 990 1992 44501", adresse: "Mermoz, rue 10 x 12", commune: "Dakar", region: "Dakar", telephone: "+221 76 208 77 44" },
  { typePersonne: "MORALE", nom: "TERANGA IMMOBILIER", raisonSociale: "TERANGA IMMOBILIER SARL", formeJuridique: "SARL", ninea: "006512398", rccm: "SN.DKR.2019.B.12455", siegeSocial: "Avenue Léopold Sédar Senghor, Dakar", representantLegal: "Ibrahima Gueye", qualiteSignataire: "Gérant", adresse: "Plateau, Dakar", commune: "Dakar", region: "Dakar", telephone: "+221 33 821 44 10", email: "contact@teranga-immo.sn" },
  { typePersonne: "MORALE", nom: "SEN BAOL AGRO", raisonSociale: "SEN BAOL AGRO SA", formeJuridique: "SA", ninea: "007781240", rccm: "SN.THS.2015.A.03812", siegeSocial: "Zone industrielle, Thiès", representantLegal: "Awa Niang", qualiteSignataire: "Présidente du Conseil d'administration", commune: "Thiès", region: "Thiès", telephone: "+221 33 951 20 30" },
];

const PARCELLES = [
  { commune: "Dakar", departement: "Dakar", region: "Dakar", quartier: "Almadies", adresse: "Lot 17, cité Almadies", nicad: "NCD-2024-00817", titreFoncier: "TF 12458/DKR", typeDroit: "titre_foncier", lot: "17", superficie: 640, uniteSuperficie: "m2", usageActuel: "Habitat", etatVerification: "VERIFIE" },
  { commune: "Rufisque", departement: "Rufisque", region: "Dakar", quartier: "Keury Souf", adresse: "Parcelle 284, Keury Souf", titreFoncier: "TF 09312/RFS", typeDroit: "titre_foncier", numeroParcelle: "284", superficie: 1200, uniteSuperficie: "m2", usageActuel: "Terrain nu", etatVerification: "A_VERIFIER" },
  { commune: "Dakar", departement: "Dakar", region: "Dakar", quartier: "Mermoz", adresse: "Lot 8, rue MZ-140", titreFoncier: "TF 15021/DKR", typeDroit: "titre_foncier", lot: "8", superficie: 450, uniteSuperficie: "m2", usageActuel: "Habitat", chargesInscriptions: "Hypothèque n°2019-7842 en faveur de la BHS", etatVerification: "VERIFIE" },
];

/* Biens démo : liés aux parcelles ci-dessus ou libres. */
const BIENS = [
  { nature: "VILLA", designation: "Villa R+1 — Almadies", adresse: "Lot 17, cité Almadies", quartier: "Almadies", commune: "Dakar", superficie: 640, uniteSuperficie: "m2", typeDroit: "titre_foncier", referenceDroit: "TF 12458/DKR", etatVerification: "VERIFIE", parcelle: 0, proprietaire: 0 },
  { nature: "TERRAIN", designation: "Terrain 1 200 m² — Keury Souf", adresse: "Parcelle 284, Keury Souf", quartier: "Keury Souf", commune: "Rufisque", superficie: 1200, uniteSuperficie: "m2", typeDroit: "titre_foncier", referenceDroit: "TF 09312/RFS", etatVerification: "A_VERIFIER", parcelle: 1, proprietaire: 2 },
  { nature: "APPARTEMENT", designation: "Appartement 4 pièces — Mermoz", adresse: "Lot 8, rue MZ-140", quartier: "Mermoz", commune: "Dakar", superficie: 118, uniteSuperficie: "m2", nbPieces: 4, typeDroit: "titre_foncier", referenceDroit: "TF 15021/DKR", etatVerification: "VERIFIE", parcelle: 2, proprietaire: 3 },
  { nature: "LOCAL_COMMERCIAL", designation: "Boutique double façade — Plateau", adresse: "Avenue Lamine Guèye", quartier: "Plateau", commune: "Dakar", superficie: 85, uniteSuperficie: "m2", typeDroit: "bail", referenceDroit: "Bail commercial 6 ans", loyerMensuel: 1200000, etatVerification: "PIECES_RECUES" },
  { nature: "IMMEUBLE", designation: "Immeuble d'habitation R+2 — HLM", adresse: "HLM Grand Yoff", quartier: "Grand Yoff", commune: "Dakar", superficie: 300, uniteSuperficie: "m2", nbPieces: 9, typeDroit: "propriete_coutumiere", etatVerification: "DECLARE", proprietaire: 1 },
];

/* Transactions démo — statuts répartis sur les workflows. */
const TRANSACTIONS = [
  {
    typeCode: "VENTE_IMMOBILIER_TF", statut: "DOSSIER_NOTARIAL_A_COMPLETER",
    objet: "Vente de la villa R+1 — Almadies (TF 12458/DKR)",
    prix: 185000000, devise: "XOF", priorite: "HAUTE",
    // Décomposition GESTIMMO : prix total = net vendeur + honoraires + TVA + taxes + notaire.
    netVendeur: 172100000, honorairesAgence: 5500000, tva: 990000,
    taxesMunicipales: 2710000, fraisNotaire: 3700000,
    bien: 0, parties: [
      { role: "VENDEUR", demandeur: 0 },
      { role: "ACHETEUR", nomLibre: "M. Cheikh Tidiane Bâ" },
      { role: "NOTAIRE", nomLibre: "Me Astou Ndiaye Ndiaye" },
    ],
    notaireNom: "Me Astou Ndiaye Ndiaye", notaireEtude: "Étude Ndiaye & Associés — Dakar",
    mandatSigne: true, etatDroitsReelsObtenu: true,
    signaturePrevue: jours(15),
    conditionsSuspensives: "Obtention du financement bancaire de l'acquéreur (BHS) sous 45 jours.",
    piecesStatus: "partiel",
    formalites: [
      { entite: "NOTAIRE", bureau: "Étude Ndiaye — Dakar", objet: "Projet d'acte authentique de vente", statut: "EN_INSTRUCTION", niveauObligation: "OBLIGATOIRE" },
      { entite: "DGID_CONSERVATION", bureau: "Conservation foncière de Dakar", objet: "État des droits réels sur TF 12458/DKR", statut: "ACCEPTE", niveauObligation: "OBLIGATOIRE", dateDepot: jours(-30), numeroRecepisse: "CFD-2026-6110" },
      { entite: "BANQUE_SEQUESTRE", bureau: "BHS — Agence Plateau", objet: "Séquestre du prix de vente", statut: "DEPOSE", niveauObligation: "OBLIGATOIRE" },
    ],
    paiements: [
      { nature: "HONORAIRES_CABINET", libelle: "Honoraires — rédaction et suivi de la vente", montant: 2775000, payeur: "M. Mamadou Ndiaye", beneficiaire: "Cabinet", mode: "VIREMENT", date: jours(-20), reference: "VIR-2610", rapproche: true },
      { nature: "FRAIS_NOTAIRE", libelle: "Provision de compte — étude notariale", montant: 3700000, payeur: "M. Cheikh Tidiane Bâ", beneficiaire: "Étude Ndiaye", mode: "SEQUESTRE", date: jours(-12), reference: "PRV-NDY-0042", rapproche: false },
      { nature: "DROITS_PUBLICITE_FONCIERE", libelle: "Droits de publicité foncière (estimation)", montant: 9250000, payeur: "M. Cheikh Tidiane Bâ", beneficiaire: "Conservation foncière", mode: "SEQUESTRE", date: jours(-12), rapproche: false },
    ],
    evts: [
      { type: "CHANGEMENT_STATUT", date: jours(-60), description: "Ouverture de la transaction — mandat du cabinet signé." },
      { type: "VALIDATION", date: jours(-45), description: "Vérification d'identité et de capacité des parties effectuée." },
      { type: "DEPOT", date: jours(-30), description: "Demande d'état des droits réels déposée à la Conservation — récépissé CFD-2026-6110." },
      { type: "DECISION", date: jours(-22), description: "État des droits réels reçu : propriété confirmée, pas d'inscription nouvelle." },
      { type: "TRANSMISSION_NOTAIRE", date: jours(-10), description: "Dossier transmis à Me Ndiaye pour rédaction du projet d'acte." },
    ],
    honoraires: 2775000, avancesRecues: 1500000,
  },
  {
    typeCode: "VENTE_IMMOBILIER_TF", statut: "BLOQUE_CHARGE_HYPOTHECAIRE",
    objet: "Vente de l'appartement Mermoz (TF 15021/DKR) — hypothèque BHS à lever",
    prix: 95000000, devise: "XOF", priorite: "NORMALE", risque: "ELEVE",
    bien: 2, parties: [
      { role: "VENDEUR", demandeur: 3 },
      { role: "ACHETEUR", demandeur: 4 },
    ],
    blocageMotif: "Hypothèque n°2019-7842 (BHS) inscrite sur le TF : mainlevée exigée avant la signature notariale. Démarche de radiation en cours (CFD-2026-2204).",
    mandatSigne: true,
    piecesStatus: "partiel",
    formalites: [
      { entite: "DGID_CONSERVATION", objet: "Radiation de l'hypothèque n°2019-7842", statut: "COMPLEMENT_DEMANDE", niveauObligation: "OBLIGATOIRE", dateDepot: jours(-35), numeroRecepisse: "CFD-2026-2204", notes: "Original de la mainlevée exigé par le Conservateur." },
      { entite: "BANQUE_SEQUESTRE", bureau: "BHS", objet: "Mainlevée amiable — extinction de la dette", statut: "EN_INSTRUCTION", niveauObligation: "OBLIGATOIRE" },
    ],
    paiements: [
      { nature: "FRAIS_HUISSIER", libelle: "Signification — demande de mainlevée", montant: 45000, payeur: "Mme Khady Diop", beneficiaire: "Étude d'huissier Fall", mode: "ESPECE", date: jours(-15), rapproche: true },
    ],
    evts: [
      { type: "CHANGEMENT_STATUT", date: jours(-50), description: "Ouverture — vérification foncière engagée." },
      { type: "DECISION", date: jours(-38), description: "État des droits réels : hypothèque BHS n°2019-7842 découverte sur le titre." },
      { type: "BLOCAGE", date: jours(-35), description: "Transaction bloquée : charge hypothécaire à lever (mainlevée BHS en cours)." },
    ],
    honoraires: 1425000, avancesRecues: 700000,
  },
  {
    typeCode: "VENTE_IMMOBILIER_TF", statut: "MUTATION_INSCRITE",
    objet: "Vente du terrain de Keury Souf (TF 09312/RFS) — mutation inscrite",
    prix: 60000000, devise: "XOF", priorite: "NORMALE",
    bien: 1, parties: [
      { role: "VENDEUR", demandeur: 2 },
      { role: "ACHETEUR", demandeur: 5 },
      { role: "NOTAIRE", nomLibre: "Me Babacar Thiam" },
    ],
    notaireNom: "Me Babacar Thiam", notaireEtude: "SCP Thiam & Fall — Rufisque",
    mandatSigne: true, etatDroitsReelsObtenu: true,
    acteSigneLe: jours(-40), depotConservationLe: jours(-30),
    mutationInscrite: true, mutationInscriteLe: jours(-6),
    piecesStatus: "toutes",
    formalites: [
      { entite: "NOTAIRE", bureau: "SCP Thiam & Fall — Rufisque", objet: "Acte authentique de vente", statut: "CLOTURE", niveauObligation: "OBLIGATOIRE", decisionDate: jours(-40) },
      { entite: "DGID_ENREGISTREMENT", objet: "Enregistrement de l'acte de vente — droits liquidés", statut: "ACCEPTE", niveauObligation: "OBLIGATOIRE", dateDepot: jours(-35), numeroRecepisse: "DEDT-2026-09112" },
      { entite: "DGID_CONSERVATION", objet: "Inscription de la mutation au livre foncier", statut: "ACCEPTE", niveauObligation: "OBLIGATOIRE", dateDepot: jours(-30), numeroRecepisse: "CFD-2026-4408", decisionDate: jours(-6) },
    ],
    paiements: [
      { nature: "PRIX_DE_VENTE", libelle: "Prix de vente — séquestre notaire puis virement vendeur", montant: 60000000, payeur: "SEN BAOL AGRO SA", beneficiaire: "M. Ousmane Sarr (via séquestre SCP Thiam)", mode: "SEQUESTRE", date: jours(-40), reference: "SEQ-THM-118", rapproche: true },
      { nature: "FRAIS_NOTAIRE", montant: 1200000, payeur: "SEN BAOL AGRO SA", beneficiaire: "SCP Thiam & Fall", mode: "VIREMENT", date: jours(-40), rapproche: true },
      { nature: "DROITS_ENREGISTREMENT", montant: 3000000, payeur: "SEN BAOL AGRO SA", beneficiaire: "DGID — Enregistrement", mode: "VIREMENT", date: jours(-35), reference: "TQ-2026-0991", rapproche: true },
      { nature: "DROITS_PUBLICITE_FONCIERE", montant: 3000000, payeur: "SEN BAOL AGRO SA", beneficiaire: "Conservation foncière", mode: "VIREMENT", date: jours(-30), reference: "TQ-2026-1044", rapproche: true },
      { nature: "HONORAIRES_CABINET", libelle: "Honoraires — coordination vente et mutation", montant: 1500000, payeur: "M. Ousmane Sarr", beneficiaire: "Cabinet", mode: "VIREMENT", date: jours(-25), rapproche: true },
    ],
    evts: [
      { type: "CHANGEMENT_STATUT", date: jours(-90), description: "Ouverture de la transaction." },
      { type: "SIGNATURE", date: jours(-40), description: "Acte authentique de vente signé devant Me Thiam (Rufisque)." },
      { type: "DEPOT", date: jours(-30), description: "Dépôt à la Conservation foncière — récépissé CFD-2026-4408." },
      { type: "DECISION", date: jours(-6), description: "Mutation inscrite au livre foncier : acquéreur inscrit — attestation conservée." },
    ],
    honoraires: 1500000, avancesRecues: 1500000,
  },
  {
    typeCode: "BAIL_HABITATION_VIDE", statut: "BAIL_EN_COURS",
    objet: "Bail d'habitation — appartement 4 pièces, Mermoz",
    loyer: 450000, depotGarantie: 900000, avanceLoyer: 450000, devise: "XOF",
    dureeMois: 24, jourEcheanceLoyer: 5, renouvellement: "Tacite reconduction annuelle",
    chargesMensuelles: 30000, chargesMode: "FIXE",
    modePaiementLoyer: "VIREMENT",
    commissionType: "POURCENTAGE", commissionValeur: 9,
    commissionBase: "Loyers et charges encaissés TTC",
    clausesParticulieres: [
      "Interdiction de sous-location sans accord écrit du bailleur.",
      "Charges locatives (eau, électricité, gardiennage) à la charge du locataire.",
      "Clause résolutoire : 2 mensualités impayées après commandement resté infructueux.",
    ],
    dateEffet: jours(-60), dateFin: jours(665),
    bien: 2, parties: [
      { role: "BAILLEUR", demandeur: 3 },
      { role: "LOCATAIRE", nomLibre: "M. Modou Gueye" },
      { role: "GARANT", nomLibre: "Mme Fatou Gueye (sœur du locataire)" },
    ],
    droitDeLouerVerifie: true, etatLieuxEntreeFait: true,
    // Échéancier locatif + reversements bailleur + état des lieux (GESTIMMO).
    // periode = 1er jour du mois ; nature LOYER | CHARGES | REVERSEMENT_BAILLEUR.
    echeances: (() => {
      const periode = (m) => {
        const d = new Date(); d.setMonth(d.getMonth() - m);
        return new Date(d.getFullYear(), d.getMonth(), 1);
      };
      const paye = (m) => {
        const d = new Date(); d.setMonth(d.getMonth() - m); d.setDate(5);
        return d;
      };
      return [
        { nature: "LOYER", periode: periode(2), montantDu: 450000, montantPaye: 450000, statut: "PAYE", payeLe: paye(2), modePaiement: "VIREMENT" },
        { nature: "CHARGES", periode: periode(2), montantDu: 30000, montantPaye: 30000, statut: "PAYE", payeLe: paye(2), modePaiement: "VIREMENT" },
        { nature: "REVERSEMENT_BAILLEUR", periode: periode(2), montantDu: 436800, montantPaye: 436800, statut: "PAYE", payeLe: jours(-38), modePaiement: "VIREMENT", beneficiaire: "Mme Khady Diop (bailleur)", note: "Loyer + charges − commission cabinet (9 %)." },
        { nature: "LOYER", periode: periode(1), montantDu: 450000, montantPaye: 240000, statut: "PARTIEL", payeLe: jours(-20), modePaiement: "MOBILE_MONEY" },
        { nature: "CHARGES", periode: periode(1), montantDu: 30000, montantPaye: 0, statut: "EN_RETARD" },
        { nature: "REVERSEMENT_BAILLEUR", periode: periode(1), montantDu: 218400, montantPaye: 0, statut: "A_PERCEVOIR", beneficiaire: "Mme Khady Diop (bailleur)", note: "Reversement partiel en attente du solde du loyer." },
        { nature: "LOYER", periode: periode(0), montantDu: 450000, montantPaye: 0, statut: "EN_RETARD" },
        { nature: "CHARGES", periode: periode(0), montantDu: 30000, montantPaye: 0, statut: "EN_RETARD" },
        { nature: "LOYER", periode: periode(-1), montantDu: 450000, montantPaye: 0, statut: "A_PERCEVOIR" },
        { nature: "CHARGES", periode: periode(-1), montantDu: 30000, montantPaye: 0, statut: "A_PERCEVOIR" },
        { nature: "REVERSEMENT_BAILLEUR", periode: periode(-1), montantDu: 436800, montantPaye: 0, statut: "A_PERCEVOIR", beneficiaire: "Mme Khady Diop (bailleur)" },
      ];
    })(),
    etatsLieux: [
      {
        typeLocation: "VIDE", statut: "FINALISE_ENTREE", nbCles: 4, nbPieces: 4,
        etage: "2e étage", surface: 95, dependances: "Balcon, débarras",
        compteurEau: "014582", compteurElectricite: "108847",
        representant: "Huissier de justice présent",
        observations: "État général correct. Peintures du salon légèrement défraîchies.",
        lignes: [
          { objet: "Porte d'entrée", emplacement: "Entrée", typeElement: "MENUISERIE", quantiteEntree: 1, etatEntree: "BON", obsEntree: "Fermeture correcte, serrure 3 points." },
          { objet: "Fenêtre coulissante", emplacement: "Salon", typeElement: "MENUISERIE", quantiteEntree: 2, etatEntree: "BON" },
          { objet: "Mur", emplacement: "Salon", typeElement: "PEINTURE", etatEntree: "USE", obsEntree: "Traces d'humidité mineures angle nord." },
          { objet: "Sol carrelé", emplacement: "Cuisine", typeElement: "SOL", etatEntree: "BON" },
          { objet: "Robinet évier", emplacement: "Cuisine", typeElement: "SANITAIRE", quantiteEntree: 1, etatEntree: "BON" },
          { objet: "Chasse d'eau", emplacement: "WC", typeElement: "SANITAIRE", quantiteEntree: 1, etatEntree: "DEGRADE", obsEntree: "Fuite légère — à réparer à charge du bailleur." },
          { objet: "Interrupteur", emplacement: "Chambre 1", typeElement: "ELECTRIQUE", quantiteEntree: 2, etatEntree: "BON" },
        ],
      },
    ],
    acteSigneLe: jours(-65),
    piecesStatus: "toutes",
    formalites: [
      { entite: "DGID_ENREGISTREMENT", objet: "Enregistrement du bail — obligation fiscale", statut: "A_PREPARER", niveauObligation: "CONDITIONNELLE" },
    ],
    paiements: [
      { nature: "DEPOT_GARANTIE", montant: 900000, payeur: "M. Modou Gueye", beneficiaire: "Mme Khady Diop (bailleur)", mode: "VIREMENT", date: jours(-60), reference: "QT-BAIL-01", rapproche: true },
      { nature: "AVANCE_LOYER", montant: 450000, payeur: "M. Modou Gueye", beneficiaire: "Mme Khady Diop (bailleur)", mode: "VIREMENT", date: jours(-60), rapproche: true },
      { nature: "LOYER", libelle: "Loyer mois en cours", montant: 450000, payeur: "M. Modou Gueye", beneficiaire: "Mme Khady Diop (bailleur)", mode: "MOBILE_MONEY", date: jours(-8), reference: "OM-77845512", rapproche: false },
      { nature: "HONORAIRES_CABINET", libelle: "Rédaction du bail + état des lieux", montant: 200000, payeur: "Mme Khady Diop", beneficiaire: "Cabinet", mode: "VIREMENT", date: jours(-55), rapproche: true },
    ],
    evts: [
      { type: "CHANGEMENT_STATUT", date: jours(-75), description: "Ouverture — contrôle du droit de louer de la bailleuse." },
      { type: "SIGNATURE", date: jours(-65), description: "Bail signé par les deux parties — 3 exemplaires originaux." },
      { type: "DEPOT", date: jours(-62), description: "État des lieux d'entrée contradictoire établi (huissier présent)." },
      { type: "REMISE", date: jours(-60), description: "Remise des clés au locataire — PV signé." },
    ],
    honoraires: 200000, avancesRecues: 200000,
  },
  {
    typeCode: "BAIL_COMMERCIAL", statut: "PROJET_BAIL",
    objet: "Bail commercial 6 ans — boutique Plateau (TERANGA IMMOBILIER)",
    loyer: 1200000, depotGarantie: 3600000, devise: "XOF", dureeMois: 72,
    priorite: "HAUTE",
    bien: 3, parties: [
      { role: "BAILLEUR", nomLibre: "SCI Les Almadies (repr. M. Alioune Fall)" },
      { role: "LOCATAIRE", demandeur: 4 },
    ],
    droitDeLouerVerifie: true,
    conditionsSuspensives: "Destination : commerce général. Clause résolutoire à 2 mensualités impayées.",
    piecesStatus: "partiel",
    evts: [
      { type: "CHANGEMENT_STATUT", date: jours(-15), description: "Négociation — lettre d'intention signée." },
      { type: "DEMANDE_PIECE", date: jours(-8), description: "RCCM + NINEA du locataire demandés pour le projet de bail." },
    ],
    honoraires: 600000,
  },
  {
    typeCode: "PROMESSE_VENTE_IMMOBILIER", statut: "EXECUTION_EN_COURS",
    objet: "Promesse de vente — immeuble R+2 HLM Grand Yoff",
    prix: 120000000, devise: "XOF", priorite: "NORMALE",
    bien: 4, parties: [
      { role: "VENDEUR", demandeur: 1 },
      { role: "ACHETEUR", nomLibre: "M. Serigne Modou Kane" },
    ],
    acteSigneLe: jours(-20),
    conditionsSuspensives: "Régularisation foncière du bien (propriété coutumière → TF) avant l'acte authentique.",
    signaturePrevue: jours(75),
    piecesStatus: "partiel",
    paiements: [
      { nature: "PRIX_DE_VENTE", libelle: "Séquestre de garantie 10 % — promesse", montant: 12000000, payeur: "M. Serigne Modou Kane", beneficiaire: "Compte séquestre du cabinet", mode: "CHEQUE", date: jours(-20), reference: "CHQ-0021456", rapproche: true },
      { nature: "HONORAIRES_CABINET", libelle: "Rédaction de la promesse synallagmatique", montant: 800000, payeur: "M. Serigne Modou Kane", beneficiaire: "Cabinet", mode: "ESPECE", date: jours(-20), rapproche: true },
    ],
    evts: [
      { type: "CHANGEMENT_STATUT", date: jours(-30), description: "Promesse rédigée après qualification du droit du bien." },
      { type: "SIGNATURE", date: jours(-20), description: "Promesse synallagmatique signée — séquestre de 12 M encaissé." },
      { type: "NOTE", date: jours(-5), description: "Rappel : vente définitive subordonnée à l'immatriculation du terrain." },
    ],
    honoraires: 800000, avancesRecues: 800000,
  },
  {
    typeCode: "MANDAT_INTERMEDIATION", statut: "MANDAT_SIGNE",
    objet: "Mandat de recherche — bureaux pour SEN BAOL AGRO (Dakar)",
    priorite: "NORMALE",
    typeMandat: "SIMPLE", commissionType: "POURCENTAGE", commissionValeur: 5,
    commissionBase: "Premier loyer annuel",
    parties: [{ role: "MANDANT", demandeur: 5 }],
    piecesStatus: "toutes",
    evts: [
      { type: "CHANGEMENT_STATUT", date: jours(-25), description: "Mandat d'intermédiation négocié — honoraires 5 % du premier loyer annuel." },
      { type: "SIGNATURE", date: jours(-18), description: "Mandat signé par la PCA — recherche active lancée." },
    ],
    honoraires: 0, honorairesNote: "Honoraires conditionnels : 5 % du loyer annuel à la signature du bail.",
  },
  {
    typeCode: "ETAT_LIEUX", statut: "BROUILLON",
    objet: "État des lieux de sortie — appartement F3 Sacré-Cœur",
    bien: null, parties: [
      { role: "BAILLEUR", nomLibre: "M. Arona Diouf" },
      { role: "LOCATAIRE", demandeur: 1 },
    ],
    signaturePrevue: jours(10),
    piecesStatus: "debut",
    evts: [
      { type: "NOTE", date: jours(-2), description: "Rendez-vous convenu avec l'huissier — état des lieux contradictoire à préparer." },
    ],
    honoraires: 75000,
  },
];

/* Enrichissements annexes : échéances (loyer / charges / reversement
   bailleur) et états des lieux. Idempotent — ne crée que si la
   collection est vide. */
async function enrichirTransaction(db, transaction, spec, user) {
  if (DRY_RUN) {
    if (spec.echeances?.length || spec.etatsLieux?.length) {
      console.log(`  [dry] enrichissement : ${spec.echeances?.length || 0} échéance(s), ${spec.etatsLieux?.length || 0} état(s) des lieux`);
    }
    return;
  }
  // Échéances locatives (loyer + charges + reversements bailleur).
  if (spec.echeances?.length) {
    const nb = await db.transactionEcheance.count({ where: { transactionId: transaction.id } });
    if (nb === 0) {
      for (const e of spec.echeances) {
        let paiementId = null;
        if (e.payeLe && e.montantPaye > 0 && e.nature !== "REVERSEMENT_BAILLEUR") {
          const periodeLabel = e.periode.toISOString().slice(0, 7);
          const pay = await db.transactionPaiement.create({
            data: {
              transactionId: transaction.id,
              nature: e.nature === "CHARGES" ? "AUTRE" : "LOYER",
              libelle: `${e.nature === "CHARGES" ? "Charges" : "Loyer"} ${periodeLabel}`,
              montant: e.montantPaye,
              devise: spec.devise || "XOF",
              payeur: "M. Modou Gueye",
              beneficiaire: e.beneficiaire || "Cabinet — compte dédié",
              mode: e.modePaiement || "VIREMENT", date: e.payeLe,
              rapproche: true,
              creePar: user?.id || "seed",
            },
          });
          paiementId = pay.id;
        }
        await db.transactionEcheance.create({
          data: {
            transactionId: transaction.id,
            nature: e.nature || "LOYER",
            periode: e.periode,
            jourEcheance: e.jourEcheance ?? spec.jourEcheanceLoyer ?? 5,
            montantDu: e.montantDu,
            montantPaye: e.montantPaye || 0,
            statut: e.statut || "A_PERCEVOIR",
            payeLe: e.payeLe || null,
            modePaiement: e.modePaiement || null,
            beneficiaire: e.beneficiaire || null,
            note: e.note || null,
            paiementId,
            creePar: user?.id || "seed",
          },
        });
      }
      console.log(`    + ${spec.echeances.length} échéance(s) (loyer/charges/reversement)`);
    }
  }

  // États des lieux + lignes.
  if (spec.etatsLieux?.length) {
    const nb = await db.etatLieux.count({ where: { transactionId: transaction.id } });
    if (nb === 0) {
      for (const el of spec.etatsLieux) {
        const { lignes, ...data } = el;
        const etat = await db.etatLieux.create({
          data: {
            ...data, transactionId: transaction.id,
            dateEntree: el.dateEntree || transaction.dateEffet || null,
            creePar: user?.id || "seed",
          },
        });
        if (lignes?.length) {
          await db.etatLieuxLigne.createMany({
            data: lignes.map((l, i) => ({ ...l, etatLieuxId: etat.id, ordre: i })),
          });
        }
        console.log(`    + état des lieux (${el.statut}, ${lignes?.length || 0} lignes)`);
      }
    }
  }
}

/* Check-list matérialisée. */
function piecesFor(mode, pieces) {
  const total = pieces.length;
  return pieces.map((p, i) => {
    let statut = "NON_DEMANDEE";
    if (mode === "toutes") statut = "VALIDEE";
    else if (mode === "partiel") {
      statut =
        i < Math.ceil(total * 0.5)
          ? i % 3 === 0 ? "VALIDEE" : "RECUE"
          : i < Math.ceil(total * 0.7) ? "DEMANDEE" : "NON_DEMANDEE";
    } else if (mode === "depot") {
      if (p.categorie === "DOCUMENT_ADMINISTRATIF_A_OBTENIR") statut = "NON_DEMANDEE";
      else if (p.categorie === "PREUVE_DE_DEPOT_ET_SUIVI") statut = "RECUE";
      else statut = "VALIDEE";
    }
    return {
      code: p.code, libelle: p.libelle, categorie: p.categorie, niveau: p.niveau,
      condition: p.condition, partieConcernee: p.partieConcernee,
      sourceAttendue: p.sourceAttendue, ordre: p.ordre, statut,
      recueLe: ["RECUE", "VALIDEE"].includes(statut) ? jours(-15) : null,
      verifieLe: statut === "VALIDEE" ? jours(-12) : null,
    };
  });
}

(async () => {
  const pub = new PublicClient();
  let tenants = await pub.tenant.findMany();
  if (TENANT_ARG) tenants = tenants.filter((t) => t.slug === TENANT_ARG || t.id === TENANT_ARG);
  const base = process.env.DATABASE_URL;

  for (const t of tenants) {
    const url = t.databaseUrl || `${base}${base.includes("?") ? "&" : "?"}schema=${t.schemaName}`;
    const db = new TenantClient({ datasources: { db: { url } } });
    console.log(`\n===== TENANT ${t.slug || t.id} (${t.schemaName}) =====`);

    const types = await db.transactionType.findMany({
      include: { pieces: { where: { actif: true }, orderBy: { ordre: "asc" } } },
    });
    if (!types.length) {
      console.log("  ⚠ Aucun type de transaction : lancez d'abord scripts/seed-transactions.js");
      await db.$disconnect();
      continue;
    }
    const typeByCode = Object.fromEntries(types.map((ty) => [ty.code, ty]));

    let dossiers = await db.dossier.findMany({ take: 8, orderBy: { createdAt: "desc" } });
    const user = await db.user.findFirst({ where: { actif: true }, orderBy: { createdAt: "asc" } });
    if (!dossiers.length) {
      if (!user) { console.log("  ⚠ Aucun utilisateur ni dossier — seed impossible."); await db.$disconnect(); continue; }
      if (DRY_RUN) {
        console.log("  [dry] aucun dossier : un client + dossier de démonstration seront créés");
        dossiers = [{ id: "dry" }];
      } else {
        let client = await db.client.findFirst();
        if (!client) {
          client = await db.client.create({ data: { type: "personne_morale", raisonSociale: "CLIENT DÉMONSTRATION SARL" } });
          console.log("  + client de démonstration créé");
        }
        const dossier = await db.dossier.create({
          data: {
            referenceInterne: `DEMO-TRX-${ANNEE}-001`, typeAffaire: "FONCIER",
            natureMission: ["conseil"], clientId: client.id,
            avocatResponsableId: user.id, createurId: user.id,
          },
        });
        dossiers = [dossier];
        console.log("  + dossier de démonstration créé");
      }
    }

    // Demandeurs fictifs (partagés avec le seed démarches — idempotent).
    const demandeurIds = [];
    for (const d of DEMANDEURS) {
      const exist = await db.demandeur.findFirst({ where: { nom: d.nom, prenoms: d.prenoms ?? undefined, raisonSociale: d.raisonSociale ?? undefined } });
      if (exist) { demandeurIds.push(exist.id); continue; }
      if (DRY_RUN) { demandeurIds.push("dry"); continue; }
      const c = await db.demandeur.create({ data: d });
      demandeurIds.push(c.id);
      console.log(`  + demandeur ${d.raisonSociale || `${d.prenoms} ${d.nom}`}`);
    }

    // Parcelles fictives (idempotent par adresse + commune).
    const parcelleIds = [];
    for (const p of PARCELLES) {
      const exist = await db.parcelle.findFirst({ where: { commune: p.commune, adresse: p.adresse } });
      if (exist) { parcelleIds.push(exist.id); continue; }
      if (DRY_RUN) { parcelleIds.push("dry"); continue; }
      const c = await db.parcelle.create({ data: { ...p, titulaires: [{ nom: "Demandeur", qualite: "Propriétaire / titulaire du droit", quotePart: "100%" }] } });
      parcelleIds.push(c.id);
      console.log(`  + parcelle ${p.adresse} (${p.commune})`);
    }

    // Biens (idempotent par désignation).
    const bienIds = [];
    for (const b of BIENS) {
      const exist = await db.bien.findFirst({ where: { designation: b.designation } });
      if (exist) { bienIds.push(exist.id); continue; }
      if (DRY_RUN) { bienIds.push("dry"); continue; }
      const { parcelle, proprietaire, ...data } = b;
      const c = await db.bien.create({
        data: {
          ...data,
          parcelleId: parcelle != null ? parcelleIds[parcelle] : null,
          proprietaireId: proprietaire != null ? demandeurIds[proprietaire] : null,
        },
      });
      bienIds.push(c.id);
      console.log(`  + bien ${b.designation}`);
    }

    let creees = 0;
    for (let i = 0; i < TRANSACTIONS.length; i++) {
      const spec = TRANSACTIONS[i];
      const type = typeByCode[spec.typeCode];
      if (!type) { console.log(`  ⚠ type ${spec.typeCode} absent — ignoré`); continue; }

      const objet = spec.objet.startsWith(MARK) ? spec.objet : `${MARK} ${spec.objet}`;
      const exist = await db.transaction.findFirst({ where: { objet } });
      if (exist) {
        console.log(`  = ${spec.typeCode} déjà présent (${exist.reference})`);
        // Complète les nouveaux champs financiers encore vides sur les
        // transactions démo existantes (n'écrase jamais une valeur saisie).
        if (!DRY_RUN) {
          const patch = {};
          const champs = [
            "chargesMensuelles", "chargesMode", "modePaiementLoyer",
            "typeMandat", "commissionType", "commissionValeur", "commissionBase",
            "honorairesAgence", "tva", "taxesMunicipales", "fraisNotaire", "netVendeur",
          ];
          for (const c of champs) {
            if (spec[c] != null && exist[c] == null) patch[c] = spec[c];
          }
          if (spec.clausesParticulieres && !exist.clausesParticulieres) {
            patch.clausesParticulieres = spec.clausesParticulieres;
          }
          if (Object.keys(patch).length) {
            await db.transaction.update({ where: { id: exist.id }, data: patch });
            console.log(`    + champs complétés : ${Object.keys(patch).join(", ")}`);
          }
        }
        await enrichirTransaction(db, exist, spec, user);
        continue;
      }
      if (DRY_RUN) { console.log(`  [dry] transaction ${spec.typeCode} → ${spec.statut}`); continue; }

      const compte = await db.transaction.count({ where: { reference: { startsWith: `TRX-${ANNEE}-` } } });
      const reference = `TRX-${ANNEE}-${String(compte + 1).padStart(4, "0")}`;
      const dossier = dossiers[i % dossiers.length];
      const estBloque = spec.statut.startsWith("BLOQUE_");

      const transaction = await db.transaction.create({
        data: {
          reference,
          typeId: type.id,
          statut: estBloque ? spec.statut : spec.statut,
          blocage: estBloque ? spec.statut : null,
          blocageMotif: spec.blocageMotif || null,
          priorite: spec.priorite || "NORMALE",
          risque: spec.risque || (type.sensible ? "ELEVE" : "STANDARD"),
          dossierId: dossier.id === "dry" ? dossiers[0].id : dossier.id,
          objet,
          prix: spec.prix ?? null,
          devise: spec.devise || "XOF",
          loyer: spec.loyer ?? null,
          depotGarantie: spec.depotGarantie ?? null,
          avanceLoyer: spec.avanceLoyer ?? null,
          jourEcheanceLoyer: spec.jourEcheanceLoyer ?? null,
          notaireNom: spec.notaireNom || null,
          notaireEtude: spec.notaireEtude || null,
          mandatSigne: !!spec.mandatSigne,
          etatDroitsReelsObtenu: !!spec.etatDroitsReelsObtenu,
          depotConservationLe: spec.depotConservationLe || null,
          mutationInscrite: !!spec.mutationInscrite,
          mutationInscriteLe: spec.mutationInscriteLe || null,
          dateEffet: spec.dateEffet || null,
          dateFin: spec.dateFin || null,
          dureeMois: spec.dureeMois ?? null,
          renouvellement: spec.renouvellement || null,
          chargesMensuelles: spec.chargesMensuelles ?? null,
          chargesMode: spec.chargesMode || null,
          chargesIncluses: !!spec.chargesIncluses,
          modePaiementLoyer: spec.modePaiementLoyer || null,
          clausesParticulieres: spec.clausesParticulieres || null,
          typeMandat: spec.typeMandat || null,
          commissionType: spec.commissionType || null,
          commissionValeur: spec.commissionValeur ?? null,
          commissionBase: spec.commissionBase || null,
          honorairesAgence: spec.honorairesAgence ?? null,
          tva: spec.tva ?? null,
          taxesMunicipales: spec.taxesMunicipales ?? null,
          fraisNotaire: spec.fraisNotaire ?? null,
          netVendeur: spec.netVendeur ?? null,
          droitDeLouerVerifie: !!spec.droitDeLouerVerifie,
          etatLieuxEntreeFait: !!spec.etatLieuxEntreeFait,
          conditionsSuspensives: spec.conditionsSuspensives || null,
          signaturePrevue: spec.signaturePrevue || null,
          acteSigneLe: spec.acteSigneLe || null,
          responsableId: user?.id || null,
          honoraires: spec.honoraires || 0,
          debours: spec.debours || 0,
          avancesRecues: spec.avancesRecues || 0,
          creePar: user?.id || "seed",
        },
      });

      // Parties.
      for (let pi = 0; pi < (spec.parties || []).length; pi++) {
        const p = spec.parties[pi];
        await db.transactionPartie.create({
          data: {
            transactionId: transaction.id,
            role: p.role,
            demandeurId: p.demandeur != null ? demandeurIds[p.demandeur] : null,
            nomLibre: p.nomLibre || null,
            qualite: p.qualite || null,
            ordre: pi,
          },
        });
      }

      // Bien rattaché.
      if (spec.bien != null && bienIds[spec.bien] && bienIds[spec.bien] !== "dry") {
        await db.transactionBien.create({
          data: { transactionId: transaction.id, bienId: bienIds[spec.bien], role: "PRINCIPAL" },
        });
      }

      // Check-list matérialisée.
      if (type.pieces.length) {
        await db.transactionPiece.createMany({
          data: piecesFor(spec.piecesStatus || "debut", type.pieces).map((p) => ({
            ...p, transactionId: transaction.id,
          })),
        });
      }

      // Formalités externes.
      for (const f of spec.formalites || []) {
        await db.transactionFormalite.create({
          data: {
            transactionId: transaction.id,
            entite: f.entite, bureau: f.bureau || null, objet: f.objet,
            niveauObligation: f.niveauObligation || "CONDITIONNELLE",
            statut: f.statut || "BROUILLON",
            dateDepot: f.dateDepot || null,
            numeroRecepisse: f.numeroRecepisse || null,
            decisionDate: f.decisionDate || null,
            notes: f.notes || null,
            creePar: user?.id || "seed",
          },
        });
      }

      // Paiements.
      for (const pay of spec.paiements || []) {
        await db.transactionPaiement.create({
          data: {
            transactionId: transaction.id,
            nature: pay.nature, libelle: pay.libelle || null,
            montant: pay.montant, devise: spec.devise || "XOF",
            payeur: pay.payeur || null, beneficiaire: pay.beneficiaire || null,
            mode: pay.mode || null, date: pay.date || new Date(),
            reference: pay.reference || null, rapproche: !!pay.rapproche,
            creePar: user?.id || "seed",
          },
        });
      }

      // Journal.
      for (const e of spec.evts || []) {
        await db.transactionEvenement.create({
          data: {
            transactionId: transaction.id, type: e.type, date: e.date || new Date(),
            description: e.description, details: e.details || null,
            creePar: user?.id || "seed",
          },
        });
      }
      if (spec.honorairesNote) {
        await db.transactionEvenement.create({
          data: {
            transactionId: transaction.id, type: "NOTE", date: new Date(),
            description: spec.honorairesNote, creePar: user?.id || "seed",
          },
        });
      }

      await enrichirTransaction(db, transaction, spec, user);

      creees++;
      console.log(`  + ${reference} — ${type.libelle} → ${spec.statut}`);
    }

    console.log(`  => ${creees} transaction(s) fictive(s) créée(s)`);
    await db.$disconnect();
  }
  console.log("\nTerminé.");
  await pub.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
