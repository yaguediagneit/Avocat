/**
 * Données FICTIVES de démonstration du module « Démarches administratives ».
 *
 * Crée, pour chacun des 16 types, une démarche exemple avec :
 *  - demandeurs et parcelles fictifs sénégalais,
 *  - check-list matérialisée (statuts de pièces variés),
 *  - journal d'événements (création, dépôt, relance, décision…),
 *  - frais (honoraires, débours, taxes, timbres, avances).
 *
 * Les statuts sont répartis pour couvrir tout le workflow et alimenter le
 * tableau de bord : brouillon, à qualifier, attente client, pièces
 * partielles, contrôle interne, prêt validation / dépôt, déposé, en
 * instruction, complément demandé, relance, accepté, refusé, délivré.
 *
 * Idempotent : les démarches dont l'objet commence par « [DÉMO] » sont
 * ignorées si déjà présentes. Rattachement aux dossiers existants ; si
 * aucun dossier n'existe, un client + dossier de démonstration sont créés.
 *
 * Usage : node scripts/seed-demarches-demo.js [--dry-run] [--tenant=<slug>]
 */
process.loadEnvFile(".env");
const { PrismaClient: TenantClient } = require("@prisma/client");
const { PrismaClient: PublicClient } = require("../prisma/generated/public");

const DRY_RUN = process.argv.includes("--dry-run");
const TENANT_ARG = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1];
const MARK = "[DÉMO]";
const ANNEE = new Date().getFullYear();

const jours = (n) => new Date(Date.now() + n * 86400000);

/* ------------------------------------------------------------------ */
/* Demandeurs fictifs                                                  */
/* ------------------------------------------------------------------ */
const DEMANDEURS = [
  { typePersonne: "PHYSIQUE", civilite: "M.", nom: "Ndiaye", prenoms: "Mamadou", nationalite: "Sénégalaise", profession: "Commerçant", pieceIdentiteType: "CNI", pieceIdentiteNumero: "1 852 1990 02341", adresse: "HLM Grand Yoff, villa 412", commune: "Dakar", region: "Dakar", telephone: "+221 77 555 12 34" },
  { typePersonne: "PHYSIQUE", civilite: "Mme", nom: "Fall", prenoms: "Aïssatou", nationalite: "Sénégalaise", profession: "Enseignante", pieceIdentiteType: "CNI", pieceIdentiteNumero: "2 741 1985 11872", adresse: "Sacré-Cœur 3, villa 9280", commune: "Dakar", region: "Dakar", telephone: "+221 78 410 55 21" },
  { typePersonne: "PHYSIQUE", civilite: "M.", nom: "Sarr", prenoms: "Ousmane", nationalite: "Sénégalaise", profession: "Retraité", pieceIdentiteType: "CNI", pieceIdentiteNumero: "1 120 1958 07314", adresse: "Mbao, quartier Colombiane", commune: "Rufisque", region: "Dakar", telephone: "+221 77 632 90 08" },
  { typePersonne: "PHYSIQUE", civilite: "Mme", nom: "Diop", prenoms: "Khady", nationalite: "Sénégalaise", profession: "Fonctionnaire", pieceIdentiteType: "CNI", pieceIdentiteNumero: "1 990 1992 44501", adresse: "Mermoz, rue 10 x 12", commune: "Dakar", region: "Dakar", telephone: "+221 76 208 77 44" },
  { typePersonne: "MORALE", nom: "TERANGA IMMOBILIER", raisonSociale: "TERANGA IMMOBILIER SARL", formeJuridique: "SARL", ninea: "006512398", rccm: "SN.DKR.2019.B.12455", siegeSocial: "Avenue Léopold Sédar Senghor, Dakar", representantLegal: "Ibrahima Gueye", qualiteSignataire: "Gérant", adresse: "Plateau, Dakar", commune: "Dakar", region: "Dakar", telephone: "+221 33 821 44 10", email: "contact@teranga-immo.sn" },
  { typePersonne: "MORALE", nom: "SEN BAOL AGRO", raisonSociale: "SEN BAOL AGRO SA", formeJuridique: "SA", ninea: "007781240", rccm: "SN.THS.2015.A.03812", siegeSocial: "Zone industrielle, Thiès", representantLegal: "Awa Niang", qualiteSignataire: "Présidente du Conseil d'administration", commune: "Thiès", region: "Thiès", telephone: "+221 33 951 20 30" },
];

/* ------------------------------------------------------------------ */
/* Parcelles fictives                                                  */
/* ------------------------------------------------------------------ */
const PARCELLES = [
  { commune: "Dakar", departement: "Dakar", region: "Dakar", quartier: "Almadies", adresse: "Lot 17, cité Almadies", nicad: "NCD-2024-00817", titreFoncier: "TF 12458/DKR", typeDroit: "titre_foncier", lot: "17", superficie: 640, uniteSuperficie: "m2", usageActuel: "Habitat", usageProjete: "Habitat", etatVerification: "VERIFIE" },
  { commune: "Rufisque", departement: "Rufisque", region: "Dakar", quartier: "Keury Souf", adresse: "Parcelle 284, Keury Souf", titreFoncier: "TF 09312/RFS", typeDroit: "titre_foncier", numeroParcelle: "284", superficie: 1200, uniteSuperficie: "m2", usageActuel: "Terrain nu", usageProjete: "Lotissement", etatVerification: "A_VERIFIER" },
  { commune: "Pikine", departement: "Pikine", region: "Dakar", quartier: "Tougne", adresse: "Ilot 45, zone B", nicad: "NCD-2023-11204", typeDroit: "deliberation", referenceDroit: "Délibération n°44/2008", ilot: "45", superficie: 300, uniteSuperficie: "m2", usageActuel: "Habitat", etatVerification: "PIECES_RECUES" },
  { commune: "Thiès", departement: "Thiès", region: "Thiès", quartier: "Mbour 4 Extension", adresse: "Parcelle B-112", nicad: "NCT-2022-05510", typeDroit: "bail", referenceDroit: "Bail n°THS-2011-0331", superficie: 4200, uniteSuperficie: "m2", usageActuel: "Activités agricoles", usageProjete: "Entrepôts", etatVerification: "DECLARE" },
  { commune: "Dakar", departement: "Dakar", region: "Dakar", quartier: "Mermoz", adresse: "Lot 8, rue MZ-140", titreFoncier: "TF 15021/DKR", typeDroit: "titre_foncier", lot: "8", superficie: 450, uniteSuperficie: "m2", usageActuel: "Habitat", chargesInscriptions: "Hypothèque n°2019-7842 en faveur de la BHS", etatVerification: "VERIFIE" },
  { commune: "Guédiawaye", departement: "Guédiawaye", region: "Dakar", quartier: "Sam Notaire", adresse: "Parcelle 12, Unité 17", typeDroit: "permis_occuper", referenceDroit: "Permis d'occuper n°GDW-2009-0147", numeroParcelle: "12", superficie: 250, uniteSuperficie: "m2", usageActuel: "Habitat", etatVerification: "DECLARE" },
];

/* ------------------------------------------------------------------ */
/* Démarches fictives — une par type, statuts répartis                 */
/* ------------------------------------------------------------------ */
/* piecesStatus : "toutes" = toutes couvertes, "partiel" = ~moitié,
   "depot" = client/cabinet couverts + récépissé reçu, "debut" = non demandées. */
const DEMARCHES = [
  {
    typeCode: "URB_CONSTRUIRE", statut: "EN_INSTRUCTION", parcelle: 0, demandeur: 4, autoriteNom: "Mairie de Dakar",
    objet: "Autorisation de construire — villa R+1, Almadies",
    finalite: "Construction d'une villa d'habitation R+1", priorite: "NORMALE",
    piecesStatus: "depot",
    depot: { dateDepot: jours(-20), deposePar: "Agent de liaison — M. Dieng", canalDepot: "Guichet physique", numeroRecepisse: "MDK-URB-2026-1187" },
    prochaineRelance: jours(10),
    honoraires: 500000, debours: 45000, taxes: 150000, timbres: 2000, avancesRecues: 300000,
  },
  {
    typeCode: "URB_LOTIR", statut: "PIECES_PARTIELLES", parcelle: 1, demandeur: 5, autoriteNom: "Mairie de Dakar",
    objet: "Autorisation de lotir — terrain 1 200 m², Keury Souf",
    finalite: "Lotissement en 4 parcelles à usage d'habitation", priorite: "HAUTE",
    piecesStatus: "partiel",
    honoraires: 800000, avancesRecues: 200000,
  },
  {
    typeCode: "CAD_AVIS_FAVORABLE", statut: "A_QUALIFIER", demandeur: 0,
    objet: `${MARK} Avis favorable — objet à préciser`,
    avertissementVu: true, priorite: "NORMALE", piecesStatus: "debut",
    note: "Demande reçue par téléphone : « un avis favorable pour la banque ». À requalifier avec le client : objet précis, service sollicité, opération concernée.",
  },
  {
    typeCode: "CAD_EXTRAIT_PLAN", statut: "PRET_A_DEPOT", parcelle: 2, demandeur: 1, autoriteNom: "Bureau du Cadastre de Dakar",
    objet: "Extrait de plan cadastral certifié — parcelle 284 Keury Souf",
    finalite: "Constitution du dossier de demande de bail", priorite: "NORMALE",
    piecesStatus: "partiel_sans_pds",
    honoraires: 75000, debours: 15000, timbres: 1000, avancesRecues: 90000,
  },
  {
    typeCode: "CAD_CIC", statut: "CONTROLE_INTERNE", parcelle: 2, demandeur: 1, autoriteNom: "Bureau du Cadastre de Dakar",
    objet: "Certificat d'identification cadastrale — Keury Souf",
    finalite: "Vérification foncière avant vente", piecesStatus: "partiel",
    honoraires: 60000,
  },
  {
    typeCode: "CAD_NICAD", statut: "DEPOSE", parcelle: 3, demandeur: 5, autoriteNom: "Bureau du Cadastre de Dakar",
    objet: "Attribution NICAD — parcelle B-112 Thiès",
    finalite: "Référencement cadastral avant immatriculation", piecesStatus: "depot",
    depot: { dateDepot: jours(-8), deposePar: "Agent de liaison — M. Dieng", canalDepot: "Guichet physique", numeroRecepisse: "BCD-2026-04512" },
    prochaineRelance: jours(7),
    honoraires: 100000, debours: 20000, avancesRecues: 100000,
  },
  {
    typeCode: "FON_RAD", statut: "COMPLEMENT_DEMANDE", parcelle: 4, demandeur: 3, autoriteNom: "Conservation foncière de Dakar",
    sousType: "HYPOTHEQUE",
    objet: "Radiation de l'hypothèque n°2019-7842 — TF 15021/DKR",
    fondement: "Extinction de la dette — mainlevée BHS du 14/02/2026",
    qualification: { inscriptionVisee: "Hypothèque n°2019-7842, vol. 1124", creancier: "Banque de l'Habitat du Sénégal", motifJuridique: "Extinction de la dette principale" },
    piecesStatus: "depot",
    depot: { dateDepot: jours(-35), deposePar: "Assistante juridique", canalDepot: "Guichet physique", numeroRecepisse: "CFD-2026-2204" },
    complement: "Le Conservateur demande l'original de la mainlevée (copie non conforme transmise).",
    honoraires: 250000, debours: 30000, avancesRecues: 250000,
  },
  {
    typeCode: "FON_MAINLEVEE", statut: "RELANCE", parcelle: 4, demandeur: 3, autoriteNom: "Conservation foncière de Dakar",
    sousType: "AMIABLE",
    objet: "Mainlevée amiable — sûreté BHS sur TF 15021/DKR",
    qualification: { nature: "Amiable", creancier: "Banque de l'Habitat du Sénégal", dette: "Crédit immobilier soldé le 30/01/2026", surete: "Hypothèque n°2019-7842" },
    piecesStatus: "depot",
    depot: { dateDepot: jours(-40), deposePar: "Agent de liaison — M. Dieng", canalDepot: "Guichet physique", numeroRecepisse: "CFD-2026-1890" },
    relances: 2, prochaineRelance: jours(5),
    honoraires: 150000, debours: 25000, avancesRecues: 150000,
  },
  {
    typeCode: "ADM_DUPLICATA", statut: "A_QUALIFIER", demandeur: 2,
    objet: `${MARK} Duplicata — document à préciser`,
    piecesStatus: "debut", priorite: "BASSE",
    note: "Le demandeur a perdu « un papier du cadastre ». À qualifier : nature du document (TF ? extrait ? attestation ?), autorité émettrice, motif.",
  },
  {
    typeCode: "FIS_ENREG_PROC", statut: "ACCEPTE", demandeur: 4, autoriteNom: "DGID — Direction de l'Enregistrement, des Domaines et du Timbre",
    sousType: "BAIL",
    objet: "Enregistrement du bail commercial — siège TERANGA IMMOBILIER",
    qualification: { acte: "Bail commercial 6 ans", parties: "TERANGA IMMOBILIER SARL / SCI Almadies", loyer: "2 500 000 FCFA / mois" },
    piecesStatus: "toutes",
    depot: { dateDepot: jours(-30), deposePar: "Assistante juridique", canalDepot: "Guichet physique", numeroRecepisse: "DEDT-2026-07741" },
    decision: { decisionType: "ACCEPTE", decisionDate: jours(-12), decisionNotes: "Acte enregistré — droits liquidés : 90 000 FCFA." },
    honoraires: 200000, debours: 15000, taxes: 90000, timbres: 4000, avancesRecues: 300000,
  },
  {
    typeCode: "FIS_DECES", statut: "PRET_VALIDATION", demandeur: 2, autoriteNom: "Centre des services fiscaux de Dakar-Plateau",
    sousType: "SUCCESSION_IMMOBILIERE", risque: "ELEVE",
    objet: "Déclaration de succession — succession Sarr (biens à Rufisque)",
    qualification: { defunt: "Feu El Hadj Sarr, décédé le 02/03/2026", heritiers: "4 héritiers identifiés", actifs: "2 parcelles, comptes bancaires", testament: "Aucun", qualiteDeclarant: "Fils aîné" },
    piecesStatus: "partiel_sans_pds",
    honoraires: 600000, avancesRecues: 200000,
    note: "Validation avocat requise avant dépôt — en attente de revue par Me responsable.",
  },
  {
    typeCode: "FIS_NON_IMPOSITION", statut: "DOCUMENT_DELIVRE", demandeur: 2, autoriteNom: "Centre des services fiscaux de Dakar-Sud",
    objet: "Attestation de non-imposition — M. Ousmane Sarr",
    finalite: "Justificatif pour dossier de retraite", piecesStatus: "toutes",
    depot: { dateDepot: jours(-25), deposePar: "Agent de liaison — M. Dieng", canalDepot: "Guichet physique", numeroRecepisse: "CSF-SUD-2026-3318" },
    decision: { decisionType: "ACCEPTE", decisionDate: jours(-6), decisionNotes: "Attestation délivrée — retrait effectué, scan à verser à la GED." },
    honoraires: 40000, debours: 5000, timbres: 1000, avancesRecues: 46000,
  },
  {
    typeCode: "FIS_AVIS_IMPOSITION", statut: "REFUSE", demandeur: 0, autoriteNom: "Centre des services fiscaux de Dakar-Sud",
    objet: "Avis d'imposition — M. Mamadou Ndiaye",
    piecesStatus: "toutes",
    depot: { dateDepot: jours(-28), deposePar: "Agent de liaison — M. Dieng", canalDepot: "Guichet physique", numeroRecepisse: "CSF-SUD-2026-2987" },
    decision: { decisionType: "REFUSE", decisionDate: jours(-9), motifRejet: "Centre territorialement incompétent : le domicile fiscal du demandeur relève du CSF Dakar-Plateau.", decisionNotes: "Réorienter le dossier vers le CSF Dakar-Plateau." },
    voieRecours: "Redépôt auprès du centre compétent",
    honoraires: 40000, debours: 5000, avancesRecues: 45000,
  },
  {
    typeCode: "DOM_BAIL_TF", statut: "EN_INSTRUCTION", parcelle: 3, demandeur: 5, autoriteNom: "DGID — Direction de l'Enregistrement, des Domaines et du Timbre",
    objet: "Transformation du bail n°THS-2011-0331 en titre foncier",
    finalite: "Sécurisation foncière du site industriel", priorite: "HAUTE", risque: "ELEVE",
    piecesStatus: "depot",
    depot: { dateDepot: jours(-50), deposePar: "Agent de liaison — M. Dieng", canalDepot: "Guichet physique", numeroRecepisse: "DEDT-2026-05120" },
    prochaineRelance: jours(-3),
    honoraires: 1500000, debours: 80000, avancesRecues: 600000,
    note: "Circuit long — examen en commission ad hoc prévu. Relance en retard.",
  },
  {
    typeCode: "DOM_PERMIS_TF", statut: "BROUILLON", parcelle: 5, demandeur: 2,
    objet: "Transformation du permis d'occuper GDW-2009-0147 en titre foncier",
    piecesStatus: "debut", priorite: "BASSE",
    honoraires: 1200000,
  },
  {
    typeCode: "FIS_ACQUIESCEMENT", statut: "ATTENTE_CLIENT", demandeur: 4, autoriteNom: "Centre des services fiscaux de Dakar-Plateau",
    sousType: "REDRESSEMENT", risque: "ELEVE",
    objet: "Acquiescement au redressement IS 2024 — TERANGA IMMOBILIER",
    qualification: { decision: "Proposition de redressement n°PR-2026-0145", impot: "IS", periode: "Exercice 2024", montant: "8 450 000 FCFA", portee: "Acquiescement total" },
    piecesStatus: "partiel",
    honoraires: 900000, avancesRecues: 300000,
    note: "Confirmation écrite du client exigée avant génération de l'acte — relance envoyée le " + new Date(jours(-3)).toLocaleDateString("fr-FR") + ".",
  },
];

/* ------------------------------------------------------------------ */
/* Application                                                         */
/* ------------------------------------------------------------------ */
function piecesFor(mode, pieces) {
  const total = pieces.length;
  return pieces.map((p, i) => {
    let statut = "NON_DEMANDEE";
    if (mode === "toutes") statut = "VALIDEE";
    else if (mode === "partiel") {
      statut = i < Math.ceil(total * 0.5) ? (i % 3 === 0 ? "VALIDEE" : "RECUE") : i < Math.ceil(total * 0.7) ? "DEMANDEE" : "NON_DEMANDEE";
    } else if (mode === "partiel_sans_pds") {
      statut = p.categorie === "PREUVE_DE_DEPOT_ET_SUIVI" || p.categorie === "DOCUMENT_ADMINISTRATIF_A_OBTENIR" ? "NON_DEMANDEE" : "VALIDEE";
    } else if (mode === "depot") {
      if (p.categorie === "DOCUMENT_ADMINISTRATIF_A_OBTENIR") statut = "NON_DEMANDEE";
      else if (p.categorie === "PREUVE_DE_DEPOT_ET_SUIVI") statut = "RECUE";
      else statut = "VALIDEE";
    }
    return {
      code: p.code, libelle: p.libelle, categorie: p.categorie, niveau: p.niveau,
      condition: p.condition, sourceAttendue: p.sourceAttendue, ordre: p.ordre, statut,
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

    const types = await db.demarcheType.findMany({ include: { pieces: { where: { actif: true }, orderBy: { ordre: "asc" } } } });
    if (!types.length) {
      console.log("  ⚠ Aucun type de démarche : lancez d'abord scripts/seed-demarches.js");
      await db.$disconnect();
      continue;
    }
    const typeByCode = Object.fromEntries(types.map((ty) => [ty.code, ty]));

    // Dossier de rattachement : existants, sinon création d'un dossier démo.
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
            referenceInterne: `DEMO-${ANNEE}-001`, typeAffaire: "FONCIER",
            natureMission: ["conseil"], clientId: client.id,
            avocatResponsableId: user.id, createurId: user.id,
          },
        });
        dossiers = [dossier];
        console.log("  + dossier de démonstration créé");
      }
    }

    // Demandeurs fictifs (idempotent : recherche par nom + prénoms/raison sociale).
    const demandeurIds = [];
    for (const d of DEMANDEURS) {
      const exist = await db.demandeur.findFirst({ where: { nom: d.nom, prenoms: d.prenoms ?? undefined, raisonSociale: d.raisonSociale ?? undefined } });
      if (exist) { demandeurIds.push(exist.id); continue; }
      if (DRY_RUN) { demandeurIds.push("dry"); continue; }
      const c = await db.demandeur.create({ data: d });
      demandeurIds.push(c.id);
      console.log(`  + demandeur ${d.raisonSociale || `${d.prenoms} ${d.nom}`}`);
    }

    // Parcelles fictives (idempotent : recherche par adresse + commune).
    const parcelleIds = [];
    for (const p of PARCELLES) {
      const exist = await db.parcelle.findFirst({ where: { commune: p.commune, adresse: p.adresse } });
      if (exist) { parcelleIds.push(exist.id); continue; }
      if (DRY_RUN) { parcelleIds.push("dry"); continue; }
      const c = await db.parcelle.create({ data: { ...p, titulaires: [{ nom: "Demandeur", qualite: "Propriétaire / titulaire du droit", quotePart: "100%" }] } });
      parcelleIds.push(c.id);
      console.log(`  + parcelle ${p.adresse} (${p.commune})`);
    }

    const autorites = await db.demarcheAutorite.findMany();
    const autoriteIdOf = (nom) => autorites.find((a) => a.nom === nom)?.id || null;

    let creees = 0;
    for (let i = 0; i < DEMARCHES.length; i++) {
      const spec = DEMARCHES[i];
      const type = typeByCode[spec.typeCode];
      if (!type) { console.log(`  ⚠ type ${spec.typeCode} absent — ignoré`); continue; }

      const objet = spec.objet.startsWith(MARK) ? spec.objet : `${MARK} ${spec.objet}`;
      const exist = await db.demarche.findFirst({ where: { typeId: type.id, objet } });
      if (exist) { console.log(`  = ${spec.typeCode} déjà présent (${exist.reference})`); continue; }
      if (DRY_RUN) { console.log(`  [dry] démarche ${spec.typeCode} → ${spec.statut}`); continue; }

      // Référence séquentielle.
      const compte = await db.demarche.count({ where: { reference: { startsWith: `DEM-${ANNEE}-` } } });
      const reference = `DEM-${ANNEE}-${String(compte + 1).padStart(4, "0")}`;

      const dossier = dossiers[i % dossiers.length];
      const demandeurId = spec.demandeur != null ? demandeurIds[spec.demandeur] : null;
      const parcelleId = spec.parcelle != null ? parcelleIds[spec.parcelle] : null;
      const autoriteId = spec.autoriteNom ? autoriteIdOf(spec.autoriteNom) : null;

      const demarche = await db.demarche.create({
        data: {
          reference, typeId: type.id, sousType: spec.sousType || null,
          statut: spec.statut, priorite: spec.priorite || "NORMALE",
          risque: spec.risque || (type.sensible ? "ELEVE" : "STANDARD"),
          dossierId: dossier.id,
          demandeurId: demandeurId === "dry" ? null : demandeurId,
          parcelleId: parcelleId === "dry" ? null : parcelleId,
          autoriteId, autoriteLibre: !autoriteId && spec.autoriteNom ? spec.autoriteNom : null,
          objet, finalite: spec.finalite || null, fondement: spec.fondement || null,
          qualification: spec.qualification || null,
          responsableId: user?.id || null,
          dateDepot: spec.depot?.dateDepot || null,
          deposePar: spec.depot?.deposePar || null,
          canalDepot: spec.depot?.canalDepot || null,
          numeroRecepisse: spec.depot?.numeroRecepisse || null,
          prochaineRelance: spec.prochaineRelance || null,
          decisionDate: spec.decision?.decisionDate || null,
          decisionType: spec.decision?.decisionType || null,
          decisionNotes: spec.decision?.decisionNotes || null,
          motifRejet: spec.decision?.motifRejet || null,
          voieRecours: spec.voieRecours || null,
          valideParId: type.validationAvocat && !["BROUILLON", "A_QUALIFIER", "ATTENTE_CLIENT", "PRET_VALIDATION"].includes(spec.statut) ? user?.id : null,
          valideLe: type.validationAvocat && !["BROUILLON", "A_QUALIFIER", "ATTENTE_CLIENT", "PRET_VALIDATION"].includes(spec.statut) ? jours(-15) : null,
          honoraires: spec.honoraires || 0, debours: spec.debours || 0,
          taxes: spec.taxes || 0, timbres: spec.timbres || 0, avancesRecues: spec.avancesRecues || 0,
          creePar: user?.id || "seed",
        },
      });

      // Check-list matérialisée.
      await db.demarchePiece.createMany({
        data: piecesFor(spec.piecesStatus || "debut", type.pieces).map((p) => ({ ...p, demarcheId: demarche.id })),
      });

      // Journal d'événements.
      const evts = [
        { type: "CHANGEMENT_STATUT", date: jours(-45), description: `Création de la démarche (${spec.statut})`, details: { statut: spec.statut } },
      ];
      if (spec.piecesStatus === "partiel") {
        evts.push({ type: "DEMANDE_PIECE_CLIENT", date: jours(-20), description: "Demande de pièces complémentaires au client (téléphone + email)." });
      }
      if (spec.depot) {
        evts.push({ type: "DEPOT", date: spec.depot.dateDepot, description: `Dépôt auprès de ${spec.autoriteNom || "l'autorité"} — récépissé ${spec.depot.numeroRecepisse}.`, details: spec.depot });
      }
      if (spec.complement) {
        evts.push({ type: "COMPLEMENT", date: jours(-7), description: `Complément demandé : ${spec.complement}` });
      }
      for (let r = 0; r < (spec.relances || 0); r++) {
        evts.push({ type: "RELANCE", date: jours(-14 + r * 8), description: `Relance ${r + 1} adressée à l'autorité (courrier + guichet).` });
      }
      if (spec.decision) {
        evts.push({ type: "DECISION", date: spec.decision.decisionDate, description: spec.decision.decisionNotes || `Décision : ${spec.decision.decisionType}`, details: spec.decision });
      }
      if (spec.note) {
        evts.push({ type: "NOTE", date: jours(-5), description: spec.note });
      }
      if (demarche.valideParId) {
        evts.push({ type: "VALIDATION", date: jours(-15), description: "Validation juridique par l'avocat responsable." });
      }
      await db.demarcheEvenement.createMany({
        data: evts.map((e) => ({ ...e, demarcheId: demarche.id, creePar: user?.id || "seed" })),
      });

      // Frais détaillés (certains débours volontairement non rapprochés).
      const frais = [];
      if (spec.honoraires) frais.push({ nature: "HONORAIRE", libelle: "Honoraires du cabinet — suivi de la démarche", montant: spec.honoraires, rapproche: true });
      if (spec.debours) frais.push({ nature: "DEBOURS", libelle: "Déplacements, guichet, copies certifiées", montant: spec.debours, quittance: `QT-${ANNEE}-${1000 + i}`, rapproche: i % 3 !== 0 });
      if (spec.taxes) frais.push({ nature: "TAXE", libelle: "Taxes et droits administratifs", montant: spec.taxes, quittance: `TQ-${ANNEE}-${2000 + i}`, rapproche: i % 3 !== 0 });
      if (spec.timbres) frais.push({ nature: "TIMBRE", libelle: "Timbres fiscaux", montant: spec.timbres, rapproche: true });
      if (spec.avancesRecues) frais.push({ nature: "AVANCE_CLIENT", libelle: "Avance reçue du client", montant: spec.avancesRecues, date: jours(-40), rapproche: true });
      if (frais.length) {
        await db.demarcheFrais.createMany({ data: frais.map((f) => ({ ...f, demarcheId: demarche.id, creePar: user?.id || "seed" })) });
      }

      creees++;
      console.log(`  + ${reference} — ${type.libelle} → ${spec.statut}`);
    }

    console.log(`  => ${creees} démarche(s) fictive(s) créée(s)`);
    await db.$disconnect();
  }
  console.log("\nTerminé.");
  await pub.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
