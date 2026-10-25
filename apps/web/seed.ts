import { getTenantPrisma, publicPrisma } from "./lib/prisma";
import { hashPassword, generateMfaSecret } from "./lib/auth";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";

let prismaClient: Awaited<ReturnType<typeof getTenantPrisma>> | null = null;

const SYSCOHADA_JSON =
  "C:/xampp/htdocs/cabinet/database/migrations/syscohada_plan_comptable_avec_code.json";

function mapClassToType(classe: number): string {
  switch (classe) {
    case 1:
      return "CAPITAU";
    case 2:
    case 3:
    case 4:
    case 5:
      return "ACTIF";
    case 6:
      return "CHARGE";
    case 7:
      return "PRODUIT";
    case 8:
      return "ACTIF/PASSIF";
    default:
      return "ACTIF";
  }
}

function flattenAccounts(
  node: any,
  parentId: string | null = null,
  result: any[] = []
): any[] {
  if (!node || typeof node !== "object") return result;

  const ownNumber = node.account_number;
  let currentId: string | null = null;

  if (ownNumber && typeof ownNumber === "string") {
    currentId = randomUUID();
    const code = ownNumber;
    const classe = Number(code.charAt(0)) || 0;
    const subClass = code.length >= 2 ? Number(code.slice(0, 2)) : classe;
    const level = code.length;
    result.push({
      id: currentId,
      accountCode: code,
      label: node.__label || code,
      class: classe,
      subClass,
      accountType: mapClassToType(classe),
      level,
      parentId,
      soldeInitial: 0,
      soldeActuel: 0,
      isActive: true,
      isAuxiliary: level >= 3,
    });
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "account_number") continue;
    if (typeof value === "object" && value !== null) {
      (value as any).__label = key;
      flattenAccounts(value as any, currentId, result);
    }
  }

  return result;
}

async function seedAccounting(prisma: any) {
  const raw = JSON.parse(readFileSync(SYSCOHADA_JSON, "utf8"));
  const accounts: any[] = [];
  for (const [classLabel, rootNode] of Object.entries(raw.tree || {})) {
    if (typeof rootNode === "object" && rootNode !== null) {
      (rootNode as any).__label = classLabel;
      flattenAccounts(rootNode as any, null, accounts);
    }
  }

  if (accounts.length === 0) {
    console.log("Aucun compte Syscohada trouvé");
    return;
  }

  // Insert by level so parents exist before children
  const byLevel = new Map<number, any[]>();
  for (const a of accounts) {
    const list = byLevel.get(a.level) || [];
    list.push(a);
    byLevel.set(a.level, list);
  }

  const levels = Array.from(byLevel.keys()).sort((a, b) => a - b);
  for (const level of levels) {
    await prisma.accountingAccount.createMany({
      data: byLevel.get(level)!,
      skipDuplicates: true,
    });
  }
  console.log(`${accounts.length} comptes Syscohada insérés`);

  const year = new Date().getFullYear();
  const existingExercise = await prisma.accountingExercise.findFirst({
    where: { year },
  });
  if (!existingExercise) {
    await prisma.accountingExercise.create({
      data: {
        label: `Exercice ${year}`,
        year,
        startDate: new Date(`${year}-01-01`),
        endDate: new Date(`${year}-12-31`),
        status: "open",
        isClosed: false,
      },
    });
    console.log(`Exercice ${year} créé`);
  }

  const journals = [
    { code: "ACH", label: "Journal des achats", journalType: "ACH" },
    { code: "VEN", label: "Journal des ventes", journalType: "VEN" },
    { code: "TRE", label: "Journal de trésorerie", journalType: "TRE" },
    { code: "OD", label: "Journal des opérations diverses", journalType: "OD" },
    { code: "SAL", label: "Journal des salaires", journalType: "SAL" },
    { code: "TVA", label: "Journal TVA", journalType: "TVA" },
    { code: "BAN", label: "Journal banque", journalType: "BAN" },
    { code: "CAI", label: "Journal caisse", journalType: "CAI" },
    { code: "DIV", label: "Journal divers", journalType: "DIV" },
  ];
  await prisma.accountingJournal.createMany({
    data: journals,
    skipDuplicates: true,
  });
  console.log(`${journals.length} journaux comptables créés`);

  // Correction : comptes de TVA collectée (443) et dettes sociales/fiscales sont des PASSIF
  await prisma.accountingAccount.updateMany({
    where: { accountCode: { startsWith: "443" } },
    data: { accountType: "PASSIF" },
  });
  await prisma.accountingAccount.updateMany({
    where: { accountCode: { startsWith: "431" } },
    data: { accountType: "PASSIF" },
  });
  await prisma.accountingAccount.updateMany({
    where: { accountCode: { in: ["422", "423", "424", "427", "447"] } },
    data: { accountType: "PASSIF" },
  });
}

async function main() {
  prismaClient = await getTenantPrisma(process.env.DEFAULT_TENANT_ID!);
  const roles = [
    {
      nom: "Avocat responsable",
      permissions: {
        dossiers: ["read", "write", "validate", "close"],
        clients: ["read", "write"],
        taches: ["read", "write", "assign"],
        documents: ["read", "write", "publish"],
        missions: ["read", "write"],
        factures: ["read"],
      },
      estAdmin: false,
      estClient: false,
      niveauConfidentialiteMax: 3,
    },
    {
      nom: "Associé / directeur",
      permissions: {
        users: ["read", "write"],
        dossiers: ["read", "write", "validate", "close"],
        audit: ["read"],
      },
      estAdmin: true,
      estClient: false,
      niveauConfidentialiteMax: 3,
    },
    {
      nom: "Avocat collaborateur",
      permissions: { dossiers: ["read", "write"], taches: ["read", "write"] },
      estAdmin: false,
      estClient: false,
      niveauConfidentialiteMax: 2,
    },
    {
      nom: "Huissier de justice",
      permissions: { missions: ["read", "write"], dossiers: ["read"] },
      estAdmin: false,
      estClient: false,
      niveauConfidentialiteMax: 1,
    },
    {
      nom: "Assistant juridique",
      permissions: { dossiers: ["read", "write"], documents: ["read", "write"] },
      estAdmin: false,
      estClient: false,
      niveauConfidentialiteMax: 1,
    },
    {
      nom: "Secrétaire",
      permissions: { clients: ["read", "write"], rendezVous: ["read", "write"] },
      estAdmin: false,
      estClient: false,
      niveauConfidentialiteMax: 0,
    },
    {
      nom: "Comptable",
      permissions: { factures: ["read", "write"], paiements: ["read", "write"], comptabilite: ["read", "write"] },
      estAdmin: false,
      estClient: false,
      niveauConfidentialiteMax: 0,
    },
    {
      nom: "Clerc",
      permissions: { dossiers: ["read", "write"], documents: ["read", "write"], taches: ["read", "write"] },
      estAdmin: false,
      estClient: false,
      niveauConfidentialiteMax: 1,
    },
    {
      nom: "Conseiller juridique",
      permissions: { dossiers: ["read", "write"], documents: ["read", "write"], clients: ["read"] },
      estAdmin: false,
      estClient: false,
      niveauConfidentialiteMax: 2,
    },
    {
      nom: "Architecte",
      permissions: { missions: ["read", "write"], dossiers: ["read"] },
      estAdmin: false,
      estClient: false,
      niveauConfidentialiteMax: 1,
    },
    {
      nom: "Client",
      permissions: { dossiers: ["read"], documents: ["read"], factures: ["read"] },
      estAdmin: false,
      estClient: true,
      niveauConfidentialiteMax: 0,
    },
    {
      nom: "Auditeur interne",
      permissions: { audit: ["read"] },
      estAdmin: false,
      estClient: false,
      niveauConfidentialiteMax: 0,
    },
  ];

  for (const role of roles) {
    await prismaClient.role.upsert({
      where: { nom: role.nom },
      update: { permissions: role.permissions as any },
      create: role as any,
    });
  }

  const adminRole = await prismaClient.role.findUnique({
    where: { nom: "Associé / directeur" },
  });

  if (!adminRole) {
    throw new Error("Rôle admin non trouvé");
  }

  const existing = await prismaClient.user.findUnique({ where: { email: "admin@cabinet.sn" } });

  if (!existing) {
    await prismaClient.user.create({
      data: {
        email: "admin@cabinet.sn",
        passwordHash: await hashPassword("Admin1234!"),
        prenom: "Admin",
        nom: "Cabinet",
        roleId: adminRole.id,
        mfaEnabled: false,
        actif: true,
      },
    });
    console.log("Utilisateur admin créé : admin@cabinet.sn / Admin1234!");
  }

  const avocatRole = await prismaClient.role.findUnique({ where: { nom: "Avocat responsable" } });
  if (avocatRole) {
    const avocat = await prismaClient.user.findUnique({ where: { email: "avocat@cabinet.sn" } });
    if (!avocat) {
      await prismaClient.user.create({
        data: {
          email: "avocat@cabinet.sn",
          passwordHash: await hashPassword("Avocat1234!"),
          prenom: "Maître",
          nom: "Ndiaye",
          roleId: avocatRole.id,
          mfaEnabled: false,
          actif: true,
        },
      });
      console.log("Utilisateur avocat créé : avocat@cabinet.sn / Avocat1234!");
    }
  }

  await seedParametres(prismaClient as any);

  console.log("Seed terminé");
}

async function seedParametres(prisma: any) {
  const parametres = [
    // Types d'affaires
    ...[
      { code: "contentieux_contractuel", libelle: "Contentieux contractuel" },
      { code: "contentieux_immobilier", libelle: "Contentieux immobilier" },
      { code: "recouvrement", libelle: "Recouvrement de créances" },
      { code: "procedure_civile", libelle: "Procédure civile / commerciale" },
      { code: "conseil", libelle: "Conseil / Consultation" },
      { code: "expulsion", libelle: "Expulsion et recouvrement" },
      { code: "bail", libelle: "Baux commerciaux et d'habitation" },
      { code: "foncier", libelle: "Litiges fonciers" },
      { code: "signification", libelle: "Signification / Actes d'huissier" },
      { code: "constat", libelle: "Constats et procès-verbaux" },
      { code: "saisie", libelle: "Saisies et mesures d'exécution" },
      { code: "negociation", libelle: "Négociation / Règlement amiable" },
    ].map((p, i) => ({ ...p, categorie: "type_affaire", ordre: i })),

    // Statuts de dossier
    ...[
      "Prospect",
      "Nouveau",
      "À qualifier",
      "Conflit d'intérêts à vérifier",
      "En attente de pièces",
      "Ouvert",
      "En cours d'analyse",
      "En rédaction",
      "En relecture",
      "En validation",
      "À signifier",
      "Signification en cours",
      "En attente de retour",
      "Audience ou échéance à venir",
      "En attente du client",
      "En négociation",
      "En attente de décision",
      "Décision rendue",
      "En exécution",
      "Facturation",
      "Clôturé",
      "Archivé",
    ].map((s, i) => ({ categorie: "statut_dossier", code: s, libelle: s, ordre: i })),

    // Priorités de tâche
    ...[
      { code: "basse", libelle: "Basse" },
      { code: "moyenne", libelle: "Moyenne" },
      { code: "haute", libelle: "Haute" },
      { code: "critique", libelle: "Critique" },
    ].map((p, i) => ({ ...p, categorie: "priorite_tache", ordre: i })),

    // Modes de paiement
    ...[
      { code: "virement", libelle: "Virement" },
      { code: "especes", libelle: "Espèces" },
      { code: "cheque", libelle: "Chèque" },
      { code: "carte", libelle: "Carte" },
      { code: "autre", libelle: "Autre" },
    ].map((p, i) => ({ ...p, categorie: "mode_paiement", ordre: i })),

    // Catégories de document
    ...[
      { code: "correspondance", libelle: "Correspondance" },
      { code: "contrat", libelle: "Contrat" },
      { code: "conclusions", libelle: "Conclusions" },
      { code: "pv", libelle: "Procès-verbal" },
      { code: "facture", libelle: "Facture" },
      { code: "titre_foncier", libelle: "Titre foncier" },
      { code: "assignation", libelle: "Assignation" },
      { code: "note_interne", libelle: "Note interne" },
      { code: "autre", libelle: "Autre" },
    ].map((p, i) => ({ ...p, categorie: "categorie_document", ordre: i })),

    // Types d'événement
    ...[
      { code: "audience", libelle: "Audience" },
      { code: "echeance", libelle: "Échéance" },
      { code: "rdv", libelle: "Rendez-vous" },
      { code: "signification", libelle: "Signification" },
      { code: "deadline", libelle: "Deadline procédurale" },
      { code: "journal", libelle: "Journal" },
    ].map((p, i) => ({ ...p, categorie: "type_evenement", ordre: i })),

    // Types d'acte d'huissier
    ...[
      { code: "signification", libelle: "Signification" },
      { code: "sommation", libelle: "Sommation" },
      { code: "mise_en_demeure", libelle: "Mise en demeure" },
      { code: "constat", libelle: "Constat" },
      { code: "saisie", libelle: "Saisie" },
      { code: "convocation", libelle: "Convocation" },
    ].map((p, i) => ({ ...p, categorie: "type_acte_huissier", ordre: i })),

    // Natures de mission
    ...[
      { code: "conseil", libelle: "Conseil / Consultation" },
      { code: "redaction", libelle: "Rédaction d'actes" },
      { code: "assignation", libelle: "Rédaction d'assignation" },
      { code: "procedure", libelle: "Procedure / Audience" },
      { code: "negociation", libelle: "Négociation / Règlement amiable" },
      { code: "recouvrement", libelle: "Recouvrement de créances" },
      { code: "signification", libelle: "Signification" },
      { code: "constat", libelle: "Constat" },
      { code: "saisie", libelle: "Saisie et mesure d'exécution" },
    ].map((p, i) => ({ ...p, categorie: "nature_mission", ordre: i })),

    // Niveaux de confidentialité
    ...[
      { code: "0", libelle: "Public" },
      { code: "1", libelle: "Interne" },
      { code: "2", libelle: "Confidentiel" },
      { code: "3", libelle: "Secret" },
    ].map((p, i) => ({ ...p, categorie: "niveau_confidentialite", ordre: i })),
  ];

  for (const p of parametres) {
    await prisma.parametre.upsert({
      where: { categorie_code: { categorie: p.categorie, code: p.code } },
      update: { libelle: p.libelle, ordre: p.ordre, actif: true },
      create: p,
    });
  }

  console.log("Paramètres par défaut insérés");
}

async function seedSpecialites(prisma: any) {
  const specialites: {
    code: string;
    libelle: string;
    description?: string;
    documentTypes: { code: string; libelle: string; obligatoire?: boolean }[];
    workflow: { code: string; libelle: string; estInitial?: boolean; estFinal?: boolean }[];
  }[] = [
    {
      code: "contentieux_immobilier",
      libelle: "Contentieux immobiliers",
      description: "Litiges relatifs aux biens immobiliers : copropriété, construction, vices cachés.",
      documentTypes: [
        { code: "titre_foncier", libelle: "Titre foncier", obligatoire: true },
        { code: "contrat_bail", libelle: "Contrat de bail" },
        { code: "acte_vente", libelle: "Acte de vente" },
        { code: "correspondance", libelle: "Correspondance" },
        { code: "conclusions", libelle: "Conclusions" },
        { code: "pv", libelle: "Procès-verbal" },
        { code: "facture", libelle: "Facture" },
        { code: "note_interne", libelle: "Note interne" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "qualification", libelle: "À qualifier" },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "analyse", libelle: "En cours d'analyse" },
        { code: "redaction", libelle: "En rédaction" },
        { code: "validation", libelle: "En validation" },
        { code: "audience", libelle: "Audience ou échéance" },
        { code: "decision", libelle: "Décision rendue" },
        { code: "execution", libelle: "En exécution" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "litige_foncier",
      libelle: "Litiges fonciers",
      description: "Conflits sur la propriété, les bornages, l'occupation et la jouissance des terres.",
      documentTypes: [
        { code: "titre_foncier", libelle: "Titre foncier", obligatoire: true },
        { code: "document_propriete", libelle: "Document de propriété" },
        { code: "bornage", libelle: "Plan de bornage" },
        { code: "pv_constat", libelle: "PV de constat" },
        { code: "correspondance", libelle: "Correspondance" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "analyse", libelle: "Analyse foncière" },
        { code: "negociation", libelle: "Négociation" },
        { code: "audience", libelle: "Audience" },
        { code: "decision", libelle: "Décision" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "expulsion_recouvrement",
      libelle: "Expulsions et recouvrements",
      description: "Procédures d'expulsion locative et recouvrement forcé de créances.",
      documentTypes: [
        { code: "commandement_payer", libelle: "Commandement de payer", obligatoire: true },
        { code: "titre_executoire", libelle: "Titre exécutoire" },
        { code: "pv_signification", libelle: "PV de signification" },
        { code: "etat_lieux", libelle: "État des lieux" },
        { code: "quittance", libelle: "Quittance" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "mise_en_demeure", libelle: "Mise en demeure" },
        { code: "commandement", libelle: "Commandement" },
        { code: "signification", libelle: "Signification" },
        { code: "saisie", libelle: "Saisie / Expulsion" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "baux_commerciaux_habitation",
      libelle: "Baux commerciaux et d'habitation",
      description: "Contentieux locatifs commerciaux et d'habitation : loyers, charges, résiliation.",
      documentTypes: [
        { code: "contrat_bail", libelle: "Contrat de bail", obligatoire: true },
        { code: "quittance", libelle: "Quittance" },
        { code: "etat_lieux", libelle: "État des lieux" },
        { code: "correspondance", libelle: "Correspondance" },
        { code: "note_interne", libelle: "Note interne" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "mise_en_demeure", libelle: "Mise en demeure" },
        { code: "negociation", libelle: "Négociation" },
        { code: "audience", libelle: "Audience" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "recouvrement_creances",
      libelle: "Recouvrement de créances",
      description: "Recouvrement amiable et judiciaire de créances clients.",
      documentTypes: [
        { code: "facture", libelle: "Facture", obligatoire: true },
        { code: "lettre_rappel", libelle: "Lettre de rappel" },
        { code: "commandement", libelle: "Commandement" },
        { code: "titre_executoire", libelle: "Titre exécutoire" },
        { code: "pv", libelle: "PV" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "relance", libelle: "Relance amiable" },
        { code: "mise_en_demeure", libelle: "Mise en demeure" },
        { code: "commandement", libelle: "Commandement" },
        { code: "saisie", libelle: "Saisie-vente" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "contentieux_contractuel",
      libelle: "Contentieux contractuels",
      description: "Exécution, interprétation et rupture des contrats civils et commerciaux.",
      documentTypes: [
        { code: "contrat", libelle: "Contrat", obligatoire: true },
        { code: "correspondance", libelle: "Correspondance" },
        { code: "conclusions", libelle: "Conclusions" },
        { code: "pv", libelle: "PV" },
        { code: "facture", libelle: "Facture" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "analyse", libelle: "Analyse contractuelle" },
        { code: "redaction", libelle: "Rédaction" },
        { code: "validation", libelle: "Validation" },
        { code: "audience", libelle: "Audience" },
        { code: "decision", libelle: "Décision" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "redaction_analyse_contrats",
      libelle: "Rédaction et analyse de contrats",
      description: "Conception, relecture et rédaction de contrats sur mesure.",
      documentTypes: [
        { code: "contrat", libelle: "Contrat", obligatoire: true },
        { code: "avenant", libelle: "Avenant" },
        { code: "correspondance", libelle: "Correspondance" },
        { code: "note_interne", libelle: "Note interne" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "analyse", libelle: "Analyse des besoins" },
        { code: "redaction", libelle: "Rédaction" },
        { code: "relecture", libelle: "Relecture" },
        { code: "validation", libelle: "Validation client" },
        { code: "signature", libelle: "Signature" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "procedure_civile_commerciale",
      libelle: "Procédures civiles et commerciales",
      description: "Poursuite des procédures devant les juridictions civiles et commerciales.",
      documentTypes: [
        { code: "assignation", libelle: "Assignation", obligatoire: true },
        { code: "conclusions", libelle: "Conclusions" },
        { code: "pv_audience", libelle: "PV d'audience" },
        { code: "jugement", libelle: "Jugement" },
        { code: "correspondance", libelle: "Correspondance" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "analyse", libelle: "Analyse" },
        { code: "redaction", libelle: "Rédaction des conclusions" },
        { code: "audience", libelle: "Audience" },
        { code: "decision", libelle: "Décision" },
        { code: "execution", libelle: "Exécution" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "sommation_mise_en_demeure",
      libelle: "Actes de sommation et mise en demeure",
      description: "Rédaction et signification de mises en demeure et sommations.",
      documentTypes: [
        { code: "mise_en_demeure", libelle: "Mise en demeure", obligatoire: true },
        { code: "sommation", libelle: "Sommation" },
        { code: "accuse_reception", libelle: "Accusé de réception" },
        { code: "correspondance", libelle: "Correspondance" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "redaction", libelle: "Rédaction" },
        { code: "validation", libelle: "Validation" },
        { code: "signification", libelle: "Signification" },
        { code: "attente_reponse", libelle: "Attente de réponse" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "constats_proces_verbaux",
      libelle: "Constats et procès-verbaux",
      description: "Établissement de constats matériels et rédaction de procès-verbaux.",
      documentTypes: [
        { code: "pv", libelle: "Procès-verbal", obligatoire: true },
        { code: "photos", libelle: "Photos" },
        { code: "rapport", libelle: "Rapport" },
        { code: "correspondance", libelle: "Correspondance" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "programme", libelle: "Programmé" },
        { code: "constat", libelle: "Constat réalisé" },
        { code: "redaction", libelle: "Rédaction du PV" },
        { code: "validation", libelle: "Validation" },
        { code: "remise", libelle: "Remise au client" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "significations",
      libelle: "Significations",
      description: "Signification d'actes judiciaires et extra-judiciaires.",
      documentTypes: [
        { code: "assignation", libelle: "Assignation", obligatoire: true },
        { code: "signification", libelle: "Signification" },
        { code: "pv_remise", libelle: "PV de remise" },
        { code: "preuve", libelle: "Preuve de signification" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "preparation", libelle: "En préparation" },
        { code: "programmee", libelle: "Programmée" },
        { code: "signification_cours", libelle: "Signification en cours" },
        { code: "attente_retour", libelle: "Attente de retour" },
        { code: "validee", libelle: "Validée" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "saisies_execution",
      libelle: "Saisies et mesures d'exécution",
      description: "Saisies mobilières, immobilières et autres mesures d'exécution forcée.",
      documentTypes: [
        { code: "titre_executoire", libelle: "Titre exécutoire", obligatoire: true },
        { code: "pv_saisie", libelle: "PV de saisie" },
        { code: "ordonnance", libelle: "Ordonnance" },
        { code: "correspondance", libelle: "Correspondance" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "commandement", libelle: "Commandement" },
        { code: "saisie", libelle: "Saisie" },
        { code: "distribution", libelle: "Distribution du produit" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "conseil_consultation",
      libelle: "Conseils juridiques et consultations",
      description: "Consultations et avis juridiques écrits ou oraux.",
      documentTypes: [
        { code: "note_interne", libelle: "Note interne" },
        { code: "memoire", libelle: "Mémoire / Avis", obligatoire: true },
        { code: "correspondance", libelle: "Correspondance" },
        { code: "fiche_client", libelle: "Fiche client" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "analyse", libelle: "Analyse" },
        { code: "redaction", libelle: "Rédaction de l'avis" },
        { code: "validation", libelle: "Validation" },
        { code: "remise", libelle: "Remise au client" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "negociation_reglement_amiable",
      libelle: "Négociations et règlements amiables",
      description: "Médiation, négociation et rédaction de protocoles d'accord.",
      documentTypes: [
        { code: "correspondance", libelle: "Correspondance" },
        { code: "protocole_accord", libelle: "Protocole d'accord", obligatoire: true },
        { code: "note_interne", libelle: "Note interne" },
        { code: "facture", libelle: "Facture" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "analyse", libelle: "Analyse" },
        { code: "negociation", libelle: "Négociation" },
        { code: "redaction", libelle: "Rédaction de l'accord" },
        { code: "signature", libelle: "Signature" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "RLF",
      libelle: "Règlement des litiges familiaux",
      description: "Médiation, négociation et homologation des contentieux familiaux : divorce, garde, pension, succession.",
      documentTypes: [
        { code: "acte_mariage", libelle: "Acte de mariage" },
        { code: "acte_naissance", libelle: "Acte de naissance" },
        { code: "jugement_divorce", libelle: "Jugement de divorce" },
        { code: "convention_divorce", libelle: "Convention de divorce", obligatoire: true },
        { code: "etat_civil", libelle: "État civil" },
        { code: "correspondance", libelle: "Correspondance" },
        { code: "note_interne", libelle: "Note interne" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "mediation", libelle: "Médiation familiale" },
        { code: "negociation", libelle: "Négociation" },
        { code: "redaction", libelle: "Rédaction convention" },
        { code: "validation", libelle: "Validation client" },
        { code: "homologation", libelle: "Homologation" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "DROIT_NUMERIQUE",
      libelle: "Cybercriminalité et droit pénal du numérique",
      description: "Infractions numériques : hameçonnage, usurpation d'identité, atteintes aux données, cyberharcèlement.",
      documentTypes: [
        { code: "plainte", libelle: "Procès-verbal de plainte", obligatoire: true },
        { code: "rapport_expertise", libelle: "Rapport d'expertise numérique" },
        { code: "captures_ecran", libelle: "Captures d'écran / preuves" },
        { code: "conclusions", libelle: "Conclusions" },
        { code: "correspondance", libelle: "Correspondance" },
        { code: "note_interne", libelle: "Note interne" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "investigation", libelle: "Investigation numérique" },
        { code: "analyse", libelle: "Analyse juridique" },
        { code: "redaction", libelle: "Rédaction conclusions" },
        { code: "audience", libelle: "Audience" },
        { code: "decision", libelle: "Décision" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "DROIT_PENALCRIMINEL",
      libelle: "Droit pénal général et procédures criminelles",
      description: "Défense pénale générale, assistance en garde à vue, procédure d'instruction et comparution.",
      documentTypes: [
        { code: "plainte", libelle: "Plainte / PV de police", obligatoire: true },
        { code: "rapport_expertise", libelle: "Rapport d'expertise" },
        { code: "assignation", libelle: "Assignation" },
        { code: "conclusions", libelle: "Conclusions" },
        { code: "correspondance", libelle: "Correspondance" },
        { code: "note_interne", libelle: "Note interne" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "analyse", libelle: "Analyse du dossier" },
        { code: "defense", libelle: "Défense pénale" },
        { code: "redaction", libelle: "Rédaction conclusions" },
        { code: "audience", libelle: "Audience" },
        { code: "decision", libelle: "Décision" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
    {
      code: "DROIT_FINANCIER",
      libelle: "Droit pénal des affaires et criminalité financière",
      description: "Détournements, abus de biens sociaux, blanchiment, fraudes fiscales et contentieux financiers.",
      documentTypes: [
        { code: "pv_audition", libelle: "PV d'audition", obligatoire: true },
        { code: "rapports_financiers", libelle: "Rapports financiers" },
        { code: "documents_comptables", libelle: "Documents comptables" },
        { code: "conclusions", libelle: "Conclusions" },
        { code: "correspondance", libelle: "Correspondance" },
        { code: "note_interne", libelle: "Note interne" },
      ],
      workflow: [
        { code: "prospect", libelle: "Prospect", estInitial: true },
        { code: "ouvert", libelle: "Ouvert" },
        { code: "analyse_financiere", libelle: "Analyse financière" },
        { code: "audit_juridique", libelle: "Audit juridique" },
        { code: "redaction", libelle: "Rédaction conclusions" },
        { code: "audience", libelle: "Audience" },
        { code: "decision", libelle: "Décision" },
        { code: "cloture", libelle: "Clôturé", estFinal: true },
      ],
    },
  ];

  for (const s of specialites) {
    const specialite = await prisma.specialite.upsert({
      where: { code: s.code },
      update: { libelle: s.libelle, description: s.description, actif: true },
      create: {
        code: s.code,
        libelle: s.libelle,
        description: s.description,
        ordre: specialites.indexOf(s),
        selectionnee: false,
        actif: true,
      },
    });

    for (const dt of s.documentTypes) {
      await prisma.typeDocumentSpecialite.upsert({
        where: { specialiteId_code: { specialiteId: specialite.id, code: dt.code } },
        update: { libelle: dt.libelle, obligatoire: dt.obligatoire || false, actif: true },
        create: {
          specialiteId: specialite.id,
          code: dt.code,
          libelle: dt.libelle,
          obligatoire: dt.obligatoire || false,
          ordre: s.documentTypes.indexOf(dt),
          actif: true,
        },
      });
    }

    for (const w of s.workflow) {
      await prisma.workflowSpecialite.upsert({
        where: { specialiteId_code: { specialiteId: specialite.id, code: w.code } },
        update: {
          libelle: w.libelle,
          estInitial: w.estInitial || false,
          estFinal: w.estFinal || false,
          actif: true,
        },
        create: {
          specialiteId: specialite.id,
          code: w.code,
          libelle: w.libelle,
          estInitial: w.estInitial || false,
          estFinal: w.estFinal || false,
          ordre: s.workflow.indexOf(w),
          actif: true,
        },
      });
    }
  }

  console.log("Spécialités et workflows par défaut insérés");
}

async function seedTacheTemplates(prisma: any) {
  // Récupère toutes les spécialités avec leurs étapes de workflow
  const specialites = await prisma.specialite.findMany({
    include: {
      workflowEtapes: { where: { actif: true }, orderBy: { ordre: "asc" } },
    },
  });

  // Templates de tâches par code de spécialité.
  // Chaque tâche est rattachée à une étape de workflow (par code) et définit :
  // - un délai en jours depuis l'ouverture du dossier
  // - un rôle attendu (avocat, huissier, juriste, assistant, any)
  // - une priorité
  const templates: Record<
    string,
    {
      titre: string;
      description?: string;
      workflowCode: string;
      delaiJours: number;
      roleAttendu: string;
      priorite: string;
    }[]
  > = {
    contentieux_immobilier: [
      { titre: "Analyse du titre foncier et des pièces", workflowCode: "analyse", delaiJours: 3, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Rédaction des conclusions", workflowCode: "redaction", delaiJours: 10, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Relecture et validation des conclusions", workflowCode: "validation", delaiJours: 14, roleAttendu: "avocat", priorite: "moyenne" },
      { titre: "Préparation de l'audience", workflowCode: "audience", delaiJours: 21, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Signification du jugement", workflowCode: "execution", delaiJours: 30, roleAttendu: "huissier", priorite: "moyenne" },
    ],
    litige_foncier: [
      { titre: "Vérification du titre foncier et des documents de propriété", workflowCode: "analyse", delaiJours: 3, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Demande de bornage / expertise", workflowCode: "analyse", delaiJours: 7, roleAttendu: "huissier", priorite: "moyenne" },
      { titre: "Tentative de négociation amiable", workflowCode: "negociation", delaiJours: 14, roleAttendu: "avocat", priorite: "moyenne" },
      { titre: "Préparation de l'audience", workflowCode: "audience", delaiJours: 21, roleAttendu: "avocat", priorite: "haute" },
    ],
    expulsion_recouvrement: [
      { titre: "Vérification du titre exécutoire et du commandement", workflowCode: "mise_en_demeure", delaiJours: 2, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Rédaction et envoi de la mise en demeure", workflowCode: "mise_en_demeure", delaiJours: 3, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Signification du commandement de payer", workflowCode: "commandement", delaiJours: 15, roleAttendu: "huissier", priorite: "haute" },
      { titre: "Signification de l'assignation", workflowCode: "signification", delaiJours: 30, roleAttendu: "huissier", priorite: "haute" },
      { titre: "Mise en œuvre de la saisie / expulsion", workflowCode: "saisie", delaiJours: 45, roleAttendu: "huissier", priorite: "haute" },
    ],
    baux_commerciaux_habitation: [
      { titre: "Analyse du contrat de bail et des quittances", workflowCode: "ouvert", delaiJours: 3, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Rédaction de la mise en demeure", workflowCode: "mise_en_demeure", delaiJours: 5, roleAttendu: "avocat", priorite: "moyenne" },
      { titre: "Tentative de négociation amiable", workflowCode: "negociation", delaiJours: 10, roleAttendu: "avocat", priorite: "moyenne" },
      { titre: "Préparation de l'audience", workflowCode: "audience", delaiJours: 20, roleAttendu: "avocat", priorite: "haute" },
    ],
    recouvrement_creances: [
      { titre: "Vérification des factures impayées et pièces justificatives", workflowCode: "ouvert", delaiJours: 2, roleAttendu: "juriste", priorite: "haute" },
      { titre: "Envoi de la lettre de rappel", workflowCode: "relance", delaiJours: 3, roleAttendu: "juriste", priorite: "moyenne" },
      { titre: "Rédaction et envoi de la mise en demeure", workflowCode: "mise_en_demeure", delaiJours: 10, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Signification du commandement de payer", workflowCode: "commandement", delaiJours: 20, roleAttendu: "huissier", priorite: "haute" },
      { titre: "Mise en œuvre de la saisie-vente", workflowCode: "saisie", delaiJours: 35, roleAttendu: "huissier", priorite: "haute" },
    ],
    contentieux_contractuel: [
      { titre: "Analyse du contrat et des correspondances", workflowCode: "analyse", delaiJours: 3, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Rédaction des conclusions", workflowCode: "redaction", delaiJours: 10, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Relecture et validation", workflowCode: "validation", delaiJours: 14, roleAttendu: "avocat", priorite: "moyenne" },
      { titre: "Préparation de l'audience", workflowCode: "audience", delaiJours: 21, roleAttendu: "avocat", priorite: "haute" },
    ],
    redaction_analyse_contrats: [
      { titre: "Analyse des besoins du client", workflowCode: "analyse", delaiJours: 3, roleAttendu: "juriste", priorite: "haute" },
      { titre: "Rédaction du contrat", workflowCode: "redaction", delaiJours: 10, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Relecture juridique", workflowCode: "relecture", delaiJours: 14, roleAttendu: "avocat", priorite: "moyenne" },
      { titre: "Validation par le client", workflowCode: "validation", delaiJours: 18, roleAttendu: "juriste", priorite: "moyenne" },
      { titre: "Organisation de la signature", workflowCode: "signature", delaiJours: 21, roleAttendu: "assistant", priorite: "moyenne" },
    ],
    procedure_civile_commerciale: [
      { titre: "Analyse du dossier et de la juridiction compétente", workflowCode: "analyse", delaiJours: 3, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Rédaction de l'assignation", workflowCode: "redaction", delaiJours: 7, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Signification de l'assignation", workflowCode: "redaction", delaiJours: 10, roleAttendu: "huissier", priorite: "haute" },
      { titre: "Préparation de l'audience et des conclusions", workflowCode: "audience", delaiJours: 21, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Signification du jugement", workflowCode: "execution", delaiJours: 35, roleAttendu: "huissier", priorite: "moyenne" },
    ],
    sommation_mise_en_demeure: [
      { titre: "Rédaction de la mise en demeure", workflowCode: "redaction", delaiJours: 2, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Validation de l'acte", workflowCode: "validation", delaiJours: 4, roleAttendu: "avocat", priorite: "moyenne" },
      { titre: "Signification de la mise en demeure", workflowCode: "signification", delaiJours: 7, roleAttendu: "huissier", priorite: "haute" },
      { titre: "Suivi de la réponse (délai 30 jours)", workflowCode: "attente_reponse", delaiJours: 37, roleAttendu: "juriste", priorite: "moyenne" },
    ],
    constats_proces_verbaux: [
      { titre: "Programmation du constat avec l'huissier", workflowCode: "programme", delaiJours: 3, roleAttendu: "assistant", priorite: "moyenne" },
      { titre: "Réalisation du constat", workflowCode: "constat", delaiJours: 7, roleAttendu: "huissier", priorite: "haute" },
      { titre: "Rédaction du procès-verbal", workflowCode: "redaction", delaiJours: 10, roleAttendu: "huissier", priorite: "haute" },
      { titre: "Validation du PV", workflowCode: "validation", delaiJours: 12, roleAttendu: "avocat", priorite: "moyenne" },
      { titre: "Remise du PV au client", workflowCode: "remise", delaiJours: 14, roleAttendu: "assistant", priorite: "moyenne" },
    ],
    significations: [
      { titre: "Préparation de l'acte à signifier", workflowCode: "preparation", delaiJours: 1, roleAttendu: "assistant", priorite: "haute" },
      { titre: "Programmation de la signification", workflowCode: "programmee", delaiJours: 3, roleAttendu: "huissier", priorite: "moyenne" },
      { titre: "Réalisation de la signification", workflowCode: "signification_cours", delaiJours: 7, roleAttendu: "huissier", priorite: "haute" },
      { titre: "Récupération du PV de remise", workflowCode: "attente_retour", delaiJours: 10, roleAttendu: "assistant", priorite: "moyenne" },
      { titre: "Transmission de la preuve de signification", workflowCode: "validee", delaiJours: 12, roleAttendu: "huissier", priorite: "moyenne" },
    ],
    saisies_execution: [
      { titre: "Vérification du titre exécutoire", workflowCode: "ouvert", delaiJours: 2, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Rédaction du commandement", workflowCode: "commandement", delaiJours: 5, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Signification du commandement", workflowCode: "commandement", delaiJours: 8, roleAttendu: "huissier", priorite: "haute" },
      { titre: "Réalisation de la saisie", workflowCode: "saisie", delaiJours: 30, roleAttendu: "huissier", priorite: "haute" },
      { titre: "Distribution du produit de la saisie", workflowCode: "distribution", delaiJours: 45, roleAttendu: "huissier", priorite: "moyenne" },
    ],
    conseil_consultation: [
      { titre: "Analyse de la question juridique posée", workflowCode: "analyse", delaiJours: 3, roleAttendu: "juriste", priorite: "haute" },
      { titre: "Recherche jurisprudentielle et doctrinale", workflowCode: "analyse", delaiJours: 5, roleAttendu: "juriste", priorite: "moyenne" },
      { titre: "Rédaction de l'avis / mémoire", workflowCode: "redaction", delaiJours: 10, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Validation de l'avis", workflowCode: "validation", delaiJours: 12, roleAttendu: "avocat", priorite: "moyenne" },
      { titre: "Remise de l'avis au client", workflowCode: "remise", delaiJours: 14, roleAttendu: "assistant", priorite: "moyenne" },
    ],
    negociation_reglement_amiable: [
      { titre: "Analyse du dossier et des positions respectives", workflowCode: "analyse", delaiJours: 3, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Ouverture des négociations", workflowCode: "negociation", delaiJours: 7, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Rédaction du protocole d'accord", workflowCode: "redaction", delaiJours: 14, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Organisation de la signature", workflowCode: "signature", delaiJours: 21, roleAttendu: "assistant", priorite: "moyenne" },
    ],
    RLF: [
      { titre: "Analyse de la situation familiale et des pièces", workflowCode: "mediation", delaiJours: 3, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Tentative de médiation familiale", workflowCode: "mediation", delaiJours: 7, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Rédaction de la convention / requête", workflowCode: "redaction", delaiJours: 14, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Validation avec les parties", workflowCode: "validation", delaiJours: 18, roleAttendu: "avocat", priorite: "moyenne" },
      { titre: "Dépôt / homologation au tribunal", workflowCode: "homologation", delaiJours: 21, roleAttendu: "assistant", priorite: "moyenne" },
      { titre: "Suivi d'exécution", workflowCode: "cloture", delaiJours: 30, roleAttendu: "avocat", priorite: "moyenne" },
    ],
    DROIT_NUMERIQUE: [
      { titre: "Conservation des preuves numériques", workflowCode: "investigation", delaiJours: 1, roleAttendu: "avocat", priorite: "critique" },
      { titre: "Analyse technique et expertise numérique", workflowCode: "investigation", delaiJours: 5, roleAttendu: "juriste", priorite: "haute" },
      { titre: "Qualification juridique des infractions", workflowCode: "analyse", delaiJours: 7, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Rédaction des conclusions / mémoire", workflowCode: "redaction", delaiJours: 14, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Préparation de l'audience", workflowCode: "audience", delaiJours: 21, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Suivi de la décision", workflowCode: "decision", delaiJours: 30, roleAttendu: "avocat", priorite: "moyenne" },
    ],
    DROIT_PENALCRIMINEL: [
      { titre: "Examen du dossier d'instruction", workflowCode: "analyse", delaiJours: 3, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Entretien avec le client et les témoins", workflowCode: "analyse", delaiJours: 5, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Rédaction des conclusions de défense", workflowCode: "redaction", delaiJours: 10, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Préparation de l'audience", workflowCode: "audience", delaiJours: 15, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Assistance à l'audience", workflowCode: "audience", delaiJours: 20, roleAttendu: "avocat", priorite: "critique" },
      { titre: "Recours / exécution de la décision", workflowCode: "decision", delaiJours: 30, roleAttendu: "avocat", priorite: "moyenne" },
    ],
    DROIT_FINANCIER: [
      { titre: "Analyse des documents financiers et comptables", workflowCode: "analyse_financiere", delaiJours: 5, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Audit juridique et qualification des faits", workflowCode: "audit_juridique", delaiJours: 10, roleAttendu: "juriste", priorite: "haute" },
      { titre: "Rédaction des conclusions", workflowCode: "redaction", delaiJours: 15, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Préparation de l'audience", workflowCode: "audience", delaiJours: 20, roleAttendu: "avocat", priorite: "haute" },
      { titre: "Suivi de la décision", workflowCode: "decision", delaiJours: 30, roleAttendu: "avocat", priorite: "moyenne" },
    ],
  };

  let count = 0;
  for (const spec of specialites) {
    const specTemplates = templates[spec.code];
    if (!specTemplates) continue;

    const etapeMap = new Map(spec.workflowEtapes.map((e: any) => [e.code, e.id]));

    for (let i = 0; i < specTemplates.length; i++) {
      const t = specTemplates[i];
      const workflowEtapeId = etapeMap.get(t.workflowCode);
      if (!workflowEtapeId) continue;

      // Clé de déduplication : specialiteId + titre (on évite les doublons)
      const existing = await prisma.tacheTemplate.findFirst({
        where: { specialiteId: spec.id, titre: t.titre },
      });
      if (existing) {
        await prisma.tacheTemplate.update({
          where: { id: existing.id },
          data: {
            workflowEtapeId,
            description: t.description || null,
            delaiJours: t.delaiJours,
            roleAttendu: t.roleAttendu,
            priorite: t.priorite,
            ordre: i,
            actif: true,
          },
        });
        continue;
      }

      await prisma.tacheTemplate.create({
        data: {
          specialiteId: spec.id,
          workflowEtapeId,
          titre: t.titre,
          description: t.description || null,
          delaiJours: t.delaiJours,
          roleAttendu: t.roleAttendu,
          priorite: t.priorite,
          ordre: i,
          actif: true,
        },
      });
      count++;
    }
  }

  console.log(`Templates de tâches insérés/mis à jour (${count} nouveaux)`);
}

async function seedComptabiliteConfig(prisma: any) {
  const categories = [
    { code: "loyer", label: "Loyer / factures locatif", accountCode: "622", description: "Loyers et charges locatives", ordre: 10 },
    { code: "transport", label: "Transport et déplacements", accountCode: "61", description: "Frais de déplacement", ordre: 20 },
    { code: "fournitures", label: "Fournitures de bureau", accountCode: "605", description: "Fournitures et petit matériel", ordre: 30 },
    { code: "services", label: "Services extérieurs", accountCode: "62", description: "Honoraires et services extérieurs", ordre: 40 },
    { code: "impots", label: "Impôts et taxes", accountCode: "64", description: "Impôts et taxes", ordre: 50 },
    { code: "personnel", label: "Charges de personnel", accountCode: "66", description: "Salaires et charges sociales", ordre: 60 },
    { code: "divers", label: "Charges diverses", accountCode: "605", description: "Autres charges", ordre: 70 },
    { code: "electricite", label: "Facture d'électricité (SENELEC)", accountCode: "6062", description: "Paiement facture d'électricité", ordre: 80 },
    { code: "eau", label: "Facture d'eau (SEN EAU)", accountCode: "6061", description: "Paiement facture d'eau", ordre: 90 },
    { code: "telephone", label: "Facture de téléphone", accountCode: "614", description: "Paiement facture de téléphone", ordre: 100 },
    { code: "internet", label: "Facture Internet", accountCode: "614", description: "Paiement facture internet", ordre: 110 },
  ];

  for (const c of categories) {
    await prisma.chargeCategory.upsert({
      where: { code: c.code },
      update: c,
      create: c,
    });
  }

  await prisma.tvaRate.upsert({
    where: { code: "EXONERE" },
    update: {},
    create: { code: "EXONERE", label: "Exonéré", rate: 0, isDefault: false, isActive: true },
  });
  await prisma.tvaRate.upsert({
    where: { code: "TVA18" },
    update: {},
    create: { code: "TVA18", label: "TVA 18%", rate: 18, isDefault: true, isActive: true },
  });

  const rubrics = [
    { code: "BASE", label: "Salaire de base", type: "gain", calcType: "fixed", rateOrAmount: 0, sortOrder: 10 },
    { code: "PRIME", label: "Prime exceptionnelle", type: "gain", calcType: "fixed", rateOrAmount: 0, sortOrder: 20 },
    { code: "AVANCE", label: "Avance sur salaire", type: "deduction", calcType: "fixed", rateOrAmount: 0, sortOrder: 30 },
    { code: "CNSS", label: "CNSS / CSS salariale", type: "cotisation", calcType: "percent_gross", rateOrAmount: 0, sortOrder: 40 },
    { code: "IPRES", label: "IPRES salariale", type: "cotisation", calcType: "percent_gross", rateOrAmount: 0, sortOrder: 50 },
  ];

  for (const r of rubrics) {
    await prisma.payrollRubric.upsert({
      where: { code: r.code },
      update: r,
      create: r,
    });
  }

  // Mappings de comptes configurables pour l'automatisation
  const mappings = [
    { code: "CASH", label: "Caisse", accountCode: "57", journalCode: "CAI" },
    { code: "BANK", label: "Banque", accountCode: "52", journalCode: "BAN" },
    { code: "REVENUE_SERVICES", label: "Prestations de services", accountCode: "706", journalCode: "VEN" },
    { code: "TVA_COLLECTED", label: "TVA collectée", accountCode: "443", journalCode: "TVA" },
    { code: "CUSTOMER_RECEIVABLE", label: "Créances clients", accountCode: "411", journalCode: "VEN" },
    { code: "TVA_RECOVERABLE", label: "TVA récupérable", accountCode: "445", journalCode: "TVA" },
    { code: "SUPPLIER_PAYABLE", label: "Fournisseurs à payer", accountCode: "401", journalCode: "ACH" },
    { code: "SUPPLIER_ADVANCE", label: "Avances et acomptes versés", accountCode: "409", journalCode: "ACH" },
    { code: "DIRECT_REMUNERATION", label: "Rémunérations directes", accountCode: "661", journalCode: "SAL" },
    { code: "SOCIAL_CHARGES", label: "Charges sociales patronales", accountCode: "664", journalCode: "SAL" },
    { code: "CNSS_PAYABLE", label: "CNSS / CSS à payer", accountCode: "4311", journalCode: "SAL" },
    { code: "IPRES_PAYABLE", label: "IPRES à payer", accountCode: "4313", journalCode: "SAL" },
    { code: "TAX_WITHHELD", label: "IRPP retenu", accountCode: "447", journalCode: "SAL" },
    { code: "OTHER_DEDUCTIONS", label: "Autres retenues salariales", accountCode: "427", journalCode: "SAL" },
    { code: "SALARIES_PAYABLE", label: "Salaires nets à payer", accountCode: "422", journalCode: "SAL" },
    { code: "AMORTIZATION_EXPENSE", label: "Dotations aux amortissements", accountCode: "6813", journalCode: "OD" },
    { code: "AMORTIZATION_CUMULATED", label: "Amortissements cumulés", accountCode: "28", journalCode: "OD" },
  ];

  for (const m of mappings) {
    await prisma.accountMapping.upsert({
      where: { code: m.code },
      update: m,
      create: m,
    });
  }

  console.log("Configuration comptabilité (charges, TVA, rubriques paie, mappings) insérée");
}

main()
  .then(async () => {
    if (prismaClient) {
      await seedSpecialites(prismaClient as any);
      await seedTacheTemplates(prismaClient as any);
      await seedAccounting(prismaClient as any);
      await seedComptabiliteConfig(prismaClient as any);
    }
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await publicPrisma.$disconnect();
    if (prismaClient) await prismaClient.$disconnect();
  });
