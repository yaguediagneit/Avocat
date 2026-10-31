/**
 * Seed « données de démonstration » complémentaire : remplit les tables encore
 * vides après `seed-demo-complet.js` (conflits d'intérêts, permissions dossier,
 * versions de documents, dossiers immobiliers, parties de démarche, historique
 * employé, règles de cotisation, amortissements, paiements et clôtures
 * d'assurance).
 *
 * Idempotent : chaque bloc n'est inséré que si sa table est vide ; rien n'est
 * écrasé. Les écritures comptables ne sont jamais générées (dotations non
 * comptabilisées). `mfa_email_codes` n'est volontairement pas alimentée.
 *
 * Usage : node scripts/seed-demo-tables-vides.js [--dry-run] [--tenant=<slug>]
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
const LOG = (t, msg) => console.log(`  [${t}] ${msg}`);
const rel = (j) => { const x = new Date(); x.setDate(x.getDate() + j); return x; };

async function empty(db, model) {
  const n = await db[model].count();
  if (n > 0) LOG("skip", `${model} (${n} déjà présents)`);
  return n === 0;
}

async function run(db, tag, who) {
  const uid = (await db.user.findFirst({ where: { actif: true }, orderBy: { createdAt: "asc" } }))?.id;
  const users = await db.user.findMany({ where: { actif: true }, take: 6, orderBy: { createdAt: "asc" } });
  const dossiers = await db.dossier.findMany({ take: 8, orderBy: { createdAt: "asc" } });
  const put = async (model, rows) => {
    if (!rows.length) return LOG("skip", `${model} (aucune donnée source)`);
    if (DRY_RUN) return LOG("dry", `${model} ← ${rows.length}`);
    await db[model].createMany({ data: rows });
    LOG("ok", `${model} ← ${rows.length}`);
  };

  if (await empty(db, "conflitInteret") && dossiers.length >= 2) {
    const ts = ["client_commun", "partie_adverse_commune", "client_vs_partie_adverse"];
    const sts = ["detecte", "valide", "resolu"];
    await put("conflitInteret", [0, 1, 2].filter((i) => dossiers[i + 1]).map((i) => ({
      dossierId: dossiers[i].id,
      dossierConflitId: dossiers[i + 1].id,
      typeConflit: ts[i],
      statut: sts[i],
      details: { source: "démo", commentaire: "Conflit potentiel détecté automatiquement" },
      validePar: i > 0 ? uid : null,
      dateVerification: i > 0 ? rel(-i * 3) : null,
      note: i === 2 ? "Vérifié : aucun conflit réel, parties distinctes." : null,
    })));
  }

  if (await empty(db, "permissionDossier") && dossiers.length) {
    const niveaux = ["lecture", "ecriture", "admin"];
    const rows = [];
    dossiers.slice(0, 4).forEach((d, i) => {
      const u = users[(i + 1) % users.length];
      if (u) rows.push({ dossierId: d.id, userId: u.id, niveau: niveaux[i % 3] });
    });
    await put("permissionDossier", rows);
  }

  if (await empty(db, "versionDocument")) {
    const docs = await db.document.findMany({ take: 6, orderBy: { createdAt: "asc" } });
    await put("versionDocument", docs.map((d) => ({
      documentId: d.id,
      s3KeyChiffre: d.s3KeyChiffre,
      numeroVersion: d.versionCourante || 1,
      hashSha256: d.hashSha256,
      creePar: d.creePar || uid,
    })));
  }

  if (await empty(db, "dossierImmobilier")) {
    const rows = dossiers
      .filter((d) => /foncier|immobilier|bail|expulsion/i.test(d.typeAffaire || ""))
      .slice(0, 3);
    const src = rows.length ? rows : dossiers.slice(0, 2);
    const data = [
      ["Parcelle n°12, lotissement Mermoz, Dakar", "TF 4521/DG", "villa", "Famille Sow", "Locataire (bail commercial)", 38000000],
      ["Lot 45, Cité Keur Gorgui, Dakar", "TF 1187/DG", "appartement", "SCI Teranga", "Occupant sans titre", 22500000],
      ["Terrain de 600 m², Saly Portudal", "TF 9034/TH", "terrain nu", "M. Diallo", "Néant", 15000000],
    ];
    await put("dossierImmobilier", src.map((d, i) => ({
      dossierId: d.id,
      adresseBien: data[i][0],
      titreFoncier: data[i][1],
      natureBien: data[i][2],
      proprietaire: data[i][3],
      occupant: data[i][4],
      montantLitige: data[i][5],
      documentsPropriete: ["Titre foncier", "Plan de situation", "Certificat de non-litige"],
    })));
  }

  if (await empty(db, "demarchePartie")) {
    const demarches = await db.demarche.findMany({ take: 4, orderBy: { createdAt: "asc" } });
    const demandeurs = await db.demandeur.findMany({ take: 4, orderBy: { createdAt: "asc" } });
    const roles = ["CO_DEMANDEUR", "MANDATAIRE", "BENEFICIAIRE"];
    const rows = [];
    demarches.forEach((dm, i) => {
      const dd = demandeurs.find((x) => x.id !== dm.demandeurId) || demandeurs[0];
      if (dd) rows.push({ demarcheId: dm.id, demandeurId: dd.id, role: roles[i % 3], ordre: i });
    });
    await put("demarchePartie", rows);
  }

  if (await empty(db, "employeeHistory")) {
    const emps = await db.employee.findMany({ take: 4, orderBy: { createdAt: "asc" } });
    const rows = [];
    emps.forEach((e, i) => {
      rows.push({ employeeId: e.id, field: "position", oldValue: i % 2 ? "Assistant juridique" : "Secrétaire", newValue: e.position || "Juriste", changedBy: uid, changedAt: rel(-120 - i * 20) });
      rows.push({ employeeId: e.id, field: "regime", oldValue: "general", newValue: e.regime || "general", changedBy: uid, changedAt: rel(-60 - i * 10) });
    });
    await put("employeeHistory", rows);
  }

  if (await empty(db, "payrollContributionRule")) {
    const from = new Date(Date.UTC(new Date().getFullYear(), 0, 1));
    await put("payrollContributionRule", [
      { code: "IPRES_RG", regime: "general", label: "IPRES – Régime général de retraite", organism: "IPRES", branch: "Retraite", employeeRate: 0.056, employerRate: 0.084, monthlyCeiling: 432000, effectiveFrom: from, accountEmployee: "4311", accountEmployer: "6642" },
      { code: "CSS_PF", regime: "general", label: "CSS – Prestations familiales", organism: "CSS", branch: "Prestations familiales", employeeRate: 0, employerRate: 0.07, monthlyCeiling: 63000, effectiveFrom: from, accountEmployee: null, accountEmployer: "6641" },
    ]);
  }

  if (await empty(db, "chargeAmortissement")) {
    const cat = await db.chargeCategory.findFirst({ orderBy: { ordre: "asc" } });
    if (!cat) LOG("skip", "chargeAmortissement (aucune catégorie de charge)");
    else if (DRY_RUN) LOG("dry", "charge immobilisation + 6 dotations");
    else {
      const total = 1200000, months = 6, per = total / months;
      const start = new Date(); start.setDate(1); start.setMonth(start.getMonth() - 2);
      const charge = await db.charge.create({
        data: {
          categoryId: cat.id, chargeDate: start, amount: total, totalHt: total, taxAmount: 0, paymentMethod: "virement",
          description: "Achat matériel informatique (amorti sur 6 mois) — démo", supplierName: "Teranga Informatique",
          supplierInvoiceRef: "FA-DEMO-0001", isImmobilisation: true, immobilisationMode: "montant", immobilisationMonths: months,
          immobilisationAccountCode: "2441",
        },
      });
      const rows = Array.from({ length: months }, (_, i) => {
        const due = new Date(start); due.setMonth(due.getMonth() + i + 1);
        const cumul = per * (i + 1);
        return { chargeId: charge.id, numero: i + 1, periodYear: due.getFullYear(), periodMonth: due.getMonth() + 1, dueDate: due, amount: per, cumul, vnc: total - cumul };
      });
      await db.chargeAmortissement.createMany({ data: rows });
      LOG("ok", `charge immobilisation + chargeAmortissement ← ${rows.length}`);
    }
  }

  const invoices = await db.medicalInvoice.findMany({ where: { partEmploye: { gt: 0 } }, take: 3, orderBy: { createdAt: "asc" } });
  if (await empty(db, "employeeInsurancePayment") && invoices.length) {
    const modes = ["especes", "virement", "mobile_money"];
    const rows = invoices.map((inv, i) => ({
      invoiceId: inv.id,
      montant: i === 0 ? inv.partEmploye : Math.round(inv.partEmploye / 2),
      datePaiement: rel(-10 - i * 5),
      modePaiement: modes[i % 3],
      referencePaiement: `PAY-DEMO-${i + 1}`,
      receivedBy: uid,
      observations: i === 0 ? "Part employé soldée" : "Paiement partiel",
    }));
    await put("employeeInsurancePayment", rows);
    if (!DRY_RUN) {
      for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i];
        if (inv.montantPayeEmploye > 0) continue;
        const paid = rows[i].montant;
        await db.medicalInvoice.update({
          where: { id: inv.id },
          data: { montantPayeEmploye: paid, resteAPayerEmploye: Math.max(0, inv.partEmploye - paid), statutPaiementEmploye: paid >= inv.partEmploye ? "paye" : "partiel" },
        });
      }
    }
  }

  if (await empty(db, "insurancePeriodClosure")) {
    const contracts = await db.insuranceContract.findMany({ take: 2, orderBy: { createdAt: "asc" } });
    const rows = [];
    for (const c of contracts) {
      const agg = await db.medicalInvoice.aggregate({
        where: { contractId: c.id },
        _sum: { montantTotal: true, partEmploye: true, partCabinet: true, montantPayeEmploye: true },
      });
      const partCabinet = agg._sum.partCabinet || 0;
      rows.push({
        contractId: c.id, periodeDebut: c.dateDebut, periodeFin: c.dateFin,
        totalFactures: agg._sum.montantTotal || 0, totalPartEmployes: agg._sum.partEmploye || 0,
        totalPayeEmployes: agg._sum.montantPayeEmploye || 0, totalPartCabinet: partCabinet,
        totalAvances: c.montantAvance || 0, soldeAPayer: Math.max(0, partCabinet - (c.montantAvance || 0)),
        creditAReporter: Math.max(0, (c.montantAvance || 0) - partCabinet), statut: "ouverte",
        observations: "Période ouverte — données de démonstration",
      });
    }
    await put("insurancePeriodClosure", rows);
  }
}

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
    try { await run(db, tag); } finally { await db.$disconnect(); }
  }
  await pub.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
