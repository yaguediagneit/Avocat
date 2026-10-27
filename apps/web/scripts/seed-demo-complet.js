/**
 * Seed « données de démonstration complètes » — remplit les modules vides
 * (pilotage, cabinet, personnel, comptabilité, administration) avec des
 * données fictives sénégalaises cohérentes.
 *
 * Idempotent : chaque bloc n'est inséré que si la table est vide ou quasi
 * vide ; rien n'est écrasé. Sans effet sur les données réelles.
 *
 * Usage : node scripts/seed-demo-complet.js [--dry-run] [--tenant=<slug>]
 */
try {
  process.loadEnvFile(".env");
} catch {
  // Pas de fichier .env en production (variables injectées par le conteneur).
}
const argon2 = require("argon2");
const path = require("path");
const { readFileSync, existsSync } = require("fs");
const { PrismaClient: TenantClient } = require("@prisma/client");
const { PrismaClient: PublicClient } = require("../prisma/generated/public");

const DRY_RUN = process.argv.includes("--dry-run");
const TENANT_ARG = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1];

const SYSCOHADA_JSON = path.join(
  __dirname,
  "../data/syscohada_plan_comptable_avec_code.json"
);

const YEAR = new Date().getFullYear();
const MONTH = new Date().getMonth() + 1;
const d = (y, m, j, h = 9) => new Date(Date.UTC(y, m - 1, j, h));

const LOG = (t, msg) => console.log(`  [${t}] ${msg}`);

async function fill(db, model, rows, log) {
  const n = await db[model].count();
  if (n > 0) { LOG("skip", `${model} (${n} déjà présents)`); return null; }
  if (DRY_RUN) { LOG("dry", `${model} ← ${rows.length}`); return rows.map(() => ({ id: "dry" })); }
  const out = [];
  for (const r of rows) out.push(await db[model].create({ data: r }));
  LOG("ok", `${model} ← ${out.length}`);
  return out;
}

/* ------------------------------------------------------------------ */
/* Paramètres (listes déroulantes)                                     */
/* ------------------------------------------------------------------ */
const PARAMETRES = [
  ...[
    ["contentieux_contractuel", "Contentieux contractuel"],
    ["contentieux_immobilier", "Contentieux immobilier"],
    ["recouvrement", "Recouvrement de créances"],
    ["conseil", "Conseil / Consultation"],
    ["bail", "Baux commerciaux et d'habitation"],
    ["foncier", "Litiges fonciers"],
    ["signification", "Signification / Actes d'huissier"],
  ].map(([code, libelle], i) => ({ categorie: "type_affaire", code, libelle, ordre: i })),
  ...["Nouveau", "À qualifier", "En attente de pièces", "Ouvert", "En cours d'analyse", "En rédaction", "En validation", "Audience ou échéance à venir", "Décision rendue", "En exécution", "Facturation", "Clôturé"].map(
    (s, i) => ({ categorie: "statut_dossier", code: s, libelle: s, ordre: i })
  ),
  ...["basse", "moyenne", "haute", "critique"].map((s, i) => ({ categorie: "priorite_tache", code: s, libelle: s[0].toUpperCase() + s.slice(1), ordre: i })),
  ...["virement", "especes", "cheque", "mobile_money"].map((s, i) => ({ categorie: "mode_paiement", code: s, libelle: s, ordre: i })),
  ...["correspondance", "contrat", "conclusions", "pv", "facture", "titre_foncier", "note_interne"].map((s, i) => ({ categorie: "categorie_document", code: s, libelle: s, ordre: i })),
  ...["audience", "echeance", "rdv", "signification", "deadline"].map((s, i) => ({ categorie: "type_evenement", code: s, libelle: s, ordre: i })),
  ...["signification", "sommation", "mise_en_demeure", "constat", "saisie", "convocation"].map((s, i) => ({ categorie: "type_acte_huissier", code: s, libelle: s, ordre: i })),
  ...["conseil", "redaction", "procedure", "negociation", "recouvrement", "signification"].map((s, i) => ({ categorie: "nature_mission", code: s, libelle: s, ordre: i })),
];

async function seedParametres(db, tag) {
  const n = await db.parametre.count();
  if (n > 10) { LOG(tag, `parametre (${n}) existants`); return; }
  if (DRY_RUN) { LOG("dry", `parametre ← ${PARAMETRES.length}`); return; }
  for (const p of PARAMETRES) {
    await db.parametre.upsert({
      where: { categorie_code: { categorie: p.categorie, code: p.code } },
      update: { libelle: p.libelle, ordre: p.ordre, actif: true },
      create: p,
    });
  }
  LOG(tag, `parametre ← ${PARAMETRES.length}`);
}

/* ------------------------------------------------------------------ */
/* Rôles / utilisateurs de démo                                        */
/* ------------------------------------------------------------------ */
const ROLES = [
  { nom: "Avocat responsable", permissions: { dossiers: ["read", "write", "validate", "close"], clients: ["read", "write"], taches: ["read", "write"], documents: ["read", "write", "publish"], missions: ["read", "write"], transactions: ["read", "write"], demarches: ["read", "write"] }, estAdmin: false, estClient: false, niveauConfidentialiteMax: 3 },
  { nom: "Huissier de justice", permissions: { missions: ["read", "write"], dossiers: ["read"] }, estAdmin: false, estClient: false, niveauConfidentialiteMax: 1 },
  { nom: "Architecte", permissions: { missions: ["read", "write"], dossiers: ["read"] }, estAdmin: false, estClient: false, niveauConfidentialiteMax: 1 },
  { nom: "Conseiller juridique", permissions: { dossiers: ["read", "write"], documents: ["read", "write"], clients: ["read"] }, estAdmin: false, estClient: false, niveauConfidentialiteMax: 2 },
  { nom: "Clerc", permissions: { dossiers: ["read", "write"], documents: ["read", "write"], taches: ["read", "write"] }, estAdmin: false, estClient: false, niveauConfidentialiteMax: 1 },
  { nom: "Secrétaire", permissions: { clients: ["read", "write"], rendezVous: ["read", "write"] }, estAdmin: false, estClient: false, niveauConfidentialiteMax: 0 },
  { nom: "Comptable", permissions: { factures: ["read", "write"], paiements: ["read", "write"], comptabilite: ["read", "write"] }, estAdmin: false, estClient: false, niveauConfidentialiteMax: 0 },
];

const DEMO_USERS = [
  ["avocat.demo@cabinet.sn", "Aïssata", "NDIAYE", "Avocat responsable"],
  ["huissier.demo@cabinet.sn", "Ousmane", "DIAGNE", "Huissier de justice"],
  ["architecte.demo@cabinet.sn", "Saliou", "FALL", "Architecte"],
  ["conseiller.demo@cabinet.sn", "Marième", "CISSE", "Conseiller juridique"],
  ["clerc.demo@cabinet.sn", "Pape", "SOW", "Clerc"],
  ["secretaire.demo@cabinet.sn", "Khady", "GUEYE", "Secrétaire"],
  ["comptable.demo@cabinet.sn", "Ibrahima", "LY", "Comptable"],
];

async function seedUsers(db, tag) {
  for (const r of ROLES) {
    if (DRY_RUN) continue;
    await db.role.upsert({ where: { nom: r.nom }, update: {}, create: r });
  }
  const userCount = await db.user.count();
  if (userCount >= 3) { LOG(tag, `users (${userCount}) existants`); return; }
  const hash = await argon2.hash("Demo1234!");
  for (const [email, prenom, nom, roleNom] of DEMO_USERS) {
    if (DRY_RUN) { LOG("dry", `user ${email}`); continue; }
    const role = await db.role.findUnique({ where: { nom: roleNom } });
    if (!role) continue;
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) continue;
    await db.user.create({ data: { email, passwordHash: hash, prenom, nom, roleId: role.id, mfaEnabled: false, actif: true } });
    LOG(tag, `user ${email} (${roleNom})`);
  }
}

/* ------------------------------------------------------------------ */
/* Comptabilité : plan, exercice, journaux                             */
/* ------------------------------------------------------------------ */
function flattenAccounts(node, parentId, result, crypto) {
  if (!node || typeof node !== "object") return result;
  const own = node.account_number;
  let currentId = parentId;
  if (own && typeof own === "string") {
    currentId = crypto.randomUUID();
    const classe = Number(own.charAt(0)) || 0;
    result.push({
      id: currentId,
      accountCode: own,
      label: node.__label || own,
      class: classe,
      subClass: own.length >= 2 ? Number(own.slice(0, 2)) : classe,
      accountType: { 1: "CAPITAU", 6: "CHARGE", 7: "PRODUIT", 8: "ACTIF/PASSIF" }[classe] || "ACTIF",
      level: own.length,
      parentId,
      soldeInitial: 0,
      soldeActuel: 0,
      isActive: true,
      isAuxiliary: own.length >= 3,
    });
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "account_number") continue;
    if (typeof value === "object" && value !== null) {
      value.__label = key;
      flattenAccounts(value, currentId, result, crypto);
    }
  }
  return result;
}

async function seedComptabiliteBase(db, tenantId, tag) {
  // Plan comptable SYSCOHADA
  if ((await db.accountingAccount.count()) === 0) {
    if (existsSync(SYSCOHADA_JSON)) {
      const crypto = require("crypto");
      const raw = JSON.parse(readFileSync(SYSCOHADA_JSON, "utf8"));
      const accounts = [];
      for (const [classLabel, rootNode] of Object.entries(raw.tree || {})) {
        if (typeof rootNode === "object" && rootNode) {
          rootNode.__label = classLabel;
          flattenAccounts(rootNode, null, accounts, crypto);
        }
      }
      if (!DRY_RUN && accounts.length) {
        const byLevel = new Map();
        for (const a of accounts) {
          const l = byLevel.get(a.level) || [];
          l.push(a);
          byLevel.set(a.level, l);
        }
        for (const level of [...byLevel.keys()].sort((a, b) => a - b)) {
          await db.accountingAccount.createMany({ data: byLevel.get(level), skipDuplicates: true });
        }
        await db.accountingAccount.updateMany({ where: { accountCode: { startsWith: "443" } }, data: { accountType: "PASSIF" } });
        await db.accountingAccount.updateMany({ where: { accountCode: { startsWith: "431" } }, data: { accountType: "PASSIF" } });
        await db.accountingAccount.updateMany({ where: { accountCode: { in: ["422", "423", "424", "427", "447"] } }, data: { accountType: "PASSIF" } });
      }
      LOG(tag, `accountingAccount ← ${accounts.length} (SYSCOHADA)`);
    } else {
      LOG(tag, "SYSCOHADA JSON introuvable — plan comptable non chargé");
    }
  } else LOG(tag, "accountingAccount existant");

  let exercise = await db.accountingExercise.findFirst({ where: { year: YEAR } });
  if (!exercise) {
    if (DRY_RUN) LOG("dry", `accountingExercise ${YEAR}`);
    else exercise = await db.accountingExercise.create({
      data: { label: `Exercice ${YEAR}`, year: YEAR, startDate: new Date(`${YEAR}-01-01`), endDate: new Date(`${YEAR}-12-31`), status: "open", isClosed: false },
    });
    LOG(tag, `exercice ${YEAR}`);
  }

  if ((await db.accountingJournal.count()) === 0) {
    const journals = [
      ["ACH", "Journal des achats"], ["VEN", "Journal des ventes"], ["TRE", "Journal de trésorerie"],
      ["OD", "Journal des opérations diverses"], ["SAL", "Journal des salaires"], ["TVA", "Journal TVA"],
      ["BAN", "Journal banque"], ["CAI", "Journal caisse"], ["DIV", "Journal divers"],
    ].map(([code, label]) => ({ code, label, journalType: code }));
    if (!DRY_RUN) await db.accountingJournal.createMany({ data: journals, skipDuplicates: true });
    LOG(tag, `accountingJournal ← ${journals.length}`);
  } else LOG(tag, "accountingJournal existant");

  await fill(db, "tvaRate", [
    { code: "TVA18", label: "TVA 18%", rate: 18, isDefault: true, isActive: true },
    { code: "EXONERE", label: "Exonéré", rate: 0, isDefault: false, isActive: true },
  ], tag);

  await fill(db, "accountingTax", [
    { code: "TVA", label: "TVA déclarée (18%)", rate: 18 },
    { code: "IRPP", label: "IRPP salaires" },
    { code: "CSS", label: "Cotisations CSS" },
    { code: "IPRES", label: "Cotisations IPRES" },
    { code: "CFCE", label: "CFCE employeur" },
    { code: "PATENTE", label: "Patente" },
  ], tag);

  return exercise;
}

/* ------------------------------------------------------------------ */
/* Clients / dossiers / pilotage                                       */
/* ------------------------------------------------------------------ */
const CLIENTS = [
  { type: "entreprise", raisonSociale: "TERANGA INDUSTRIES SA", identifiant: "SN DKR 2026 B 14523", adresse: "Zone industrielle de Pikine, Dakar", coordonnees: { email: "contact@teranga-industries.sn", telephone: "33 834 12 12" }, representants: [{ nom: "FALL", prenom: "Cheikh", fonction: "Directeur général" }] },
  { type: "entreprise", raisonSociale: "DAKAR IMMO GESTION SARL", identifiant: "SN DKR 2025 B 09871", adresse: "Almadies, Dakar", coordonnees: { email: "info@dakarimmo.sn", telephone: "33 820 45 67" }, representants: [{ nom: "DIOP", prenom: "Astou", fonction: "Gérante" }] },
  { type: "physique", raisonSociale: "Mamadou BA", adresse: "Mermoz, Dakar", coordonnees: { email: "mba@orange.sn", telephone: "77 512 30 40" } },
  { type: "physique", raisonSociale: "Fatoumata SY", adresse: "Ouakam, Dakar", coordonnees: { email: "fsy@gmail.com", telephone: "76 543 21 09" } },
  { type: "entreprise", raisonSociale: "SENEGAL LOGISTIQUE GIE", identifiant: "SN DKR 2024 B 22110", adresse: "Port autonome, Dakar", coordonnees: { email: "admin@senlogistique.sn", telephone: "33 849 77 00" } },
];

const DOSSIERS = [
  { typeAffaire: "contentieux_contractuel", objet: "Rupture abusive du contrat de distribution — TERANGA INDUSTRIES", statut: "En cours d'analyse", natureMission: ["procedure", "negociation"] },
  { typeAffaire: "recouvrement", objet: "Recouvrement créance 4 500 000 F CFA — SENEGAL LOGISTIQUE", statut: "En rédaction", natureMission: ["recouvrement", "signification"] },
  { typeAffaire: "bail", objet: "Contentieux locatif — loyers impayés / M. BA", statut: "Audience ou échéance à venir", natureMission: ["procedure"] },
  { typeAffaire: "foncier", objet: "Litige de propriété — parcelle de Mbao / Mme SY", statut: "En attente de pièces", natureMission: ["conseil", "redaction"] },
];

async function seedCabinet(db, users, tag) {
  const responsable = users.responsable?.id || users.any?.id;
  let clients = await db.client.findMany({ take: 10 });
  if (clients.length < 3) {
    if (DRY_RUN) LOG("dry", `client ← ${CLIENTS.length}`);
    else for (const c of CLIENTS) clients.push(await db.client.create({ data: c }));
    LOG(tag, `client ← ${CLIENTS.length}`);
  }

  let dossiers = await db.dossier.findMany({ take: 10 });
  if (dossiers.length < 3) {
    for (let i = 0; i < DOSSIERS.length; i++) {
      const spec = DOSSIERS[i];
      const client = clients[(i + 1) % clients.length];
      const data = {
        referenceInterne: `REF-${YEAR}${String(MONTH).padStart(2, "0")}15-DEMO${i + 1}`,
        typeAffaire: spec.typeAffaire,
        natureMission: spec.natureMission,
        statut: spec.statut,
        clientId: client.id,
        avocatResponsableId: responsable,
        huissierResponsableId: users.huissier?.id || null,
        dateOuverture: d(YEAR, MONTH - 1, 10 + i * 3),
        dateEcheance: d(YEAR, MONTH + 1, 5 + i * 7),
        niveauConfidentialite: 1,
      };
      if (DRY_RUN) { LOG("dry", `dossier ${spec.objet.slice(0, 40)}`); dossiers.push({ id: "dry", referenceInterne: data.referenceInterne }); continue; }
      dossiers.push(await db.dossier.create({ data }));
    }
    LOG(tag, `dossier ← ${DOSSIERS.length}`);
  }

  const TACHES = [
    ["Rédiger la mise en demeure", "haute", "À faire", 3],
    ["Tentative de négociation amiable", "moyenne", "En cours", 7],
    ["Préparer les conclusions en réponse", "critique", "À faire", 5],
    ["Vérifier les pièces du dossier client", "moyenne", "À faire", 10],
    ["Déposer le dossier et obtenir le récépissé", "haute", "Terminée", -2],
    ["Relancer le client pour les pièces manquantes", "basse", "À faire", 12],
  ];
  if ((await db.tache.count()) === 0) {
    for (let i = 0; i < TACHES.length; i++) {
      const [titre, priorite, statut, jours] = TACHES[i];
      const dd = new Date(); dd.setDate(dd.getDate() + jours);
      const data = { dossierId: dossiers[i % dossiers.length].id, titre, priorite, statut, responsableId: responsable, createurId: responsable, echeance: dd };
      if (DRY_RUN) { LOG("dry", `tache ${titre}`); continue; }
      await db.tache.create({ data });
    }
    LOG(tag, `tache ← ${TACHES.length}`);
  }

  const EVENTS = [
    ["audience", "Audience — Tribunal départemental de Dakar", "Tribunal départemental de Dakar", 6],
    ["rdv", "Rendez-vous client — TERANGA INDUSTRIES", "Cabinet, salle de réunion", 2],
    ["deadline", "Délai de conclusions adverses", null, 9],
    ["rdv", "Réunion préparatoire dossier foncier Mbao", "Cabinet", 4],
    ["echeance", "Échéance paiement facture SENEGAL LOGISTIQUE", null, 15],
    ["signification", "Signification commandement de payer — dossier recouvrement", "Étude huissier", 11],
  ];
  if ((await db.evenement.count()) === 0) {
    for (let i = 0; i < EVENTS.length; i++) {
      const [type, titre, lieu, jours] = EVENTS[i];
      const dd = new Date(); dd.setDate(dd.getDate() + jours); dd.setHours(9 + i, 0, 0, 0);
      const data = { type, titre, dateDebut: dd, lieu, dossierId: dossiers[i % dossiers.length].id, createurId: responsable, participants: [{ nom: "Me Ndiaye" }, { nom: users.huissier?.nom || "Collaborateur" }] };
      if (DRY_RUN) { LOG("dry", `evenement ${titre}`); continue; }
      await db.evenement.create({ data });
    }
    LOG(tag, `evenement ← ${EVENTS.length}`);
  }

  if ((await db.notification.count()) === 0) {
    const notifs = dossiers.slice(0, 3).map((doss, i) => ({
      userId: responsable,
      dossierId: doss.id,
      type: "rappel_echeance",
      titre: `Échéance proche : dossier ${doss.referenceInterne}`,
      message: `Le dossier ${doss.referenceInterne} arrive à échéance dans ${3 + i * 4} jour(s).`,
      severite: i === 0 ? "urgent" : "warning",
      dateDeclenchement: new Date(),
    }));
    if (!DRY_RUN) await db.notification.createMany({ data: notifs });
    LOG(tag, `notification ← ${notifs.length}`);
  }

  if ((await db.commentaireDossier.count()) === 0) {
    const msgs = [
      "Premier contact établi avec le client ; pièces demandées.",
      "Analyse du contrat terminée — vice de forme identifié.",
      "Rendez-vous fixé avec la partie adverse pour négociation.",
      "Dossier transmis pour validation avant dépôt.",
    ];
    for (let i = 0; i < msgs.length; i++) {
      const data = { dossierId: dossiers[i % dossiers.length].id, auteurId: responsable, auteurNom: users.responsable?.nom || "Cabinet", message: msgs[i] };
      if (DRY_RUN) { LOG("dry", `commentaire ${i + 1}`); continue; }
      await db.commentaireDossier.create({ data });
    }
    LOG(tag, `commentaireDossier ← ${msgs.length}`);
  }
  return { clients, dossiers };
}

/* ------------------------------------------------------------------ */
/* Parcours procédural & recours (démo)                                 */
/* ------------------------------------------------------------------ */
async function seedProceduresRecours(db, dossiers, users, tag) {
  if ((await db.procedure.count()) > 0 || dossiers.length === 0) return;
  if (DRY_RUN) { LOG("dry", "procedure/recours ← parcours de démonstration"); return; }
  const resp = users.responsable?.id || users.any?.id;
  const rel = (j) => { const x = new Date(); x.setDate(x.getDate() + j); return x; };
  const mkProc = (dossierId, p) =>
    db.procedure.create({ data: { dossierId, publieClient: true, creePar: resp, ...p } });
  const mkEvt = (procedureId, type, description, date) =>
    db.procedureEvenement.create({ data: { procedureId, type, description, date, creePar: resp } });
  const mkRecEvt = (recoursId, nouveauStatut, description) =>
    db.recoursEvenement.create({ data: { recoursId, type: "TRANSITION", nouveauStatut, description, creePar: resp } });

  // Dossier 1 — appel commercial en préparation, délai J-3 (alerte urgente).
  const d1 = dossiers[0];
  await db.dossier.update({ where: { id: d1.id }, data: { matiere: "commercial" } });
  const p1 = await mkProc(d1.id, {
    niveau: "premiere_instance",
    juridiction: "Tribunal de grande instance hors classe de Dakar",
    chambre: "Chambre commerciale",
    greffe: "Greffe du TGI de Dakar",
    referenceRg: `RG ${YEAR}/C/0458`,
    dateSaisine: rel(-90),
    datePrononce: rel(-17),
    dateSignification: rel(-12),
    typeDecision: "jugement",
    decision: "Condamne le défendeur à payer la somme de 4 500 000 F CFA de dommages-intérêts et aux dépens.",
    sensDecision: "defavorable",
    statut: "DECISION_SIGNIFIEE",
  });
  await mkEvt(p1.id, "DECISION", "Jugement rendu en audience publique", rel(-17));
  await mkEvt(p1.id, "SIGNIFICATION", "Jugement signifié à personne par exploit d'huissier", rel(-12));
  const r1 = await db.recours.create({
    data: {
      dossierId: d1.id,
      procedureOrigineId: p1.id,
      typeRecours: "appel",
      origine: "client",
      juridictionCible: "Cour d'appel de Dakar",
      pointDepart: "signification",
      delaiJours: 15,
      dateReference: rel(-12),
      dateLimite: rel(3),
      statut: "EN_VALIDATION_AVOCAT",
      avocatId: resp,
      creePar: resp,
    },
  });
  await mkRecEvt(r1.id, "EN_VALIDATION_AVOCAT", "Projet de déclaration d'appel soumis à validation");

  // Dossier 2 — pénal : appel déclaré et enregistré, instruction à la Cour d'appel.
  const d2 = dossiers[1] || dossiers[0];
  await db.dossier.update({ where: { id: d2.id }, data: { matiere: "penal" } });
  const p2 = await mkProc(d2.id, {
    niveau: "premiere_instance",
    juridiction: "Tribunal de grande instance de Dakar",
    chambre: "Chambre correctionnelle",
    dateSaisine: rel(-120),
    datePrononce: rel(-25),
    dateSignification: rel(-20),
    typeDecision: "jugement",
    decision: "Déclare le prévenu coupable et le condamne à six mois d'emprisonnement assortis du sursis.",
    sensDecision: "mixte",
    statut: "TRANSMIS_RECOURS",
  });
  await mkEvt(p2.id, "DECISION", "Jugement correctionnel", rel(-25));
  const r2 = await db.recours.create({
    data: {
      dossierId: d2.id,
      procedureOrigineId: p2.id,
      typeRecours: "appel",
      origine: "client",
      juridictionCible: "Cour d'appel de Dakar",
      pointDepart: "prononce",
      delaiJours: 15,
      dateReference: rel(-25),
      dateLimite: rel(-10),
      dateDeclaration: rel(-15),
      dateSignification: rel(-12),
      statut: "EN_INSTRUCTION",
      avocatId: resp,
      creePar: resp,
    },
  });
  const p2b = await mkProc(d2.id, {
    niveau: "appel",
    juridiction: "Cour d'appel de Dakar",
    chambre: "Chambre correctionnelle",
    dateSaisine: rel(-15),
    statut: "EN_COURS",
  });
  await db.recours.update({ where: { id: r2.id }, data: { procedureCibleId: p2b.id } });
  await mkRecEvt(r2.id, "EN_INSTRUCTION", "Appel enregistré au greffe — dossier en instruction");

  // Dossier 3 — civil : arrêt d'appel rendu, pourvoi en cassation à analyser (J-45).
  const d3 = dossiers[2] || dossiers[0];
  await db.dossier.update({ where: { id: d3.id }, data: { matiere: "civil" } });
  const p3 = await mkProc(d3.id, {
    niveau: "premiere_instance",
    juridiction: "Tribunal de grande instance de Dakar",
    chambre: "Chambre civile",
    dateSaisine: rel(-200),
    datePrononce: rel(-120),
    dateSignification: rel(-115),
    typeDecision: "jugement",
    sensDecision: "defavorable",
    statut: "TRANSMIS_RECOURS",
  });
  const p3b = await mkProc(d3.id, {
    niveau: "appel",
    juridiction: "Cour d'appel de Dakar",
    chambre: "Chambre civile",
    dateSaisine: rel(-100),
    datePrononce: rel(-20),
    dateSignification: rel(-15),
    typeDecision: "arret",
    decision: "Confirme le jugement entrepris en toutes ses dispositions.",
    sensDecision: "defavorable",
    statut: "DECISION_SIGNIFIEE",
  });
  const r3 = await db.recours.create({
    data: {
      dossierId: d3.id,
      procedureOrigineId: p3b.id,
      typeRecours: "pourvoi",
      origine: "client",
      juridictionCible: "Cour suprême",
      pointDepart: "signification",
      delaiJours: 60,
      dateReference: rel(-15),
      dateLimite: rel(45),
      statut: "A_ANALYSER",
      avocatId: resp,
      creePar: resp,
    },
  });
  await mkRecEvt(r3.id, "A_ANALYSER", "Pourvoi créé — analyse des moyens de cassation en cours");

  LOG(tag, "procedure ← 4, recours ← 3 (parcours première instance → appel → pourvoi)");
}

/* ------------------------------------------------------------------ */
/* Factures / paiements / charges / écritures                          */
/* ------------------------------------------------------------------ */
async function seedFinance(db, tenantId, exercise, clients, dossiers, users, tag) {
  const tva = await db.tvaRate.findFirst({ where: { code: "TVA18" } });
  if ((await db.facture.count()) === 0) {
    const specs = [
      ["Honoraires — dossier contentieux contractuel", 1500000, "En attente", dossiers[0]?.id],
      ["Étude de dossier achat immeuble", 590000, "Payée", dossiers[1]?.id],
      ["Frais de signification et formalités", 250000, "Partiellement payée", dossiers[2]?.id],
      ["Consultation juridique — bail commercial", 150000, "Payée", dossiers[3]?.id],
    ];
    for (let i = 0; i < specs.length; i++) {
      const [libelle, totalTtc, statut, dossierId] = specs[i];
      const ht = Math.round(totalTtc / 1.18);
      const data = {
        clientId: clients[(i + 1) % clients.length].id,
        dossierId: dossierId || null,
        numero: `FACT-DEMO-${YEAR}-${String(i + 1).padStart(3, "0")}`,
        libelle,
        dateEmission: d(YEAR, MONTH, 2 + i * 4),
        dateEcheance: d(YEAR, MONTH + 1, 2 + i * 4),
        totalHt: ht,
        totalTva: totalTtc - ht,
        totalTtc,
        statut,
        tvaEnabled: true,
        tvaRateId: tva?.id || null,
      };
      if (DRY_RUN) { LOG("dry", `facture ${data.numero}`); continue; }
      const f = await db.facture.create({ data });
      await db.factureLine.create({ data: { factureId: f.id, description: libelle, quantite: 1, prixUnitaire: ht, tauxTva: 18, totalHt: ht, totalTva: totalTtc - ht, totalTtc } });
      if (statut !== "En attente") {
        await db.paiement.create({
          data: {
            factureId: f.id,
            montant: statut === "Payée" ? totalTtc : Math.round(totalTtc / 2),
            mode: i % 2 ? "virement" : "especes",
            reference: `PAY-${YEAR}-${100 + i}`,
            datePaiement: d(YEAR, MONTH, 5 + i * 4),
          },
        });
      }
    }
    LOG(tag, `facture ← ${specs.length} (+ paiements)`);
  } else if ((await db.paiement.count()) === 0) {
    // Factures préexistantes sans aucun règlement : on trace un paiement de démo.
    const f = await db.facture.findFirst({ orderBy: { createdAt: "asc" } });
    if (f && !DRY_RUN) {
      await db.paiement.create({ data: { factureId: f.id, montant: Math.min(f.totalTtc, 590000), mode: "virement", reference: `PAY-${YEAR}-900`, datePaiement: d(YEAR, MONTH, 8) } });
      LOG(tag, "paiement ← 1 (facture existante)");
    }
  }

  if ((await db.chargeCategory.count()) === 0) {
    const cats = [
      ["loyer", "Loyer et charges locatives"], ["transport", "Transport et déplacements"],
      ["fournitures", "Fournitures et consommables"], ["services", "Services extérieurs"],
      ["impots", "Impôts et taxes"], ["personnel", "Personnel et paie"], ["divers", "Divers"],
      ["electricite", "Électricité (SENELEC)"], ["eau", "Eau (SEN EAU)"], ["telecom", "Téléphone et Internet"],
    ].map(([code, label]) => ({ code, label }));
    if (!DRY_RUN) await db.chargeCategory.createMany({ data: cats, skipDuplicates: true });
    LOG(tag, `chargeCategory ← ${cats.length}`);
  }

  if ((await db.charge.count()) === 0) {
    const cats = await db.chargeCategory.findMany();
    const cat = (code) => cats.find((c) => c.code === code)?.id || cats[0]?.id;
    const charges = [
      [cat("loyer"), "Loyer cabinet — mois courant", 850000, "virement", 1],
      [cat("electricite"), "Facture SENELEC", 86420, "mobile_money", 3],
      [cat("telecom"), "Téléphone et internet (fibre)", 45000, "virement", 5],
      [cat("fournitures"), "Fournitures de bureau — papeterie Sandaga", 38250, "especes", 8],
      [cat("transport"), "Carburant et déplacements audiences", 60000, "especes", 10],
      [cat("services"), "Paiement huissier — signification", 130000, "virement", 12],
      [cat("impots"), "Patente annuelle", 350000, "virement", -20],
    ];
    for (const [categoryId, description, amount, paymentMethod, jours] of charges) {
      const dt = new Date(); dt.setDate(dt.getDate() - Math.abs(jours));
      if (DRY_RUN) { LOG("dry", `charge ${description}`); continue; }
      await db.charge.create({
        data: { categoryId, chargeDate: dt, amount, paymentMethod, description, dossierId: description.includes("huissier") ? dossiers[1]?.id : null },
      });
    }
    LOG(tag, `charge ← ${charges.length}`);
  }

  if ((await db.accountingEntry.count()) === 0 && exercise) {
    const acc = async (prefix) =>
      (await db.accountingAccount.findFirst({ where: { accountCode: { startsWith: prefix } }, orderBy: { accountCode: "asc" } }))?.id;
    const A = {
      clients: await acc("411"),
      honoraires: await acc("706"),
      tvaCollectee: await acc("443"),
      tvaDeductible: await acc("445"),
      banque: await acc("521"),
      caisse: await acc("571"),
      loyer: await acc("622") || await acc("623"),
      fournitures: await acc("605") || await acc("604"),
      telecom: await acc("626") || await acc("627"),
      electricite: await acc("605") || await acc("601"),
      personnel: await acc("661") || await acc("662"),
      social: await acc("431") || await acc("422"),
    };
    const journals = Object.fromEntries((await db.accountingJournal.findMany()).map((j) => [j.code, j.id]));
    const mk = async (journalCode, date, libelle, reference, lines, idem) => {
      const debit = lines.filter((l) => l.debit).reduce((s, l) => s + l.debit, 0);
      const credit = lines.filter((l) => l.credit).reduce((s, l) => s + l.credit, 0);
      const data = {
        tenantId, journalId: journals[journalCode], exerciseId: exercise.id,
        entryDate: date, libelle, reference, idempotencyKey: `demo-${idem}`,
        totalDebit: debit, totalCredit: credit, isValidated: true, validatedAt: new Date(),
        createdBy: users.responsable?.id || users.any?.id,
      };
      if (DRY_RUN) { LOG("dry", `ecriture ${libelle}`); return; }
      const e = await db.accountingEntry.create({ data });
      for (const l of lines) {
        if (!l.accountId) continue;
        await db.accountingEntryLine.create({ data: { tenantId, entryId: e.id, accountId: l.accountId, debit: l.debit || 0, credit: l.credit || 0, libelle: l.label || libelle } });
      }
    };
    if (A.clients && A.honoraires && A.tvaCollectee) {
      await mk("VEN", d(YEAR, MONTH, 2), "Émission facture honoraires TERANGA", "FAC-DEMO-001", [
        { accountId: A.clients, debit: 1500000 }, { accountId: A.honoraires, credit: Math.round(1500000 / 1.18) }, { accountId: A.tvaCollectee, credit: 1500000 - Math.round(1500000 / 1.18) },
      ], "fac-001");
      if (A.banque) await mk("TRE", d(YEAR, MONTH, 8), "Règlement facture étude de dossier", "PAY-001", [
        { accountId: A.banque, debit: 590000 }, { accountId: A.clients, credit: 590000 },
      ], "pay-001");
    }
    if (A.loyer && A.banque) await mk("ACH", d(YEAR, MONTH, 1), "Loyer cabinet", "CHG-LOYER", [
      { accountId: A.loyer, debit: 850000 }, { accountId: A.banque, credit: 850000 },
    ], "chg-loyer");
    if (A.electricite && A.caisse) await mk("ACH", d(YEAR, MONTH, 3), "Facture SENELEC", "CHG-SELEC", [
      { accountId: A.electricite, debit: 86420 }, { accountId: A.caisse, credit: 86420 },
    ], "chg-selec");
    if (A.telecom && A.banque) await mk("ACH", d(YEAR, MONTH, 5), "Téléphone et internet", "CHG-TEL", [
      { accountId: A.telecom, debit: 45000 }, { accountId: A.banque, credit: 45000 },
    ], "chg-tel");
    if (A.personnel && A.banque) await mk("SAL", d(YEAR, MONTH - 1, 28), "Salaires du mois précédent", "SAL-PAIE", [
      { accountId: A.personnel, debit: 2450000 }, { accountId: A.banque, credit: 2450000 },
    ], "sal-paie");
    if (A.social && A.banque) await mk("SAL", d(YEAR, MONTH - 1, 28), "Cotisations IPRES/CSS versées", "SAL-COT", [
      { accountId: A.social, debit: 274400 }, { accountId: A.banque, credit: 274400 },
    ], "sal-cot");
    LOG(tag, "accountingEntry ← démo");
  }
}

/* ------------------------------------------------------------------ */
/* Personnel / paie / congés / assurances                              */
/* ------------------------------------------------------------------ */
const EMPLOYEES = [
  ["EMP-001", "Aïssata", "NDIAYE", "CDI", 1000000, "married"],
  ["EMP-002", "Pape", "SOW", "CDI", 550000, "single"],
  ["EMP-003", "Khady", "GUEYE", "CDI", 350000, "single"],
  ["EMP-004", "Ibrahima", "LY", "CDD", 400000, "married"],
];

const RUBRIQUES = [
  ["BRUT", "Salaire de base", "gain", "fixe", 0, 1],
  ["PRIME_TRANS", "Prime de transport", "gain", "fixe", 30000, 2],
  ["PRIME_LOG", "Indemnité de logement", "gain", "fixe", 70000, 3],
  ["IPRES_SAL", "IPRES part salariale", "retenue", "taux_base", 5.6, 10],
  ["CSS_SAL", "CSS part salariale", "retenue", "taux_base", 5.6, 11],
  ["IRPP", "IRPP", "retenue", "taux_base", 22, 12],
  ["CSS_PAT", "CSS part patronale", "cotisation", "taux_base", 5.6, 20],
  ["IPRES_PAT", "IPRES part patronale", "cotisation", "taux_base", 5.6, 21],
];

const LEAVE_TYPES = [
  ["annuel", "Congé annuel payé", true, false, true, true],
  ["maladie", "Congé de maladie", false, true, true, false],
  ["maternite", "Congé de maternité (14 semaines)", false, true, true, true],
  ["paternite", "Congé de paternité", false, true, true, true],
  ["sans_solde", "Congé sans solde", true, false, true, false],
  ["naissance", "Naissance d'un enfant", false, true, true, false],
  ["mariage", "Mariage de l'employé", false, true, true, true],
  ["deces_proche", "Décès d'un proche", false, true, true, false],
];

const HOLIDAYS = [
  ["01-01", "Jour de l'An"], ["04-04", "Fête nationale du Sénégal"], ["05-01", "Fête du travail"],
  ["08-15", "Assomption"], ["11-01", "Toussaint"], ["12-25", "Noël"],
  // Fêtes mobiles 2026 (à ajuster chaque année)
  [`${YEAR}-03-20`, "Korité (Aïd-el-Fitr)"], [`${YEAR}-05-27`, "Tabaski (Aïd-el-Kébir)"],
  [`${YEAR}-08-26`, "Tamxarit (Achoura)"], [`${YEAR}-08-28`, "Magal de Touba"], [`${YEAR}-08-29`, "Maouloud"],
];

async function seedPersonnel(db, users, tag) {
  const admin = users.responsable?.id || users.any?.id;
  let employees = await db.employee.findMany({ take: 10 });
  if (employees.length === 0) {
    for (const [code, prenom, nom, type, salaire, marie] of EMPLOYEES) {
      const data = { employeeCode: code, firstName: prenom, lastName: nom, hireDate: d(YEAR - 2, 1, 15), contractType: type, baseSalary: salaire, maritalStatus: marie, position: type === "CDI" ? "Collaborateur" : "Comptable", department: "Cabinet" };
      if (DRY_RUN) { LOG("dry", `employee ${code}`); continue; }
      employees.push(await db.employee.create({ data }));
    }
    LOG(tag, `employee ← ${EMPLOYEES.length}`);
  }
  if ((await db.employmentContract.count()) === 0) {
    for (const emp of employees) {
      const data = { employeeId: emp.id, typeContrat: emp.contractType, dateDebut: emp.hireDate, salaireBase: emp.baseSalary, fonction: emp.position || "Collaborateur", service: "Cabinet", lieuTravail: "Dakar", statut: "actif", createdBy: admin };
      if (DRY_RUN) { LOG("dry", `contract ${emp.employeeCode}`); continue; }
      await db.employmentContract.create({ data });
    }
    LOG(tag, `employmentContract ← ${employees.length}`);
  }

  if ((await db.payrollRubric.count()) === 0) {
    if (!DRY_RUN) await db.payrollRubric.createMany({
      data: RUBRIQUES.map(([code, label, type, calcType, rateOrAmount, sortOrder]) => ({ code, label, type, calcType, rateOrAmount, sortOrder })),
    });
    LOG(tag, `payrollRubric ← ${RUBRIQUES.length}`);
  }

  if ((await db.payroll.count()) === 0) {
    const months = [MONTH - 2, MONTH - 1].filter((m) => m >= 1);
    for (const emp of employees) {
      for (const m of months) {
        const primes = emp.baseSalary >= 500000 ? 100000 : 50000;
        const gross = emp.baseSalary + primes;
        const ipres = Math.round(Math.min(gross, 360000) * 0.056);
        const css = Math.round(gross * 0.056);
        const irppBase = gross - ipres - css;
        const irpp = Math.round(irppBase * 0.22 / Math.max(1, emp.maritalStatus === "married" ? 2.5 : 1));
        const net = gross - ipres - css - irpp;
        const data = {
          employeeId: emp.id, periodYear: YEAR, periodMonth: m,
          baseSalary: emp.baseSalary, grossSalary: gross, totalGains: primes,
          totalDeductions: ipres + css + irpp, totalCotisations: 0,
          cssBase: gross, cssRate: 5.6, cssAmount: css, cssEmployerAmount: css,
          ipresBase: Math.min(gross, 360000), ipresRate: 5.6, ipresAmount: ipres, ipresEmployerAmount: ipres,
          irppTaxableBase: irppBase, irppShares: emp.maritalStatus === "married" ? 2.5 : 1, irppAmount: irpp,
          netSalary: net, totalEmployerCost: gross + css + ipres, status: "paid", paidAt: d(YEAR, m, 28),
        };
        if (DRY_RUN) { LOG("dry", `payroll ${emp.employeeCode} ${m}/${YEAR}`); continue; }
        await db.payroll.create({ data });
      }
    }
    LOG(tag, `payroll ← ${employees.length * 2}`);
  }

  if ((await db.socialPayment.count()) === 0) {
    const rows = employees.flatMap((e) => [
      { type: "IPRES", periodYear: YEAR, employeeId: e.id, amount: Math.round(Math.min(e.baseSalary + 50000, 360000) * 0.056 * 2), preparedBy: admin, periodMonth: MONTH - 1, status: "approved", approvedBy: admin, approvedAt: new Date() },
      { type: "CNSS_CSS", periodYear: YEAR, employeeId: e.id, amount: Math.round((e.baseSalary + 50000) * 0.056 * 2), preparedBy: admin, periodMonth: MONTH - 1, status: "approved", approvedBy: admin, approvedAt: new Date() },
    ]);
    if (!DRY_RUN) await db.socialPayment.createMany({ data: rows });
    LOG(tag, `socialPayment ← ${rows.length}`);
  }

  if ((await db.leaveType.count()) === 0) {
    if (!DRY_RUN) await db.leaveType.createMany({
      data: LEAVE_TYPES.map(([code, libelle, deduitSoldeConge, necessiteJustificatif, necessiteValidation, remuneree]) => ({ code, libelle, deduitSoldeConge, necessiteJustificatif, necessiteValidation, remuneree })),
    });
    LOG(tag, `leaveType ← ${LEAVE_TYPES.length}`);
  }
  if ((await db.leavePolicy.count()) === 0) {
    if (!DRY_RUN) await db.leavePolicy.create({ data: { nom: "Politique de congés par défaut", joursParMois: 2.5 } });
    LOG(tag, "leavePolicy ← 1");
  }
  const policy = await db.leavePolicy.findFirst();
  if (policy && (await db.employeeLeaveSetting.count()) === 0) {
    if (!DRY_RUN) for (const e of employees) await db.employeeLeaveSetting.create({ data: { employeeId: e.id, policyId: policy.id } });
    LOG(tag, `employeeLeaveSetting ← ${employees.length}`);
  }
  if ((await db.holiday.count()) === 0) {
    const rows = HOLIDAYS.map(([jour, libelle]) => {
      const iso = jour.startsWith(`${YEAR}`) ? jour : `${YEAR}-${jour}`;
      return { dateJour: new Date(`${iso}T00:00:00Z`), libelle };
    });
    if (!DRY_RUN) await db.holiday.createMany({ data: rows });
    LOG(tag, `holiday ← ${rows.length}`);
  }
  if ((await db.leaveRequest.count()) === 0) {
    const types = await db.leaveType.findMany();
    const tAnnuel = types.find((t) => t.code === "annuel") || types[0];
    const rows = [
      { employeeId: employees[0]?.id, leaveTypeId: tAnnuel?.id, dateDebut: d(YEAR, MONTH, 20), dateFin: d(YEAR, MONTH, 24), nombreJours: 5, motif: "Congés annuels", statut: "approuvee", approverId: admin, decidedAt: new Date() },
      { employeeId: employees[2]?.id, leaveTypeId: types.find((t) => t.code === "maladie")?.id || tAnnuel?.id, dateDebut: new Date(), dateFin: new Date(Date.now() + 86400000), nombreJours: 2, motif: "Arrêt maladie", statut: "soumise", submittedAt: new Date() },
      { employeeId: employees[3]?.id, leaveTypeId: types.find((t) => t.code === "mariage")?.id || tAnnuel?.id, dateDebut: d(YEAR, MONTH + 1, 10), dateFin: d(YEAR, MONTH + 1, 12), nombreJours: 3, motif: "Événement familial", statut: "approuvee", approverId: admin, decidedAt: new Date() },
    ].filter((r) => r.employeeId && r.leaveTypeId);
    for (const r of rows) {
      if (DRY_RUN) { LOG("dry", `leaveRequest ${r.motif}`); continue; }
      await db.leaveRequest.create({ data: { ...r, createdBy: admin } });
    }
    LOG(tag, `leaveRequest ← ${rows.length}`);
  }
}

async function seedAssurances(db, employees, users, tag) {
  const admin = users.responsable?.id || users.any?.id;
  let insurers = await db.insurer.findMany({ take: 5 });
  if (insurers.length === 0) {
    const specs = [
      { nom: "AMSA ASSURANCES", adresse: "Dakar Plateau, Immeuble Grandeur", telephone: "+221 33 864 32 32", email: "contact@amsa.sn", statut: "actif" },
      { nom: "NSIA ASSURANCES", adresse: "Avenue Léopold Sédar Senghor, Dakar", telephone: "+221 33 839 99 99", email: "sante@nsia.sn", statut: "actif" },
    ];
    if (!DRY_RUN) for (const s of specs) insurers.push(await db.insurer.create({ data: s }));
    LOG(tag, `insurer ← ${specs.length}`);
  }
  let contracts = await db.insuranceContract.findMany({ take: 5 });
  if (contracts.length === 0 && insurers.length) {
    const data = { insurerId: insurers[0].id, reference: `CTR-${YEAR}-001`, dateDebut: d(YEAR, 1, 1), dateFin: d(YEAR, 12, 31), typeCouverture: "entreprise", devise: "F CFA", tauxGeneral: 80, statut: "actif", conditions: "Couverture santé groupe — 80% des frais réels" };
    if (DRY_RUN) LOG("dry", "insuranceContract");
    else contracts.push(await db.insuranceContract.create({ data }));
    LOG(tag, "insuranceContract ← 1");
  }
  let insured = await db.insuredEmployee.findMany({ take: 10 });
  if (insured.length === 0 && contracts.length) {
    for (const e of employees.slice(0, 3)) {
      if (DRY_RUN) { LOG("dry", `insuredEmployee ${e.employeeCode}`); continue; }
      insured.push(await db.insuredEmployee.create({ data: { employeeId: e.id, contractId: contracts[0].id, dateAdhesion: d(YEAR, 1, 15) } }));
    }
    LOG(tag, `insuredEmployee ← ${insured.length}`);
  }
  if ((await db.employeeDependent.count()) === 0 && employees.length) {
    const rows = [
      { employeeId: employees[0].id, nom: "NDIAYE", prenom: "Moussa", lienFamilial: "conjoint" },
      { employeeId: employees[0].id, nom: "NDIAYE", prenom: "Awa", lienFamilial: "enfant" },
      { employeeId: employees[3].id, nom: "LY", prenom: "Fatou", lienFamilial: "conjoint" },
    ];
    if (!DRY_RUN) await db.employeeDependent.createMany({ data: rows });
    LOG(tag, `employeeDependent ← ${rows.length}`);
  }
  let providers = await db.medicalProvider.findMany({ take: 5 });
  if (providers.length === 0) {
    const specs = [
      { nom: "Clinique du Cap", typePrestataire: "clinique", email: "contact@cliniquecap.sn" },
      { nom: "Pharmacie Guigon", typePrestataire: "pharmacie", email: "guigon@pharmacie.sn" },
      { nom: "Cabinet dentaire Dentaire Plus", typePrestataire: "dentaire", email: "rdv@dentaireplus.sn" },
    ];
    if (!DRY_RUN) for (const s of specs) providers.push(await db.medicalProvider.create({ data: s }));
    LOG(tag, `medicalProvider ← ${specs.length}`);
  }
  if (!contracts.length || !insured.length || !providers.length) return;
  const c = contracts[0];
  if ((await db.insuranceQuote.count()) === 0) {
    for (let i = 0; i < Math.min(2, insured.length); i++) {
      const total = 25000 + i * 15000;
      const prisEnCharge = Math.round(total * c.tauxGeneral / 100);
      const data = { reference: `DEV-${YEAR}-${i + 1}`, insuredEmployeeId: insured[i].id, contractId: c.id, providerId: providers[i % providers.length].id, dateDevis: d(YEAR, MONTH, 5 + i), typeSoin: "consultation", montantTotal: total, tauxApplique: c.tauxGeneral, partCabinetEstimee: prisEnCharge, partEmployeEstimee: total - prisEnCharge, statut: "valide" };
      if (DRY_RUN) { LOG("dry", `insuranceQuote ${data.reference}`); continue; }
      await db.insuranceQuote.create({ data });
    }
    LOG(tag, "insuranceQuote ← 2");
  }
  if ((await db.coverageRequest.count()) === 0) {
    const data = { reference: `PEC-${YEAR}-001`, insuredEmployeeId: insured[0].id, contractId: c.id, providerId: providers[0].id, dateSoinsPrevue: d(YEAR, MONTH, 20), montantEstime: 85000, tauxDemande: c.tauxGeneral, montantPrisEnChargeEstime: 68000, montantEmployeEstime: 17000, statut: "approuvee", dateReponse: new Date(), createdBy: admin };
    if (DRY_RUN) LOG("dry", "coverageRequest");
    else await db.coverageRequest.create({ data });
    LOG(tag, "coverageRequest ← 1");
  }
  if ((await db.medicalInvoice.count()) === 0) {
    const data = { referenceInterne: `FAC-MED-${YEAR}-001`, insuredEmployeeId: insured[0].id, contractId: c.id, providerId: providers[0].id, dateSoins: d(YEAR, MONTH, 6), dateFacture: d(YEAR, MONTH, 7), typeSoin: "consultation", montantTotal: 45000, tauxApplique: c.tauxGeneral, partCabinet: 36000, partEmploye: 9000, montantPayeEmploye: 9000, resteAPayerEmploye: 0, statut: "validee", statutPaiementEmploye: "paye", createdBy: admin };
    if (DRY_RUN) { LOG("dry", "medicalInvoice"); }
    else {
      const inv = await db.medicalInvoice.create({ data });
      if ((await db.employeeInsurancePayment.count()) === 0) {
        await db.employeeInsurancePayment.create({ data: { invoiceId: inv.id, montant: 36000, datePaiement: d(YEAR, MONTH, 10), modePaiement: "virement", receivedBy: admin } });
      }
    }
    LOG(tag, "medicalInvoice ← 1 (+ paiement assureur)");
  }
  if ((await db.insurerPayment.count()) === 0) {
    const data = { contractId: c.id, typePaiement: "avance", montant: 4000000, datePaiement: d(YEAR, 1, 10), modePaiement: "virement", referencePaiement: "AV-CTR-001", statut: "paye", createdBy: admin, approvedBy: admin, approvedAt: new Date(), paidBy: admin, paidAt: d(YEAR, 1, 10) };
    if (DRY_RUN) LOG("dry", "insurerPayment");
    else await db.insurerPayment.create({ data });
    LOG(tag, "insurerPayment ← 1");
  }
}

/* ------------------------------------------------------------------ */
/* Administration : demandes, courrier, audiences, formalités…         */
/* ------------------------------------------------------------------ */
async function seedAdministration(db, dossiers, users, tag) {
  const admin = users.responsable?.id || users.any?.id;
  const dos = (i) => dossiers[i % dossiers.length]?.id || null;

  if ((await db.clientRequest.count()) === 0) {
    const rows = [
      { type: "info", subject: "Contentieux avec mon bailleur", description: "Loyers et réparations contestées — demande de conseil.", status: "nouvelle", requesterName: "Matar TALL", requesterPhone: "+221 77 544 33 22", requesterEmail: "matar.tall@gmail.com", requestDate: new Date(), createdBy: admin },
      { type: "rendezvous", subject: "Rendez-vous signature contrat", description: "Souhaite un rendez-vous pour signer le compromis.", status: "en_cours", requesterName: "Astou DIOP", requesterPhone: "+221 76 200 11 44", requesterEmail: "a.diop@dakarimmo.sn", clientId: null, requestDate: new Date(), responseStatus: "en_attente", createdBy: admin },
      { type: "document", subject: "Envoi pièces dossier succession", description: "Transmission de l'acte de décès et du livret de famille.", status: "traite", requesterName: "Fatoumata SY", requesterPhone: "+221 76 543 21 09", requestDate: d(YEAR, MONTH, 2), responseStatus: "repondu", responseDetail: "Pièces réceptionnées et versées au dossier.", createdBy: admin },
      { type: "info", subject: "Création SARL — formalités RCCM", description: "Demande d'accompagnement pour immatriculation.", status: "nouvelle", requesterName: "SENEGAL LOGISTIQUE", requesterPhone: "+221 33 849 77 00", requestDate: new Date(), createdBy: admin },
    ];
    for (const r of rows) { if (DRY_RUN) { LOG("dry", `clientRequest ${r.subject}`); continue; } await db.clientRequest.create({ data: r }); }
    LOG(tag, `clientRequest ← ${rows.length}`);
  }

  if ((await db.callLog.count()) === 0) {
    const rows = [
      { direction: "entrant", channel: "telephone", contactName: "Ousmane DIAGNE", structure: "Étude huissier", subject: "Confirmation signification assignation", notes: "Acte signifié, PV à retirer au greffe.", callDate: d(YEAR, MONTH, 3, 10), createdBy: admin },
      { direction: "entrant", channel: "telephone", contactName: "Mamadou BA", structure: "", subject: "Suivi dossier locatif", notes: "Informé de l'audience de la semaine prochaine.", callDate: d(YEAR, MONTH, 4, 15), createdBy: admin },
      { direction: "sortant", channel: "telephone", contactName: "Greffe tribunal de Dakar", structure: "Tribunal", subject: "Vérification mise en état", notes: "Dossier au rôle de jeudi.", callDate: d(YEAR, MONTH, 5, 9), createdBy: admin },
      { direction: "sortant", channel: "autre", contactName: "Astou DIOP", structure: "DAKAR IMMO", subject: "Relance signature mandat (WhatsApp)", notes: "Client confirme vendredi.", callDate: d(YEAR, MONTH, 6, 14), createdBy: admin },
    ];
    for (const r of rows) { if (DRY_RUN) { LOG("dry", `callLog ${r.subject}`); continue; } await db.callLog.create({ data: r }); }
    LOG(tag, `callLog ← ${rows.length}`);
  }

  if ((await db.missingDocument.count()) === 0 && dossiers.length) {
    const rows = [
      { dossierId: dos(0), typeDocument: "Titre foncier", description: "Original demandé au client le 02/", status: "manquant", relanceDate: d(YEAR, MONTH, 12), createdBy: admin },
      { dossierId: dos(0), typeDocument: "Pièce d'identité du gérant", description: "Copie CNI en cours d'envoi", status: "manquant", relanceDate: d(YEAR, MONTH, 8), createdBy: admin },
      { dossierId: dos(1), typeDocument: "Factures impayées", description: "Reçues partiellement — solde à confirmer", status: "relance", createdBy: admin },
    ];
    for (const r of rows) { if (DRY_RUN) { LOG("dry", `missingDocument`); continue; } await db.missingDocument.create({ data: r }); }
    LOG(tag, `missingDocument ← ${rows.length}`);
  }

  if ((await db.hearing.count()) === 0) {
    const rows = [
      { type: "audience", title: "Audience référés — contentieux locatif M. BA", date: d(YEAR, MONTH + 1, 6, 9), location: "Tribunal départemental de Dakar", dossierId: dos(2), attendees: "Me Ndiaye, client", status: "planifie", createdBy: admin },
      { type: "reunion", title: "Réunion de synthèse — dossier foncier Mbao", date: d(YEAR, MONTH, 18, 15), location: "Cabinet, salle de réunion", dossierId: dos(3), attendees: "Me Ndiaye, Mme SY", status: "planifie", createdBy: admin },
      { type: "audience", title: "Audience de mise en état — SENEGAL LOGISTIQUE", date: d(YEAR, MONTH + 1, 13, 11), location: "Tribunal de commerce hors class", dossierId: dos(1), attendees: "Me Ndiaye", status: "planifie", createdBy: admin },
    ];
    for (const r of rows) {
      if (DRY_RUN) { LOG("dry", `hearing ${r.title}`); continue; }
      const h = await db.hearing.create({ data: r });
      // Convention : audience → événement calendrier associé
      await db.evenement.create({ data: { type: r.type === "reunion" ? "rdv" : "audience", titre: r.title, dateDebut: r.date, lieu: r.location, dossierId: r.dossierId, createurId: admin, participants: (r.attendees || "").split(",").map((nom) => ({ nom: nom.trim() })) } });
    }
    LOG(tag, `hearing ← ${rows.length} (+ événements)`);
  }

  if ((await db.courtFormality.count()) === 0) {
    const rows = [
      { title: "Dépôt des conclusions en réponse", type: "tribunal", entity: "Greffe — Tribunal départemental de Dakar", status: "en_cours", dueDate: d(YEAR, MONTH + 1, 3), dossierId: dos(0), notes: "Conclusions en relecture", createdBy: admin },
      { title: "Retrait du PV de signification", type: "tribunal", entity: "Étude Me Ousmane Diagne (huissier)", status: "en_cours", dueDate: d(YEAR, MONTH, 16), dossierId: dos(1), createdBy: admin },
      { title: "Enregistrement de l'assignation", type: "tribunal", entity: "Service de l'Enregistrement", status: "finalise", dueDate: d(YEAR, MONTH - 1, 25), completedDate: d(YEAR, MONTH - 1, 25), dossierId: dos(1), createdBy: admin },
    ];
    for (const r of rows) { if (DRY_RUN) { LOG("dry", `courtFormality ${r.title}`); continue; } await db.courtFormality.create({ data: r }); }
    LOG(tag, `courtFormality ← ${rows.length}`);
  }

  if ((await db.providerMission.count()) === 0) {
    const rows = [
      { profession: "huissier", providerName: "Étude Me Ousmane Diagne", reference: `ORD-${YEAR}-001`, description: "Signification de l'assignation au défendeur", status: "a_faire", dossierId: dos(1), amount: 65000, dueDate: d(YEAR, MONTH, 20), createdBy: admin },
      { profession: "huissier", providerName: "Étude Me Ousmane Diagne", reference: `ORD-${YEAR}-002`, description: "Constat sur les lieux — litige locatif", status: "en_cours", dossierId: dos(2), amount: 90000, dueDate: d(YEAR, MONTH, 22), createdBy: admin },
      { profession: "expert", providerName: "Cabinet de géomètres SARR & Fils", reference: `GEO-${YEAR}-001`, description: "Bornage contradictoire parcelle de Mbao", status: "en_cours", dossierId: dos(3), amount: 350000, dueDate: d(YEAR, MONTH + 1, 5), createdBy: admin },
      { profession: "expert", providerName: "Fidexpert SARL", reference: `EXP-${YEAR}-001`, description: "Évaluation du préjudice commercial", status: "a_faire", dossierId: dos(0), amount: 500000, dueDate: d(YEAR, MONTH + 1, 15), createdBy: admin },
    ];
    for (const r of rows) { if (DRY_RUN) { LOG("dry", `providerMission ${r.reference}`); continue; } await db.providerMission.create({ data: r }); }
    LOG(tag, `providerMission ← ${rows.length}`);
  }

  if ((await db.mail.count()) === 0) {
    const rows = [
      { direction: "entrant", mailDate: d(YEAR, MONTH, 2), reference: `${YEAR}${String(MONTH).padStart(2, "0")}02-001`, structure: "TERANGA INDUSTRIES SA", contact: "Cheikh FALL", subject: "Transmission du contrat de distribution", body: "Envoi du contrat litigieux et des échanges antérieurs.", createdBy: admin },
      { direction: "sortant", mailDate: d(YEAR, MONTH, 3), reference: `${YEAR}${String(MONTH).padStart(2, "0")}03-001`, structure: "Greffe — Tribunal de Dakar", contact: "", subject: "Dépôt de requête en référé", body: "Requête et pièces annexées.", createdBy: admin },
      { direction: "entrant", mailDate: d(YEAR, MONTH, 5), reference: `${YEAR}${String(MONTH).padStart(2, "0")}05-001`, structure: "DGID — Cadastre", contact: "", subject: "Attestation de propriété — dossier Mbao", body: "Réponse administrative reçue.", createdBy: admin },
      { direction: "sortant", mailDate: d(YEAR, MONTH, 7), reference: `${YEAR}${String(MONTH).padStart(2, "0")}07-001`, structure: "DAKAR IMMO GESTION SARL", contact: "Astou DIOP", subject: "Projet de mandat de gestion locative", body: "Veuillez trouver ci-joint le projet pour relecture.", createdBy: admin },
    ];
    for (const r of rows) { if (DRY_RUN) { LOG("dry", `mail ${r.subject}`); continue; } await db.mail.create({ data: r }); }
    LOG(tag, `mail ← ${rows.length}`);
  }
}

/* ------------------------------------------------------------------ */
/* Documents GED (vrai fichier PDF non chiffré versé sur le stockage)   */
/* ------------------------------------------------------------------ */
function buildMiniPdf(title, lines) {
  const esc = (s) => s.replace(/[^\x20-\x7E]/g, "?").replace(/[\\()]/g, "\\$&");
  const stream = ["BT /F1 16 Tf 50 780 Td (" + esc(title) + ") Tj /F1 11 Tf"]
    .concat(lines.map((l, i) => `0 ${i === 0 ? -34 : -18} Td (${esc(l)}) Tj`), ["ET"]).join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const xref = [0];
  objs.forEach((o, i) => { xref.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const start = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + xref.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

async function seedDocuments(db, tenantId, dossiers, users, tag) {
  if ((await db.document.count()) > 0 || !dossiers.length) return;
  if (DRY_RUN) { LOG("dry", "document ← 4 (GED)"); return; }
  const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
  const crypto = require("crypto");
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION || "us-east-1",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "" },
    forcePathStyle: true,
  });
  const docs = [
    ["Contrat de bail signé.pdf", "contrat", 1, ["CONTRAT DE BAIL - EXEMPLAIRE CLIENT", "Bailleur : DAKAR IMMO GESTION SARL", "Locataire : Mamadou BA", "Document de demonstration."]],
    ["CNI gérant - copie.pdf", "piece_identite", 0, ["PIECE D'IDENTITE - COPIE", "Document de demonstration."]],
    ["Note de synthèse du dossier.pdf", "note_interne", 0, ["NOTE DE SYNTHESE", "Analyse juridique preliminaire.", "Document de demonstration."]],
    ["Titre foncier - copie.pdf", "titre_foncier", 3, ["TITRE FONCIER - COPIE", "Parcelle de Mbao - TF n 12.345/R", "Document de demonstration."]],
  ];
  let created = 0;
  for (const [nom, categorie, di, lines] of docs) {
    const dossier = dossiers[di % dossiers.length];
    const bytes = buildMiniPdf(nom.replace(/\.pdf$/, ""), lines);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    const s3Key = `tenants/${tenantId}/dossiers/${dossier.id}/${hash}`;
    try {
      await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: s3Key, Body: bytes, ContentType: "application/pdf" }));
    } catch (e) {
      LOG("skip", `document ${nom} (stockage indisponible : ${e.message})`);
      continue;
    }
    await db.document.create({
      data: {
        dossierId: dossier.id, nom, categorie, s3KeyChiffre: s3Key, hashSha256: hash,
        taille: bytes.length, publieClient: categorie !== "note_interne",
        datePublication: categorie !== "note_interne" ? new Date() : null,
        creePar: users.responsable?.id || users.any?.id,
        metadata: { description: "Document de démonstration", originalType: "application/pdf" },
      },
    });
    created++;
  }
  LOG(tag, `document ← ${created} (GED)`);
}

/* ------------------------------------------------------------------ */
/* Missions d'intervenants                                             */
/* ------------------------------------------------------------------ */
async function seedMissions(db, dossiers, users, tag) {
  const dos = (i) => dossiers[i % dossiers.length]?.id;
  const mk = async (model, idField, userId, rows) => {
    if ((await db[model].count()) > 0) { LOG("skip", model); return; }
    for (const [typeActe, i, descr] of rows) {
      const data = { dossierId: dos(i), typeActe, [idField]: userId || users.any?.id, destinataire: descr, statut: "En cours", datePrevue: d(YEAR, MONTH, 8 + i * 3), adresseSignification: "Dakar" };
      if (DRY_RUN) { LOG("dry", `${model} ${typeActe}`); continue; }
      await db[model].create({ data });
    }
    LOG(tag, `${model} ← ${rows.length}`);
  };
  await mk("missionHuissier", "huissierId", users.huissier?.id, [["signification", 1, "Signification commandement de payer"], ["constat", 2, "Constat huissier sur les lieux"]]);
  await mk("missionArchitecte", "architecteId", users.architecte?.id, [["expertise", 3, "Expertise technique du bien litigieux"], ["relevé", 0, "Relevé et plan des lieux"]]);
  await mk("missionConseillerJuridique", "conseillerJuridiqueId", users.conseiller?.id, [["consultation", 0, "Consultation régime OHADA"], ["redaction", 1, "Relecture acte de cession"]]);
  await mk("missionClerc", "clercId", users.clerc?.id, [["depot", 0, "Dépôt des conclusions au greffe"], ["suivi", 2, "Suivi mise en état"]]);
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                       */
/* ------------------------------------------------------------------ */
(async () => {
  const pub = new PublicClient();
  let tenants = await pub.tenant.findMany({ where: { actif: true } });
  if (TENANT_ARG) tenants = tenants.filter((t) => t.slug === TENANT_ARG || t.id === TENANT_ARG);
  const base = process.env.DATABASE_URL;

  for (const t of tenants) {
    const url = t.databaseUrl || `${base}${base.includes("?") ? "&" : "?"}schema=${t.schemaName}`;
    const db = new TenantClient({ datasources: { db: { url } } });
    const tag = t.slug || t.id;
    console.log(`\n===== TENANT ${tag} (${t.schemaName}) =====`);

    try {
      await seedParametres(db, tag);
      await seedUsers(db, tag);

      const allUsers = await db.user.findMany({ include: { role: { select: { nom: true } } } });
      const users = {
        any: allUsers[0],
        responsable: allUsers.find((u) => /avocat|admin/i.test(u.role?.nom || "")) || allUsers[0],
        huissier: allUsers.find((u) => /huissier/i.test(u.role?.nom || "")),
        architecte: allUsers.find((u) => /architecte/i.test(u.role?.nom || "")),
        conseiller: allUsers.find((u) => /conseiller/i.test(u.role?.nom || "")),
        clerc: allUsers.find((u) => /clerc/i.test(u.role?.nom || "")),
      };

      const exercise = await seedComptabiliteBase(db, t.id, tag);
      const { clients, dossiers } = await seedCabinet(db, users, tag);
      await seedProceduresRecours(db, dossiers, users, tag);
      await seedFinance(db, t.id, exercise, clients, dossiers, users, tag);
      const employees = await db.employee.findMany({ take: 10 });
      await seedPersonnel(db, users, tag);
      const employees2 = employees.length ? employees : await db.employee.findMany({ take: 10 });
      await seedAssurances(db, employees2, users, tag);
      await seedAdministration(db, dossiers, users, tag);
      await seedDocuments(db, t.id, dossiers, users, tag);
      await seedMissions(db, dossiers, users, tag);
    } finally {
      await db.$disconnect();
    }
  }
  await pub.$disconnect();
  console.log("\nTerminé. Identifiants démo créés le cas échéant : *.demo@cabinet.sn / Demo1234!");
})();
