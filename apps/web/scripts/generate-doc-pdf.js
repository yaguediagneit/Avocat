/* eslint-disable no-console */
// Génère docs/documentation-application.pdf : documentation descriptive de
// l'application avec captures d'écran de chaque fonctionnalité.
// Usage : node scripts/generate-doc-pdf.js   (depuis apps/web, serveur dev actif sur :3000)

const fs = require("fs");
const path = require("path");

const WEB_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..", "..");
const DOCS_DIR = path.join(REPO_ROOT, "docs");
const SHOTS_DIR = path.join(DOCS_DIR, "screenshots");
const OUT_PDF = path.join(DOCS_DIR, "documentation-application.pdf");
const BASE_URL = process.env.DOC_BASE_URL || "http://localhost:3000";

// ---------------------------------------------------------------- .env
function loadEnv() {
  const envPath = path.join(WEB_ROOT, ".env");
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

function buildTenantDatabaseUrl(baseUrl, schemaName) {
  const qIndex = baseUrl.indexOf("?");
  if (qIndex === -1) return `${baseUrl}?schema=${encodeURIComponent(schemaName)}`;
  const base = baseUrl.slice(0, qIndex);
  const params = baseUrl.slice(qIndex + 1).split("&").filter((p) => !p.toLowerCase().startsWith("schema="));
  return `${base}?${params.length ? params.join("&") + "&" : ""}schema=${encodeURIComponent(schemaName)}`;
}

// ---------------------------------------------------------------- données
async function resolveContext(env) {
  const { PrismaClient: PublicClient } = require(path.join(WEB_ROOT, "prisma", "generated", "public"));
  const { PrismaClient: TenantClient } = require("@prisma/client");
  const pub = new PublicClient({ datasources: { db: { url: env.DATABASE_URL } } });
  const tenant = env.DEFAULT_TENANT_ID
    ? await pub.tenant.findFirst({ where: { id: env.DEFAULT_TENANT_ID, actif: true } })
    : await pub.tenant.findFirst({ where: { actif: true } });
  if (!tenant) throw new Error("Aucun tenant actif trouvé");
  const url = tenant.databaseUrl || buildTenantDatabaseUrl(env.DATABASE_URL, tenant.schemaName);
  const prisma = new TenantClient({ datasources: { db: { url } } });
  const user =
    (await prisma.user.findFirst({ where: { role: { estAdmin: true } }, include: { role: true }, orderBy: { createdAt: "asc" } })) ||
    (await prisma.user.findFirst({ include: { role: true }, orderBy: { createdAt: "asc" } }));
  if (!user) throw new Error("Aucun utilisateur dans le schéma tenant");
  const [dossier, client, facture, document, employee] = await Promise.all([
    prisma.dossier.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.client.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.facture.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.document.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.employee.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);
  const out = { tenant, prisma, user, ids: { dossier, client, facture, document, employee } };
  return out;
}

// ---------------------------------------------------------------- pages
function pageList(ids) {
  const P = [];
  const add = (slug, url, title, desc, features) => P.push({ slug, url, title, desc, features });

  add("landing", "/", "Page publique du cabinet", 
    "La landing page publique présente le cabinet aux visiteurs : carousel d'images animé, domaines d'intervention, valeurs, témoignages, slogan et coordonnées. Son contenu est entièrement personnalisable depuis le Paramétrage (textes, images, couleurs, styles PDF).",
    ["Carousel héro configurable (jusqu'à 10 images réordonnables)", "Sections valeurs, domaines d'intervention et témoignages", "Thème couleurs et typographie piloté par le paramétrage"]);

  add("dashboard", "/cabinet", "Tableau de bord",
    "Vue d'ensemble de l'activité du cabinet : compteurs animés (dossiers actifs, clients, événements, tâches), listes des dossiers et clients récents, tâches et événements à venir, ainsi que les files d'attente métier (lettres à signer, congés et contrats à approuver, assurances à payer). Chaque section est paginée par 5.",
    ["Compteurs animés cliquables vers les modules", "Dossiers, clients, tâches et événements récents", "Actions en attente : signatures, approbations, paiements"]);

  add("dossiers", "/cabinet/dossiers", "Dossiers",
    "Gestion complète des dossiers du cabinet : référence interne, type d'affaire, nature de la mission, parties adverses, statut et intervenants. La liste est filtrable, paginée par 5 et donne accès à la fiche détaillée de chaque dossier.",
    ["Recherche et filtres sur les dossiers", "Pagination par 5 dossiers", "Création via « Nouveau dossier »"]);
  if (ids.dossier) {
    add("dossier-detail", `/cabinet/dossiers/${ids.dossier.id}`, "Fiche dossier",
      "La fiche dossier centralise tout le dossier : onglets Documents, Tâches, Missions et Événements ; parties adverses ; documents attendus de la spécialité (reçu/manquant) ; conflits d'intérêts ; fil de discussion ; matrice RACI des intervenants et checklist de clôture.",
      ["Onglets Documents / Tâches / Missions / Événements paginés", "Suivi des pièces attendues de la spécialité", "Matrice RACI et fil de discussion", "Checklist de clôture"]);
  }
  add("dossier-nouveau", "/cabinet/dossiers/nouveau", "Nouveau dossier",
    "Formulaire de création de dossier : sélection du client (avec création assistée en modale), type d'affaire issu des spécialités, natures de mission à cocher, parties adverses, intervenants et tâches attendues par intervenant.",
    ["Client existant ou création rapide en modale", "Type d'affaire lié aux spécialités du cabinet", "Affectation des tâches attendues aux intervenants"]);

  add("clients", "/cabinet/clients", "Clients",
    "Répertoire des clients (particuliers et personnes morales) avec fiche détaillée : identité, représentants, contacts et dossiers liés. Liste paginée par 5 avec recherche.",
    ["Recherche sur raison sociale et contacts", "Pagination par 5 clients", "Fiche client avec représentants et dossiers"]);
  if (ids.client) {
    add("client-detail", `/cabinet/clients/${ids.client.id}`, "Fiche client",
      "La fiche client regroupe l'identité, les représentants et la liste des dossiers liés, avec accès direct à la création d'un nouveau dossier pré-rempli.",
      ["Représentants paginés", "Dossiers liés paginés par 5", "Création de dossier pré-remplie"]);
  }

  add("missions", "/cabinet/missions", "Missions",
    "Suivi des missions confiées par le cabinet : type d'acte, profession du prestataire, dates prévues et statut. Les missions sont aussi gérées dans Administration → Missions avec ordres de mission détaillés par métier.",
    ["Types d'actes et statuts", "Lien vers le dossier concerné", "Pagination par 5"]);
  add("missions-profession", "/cabinet/missions/profession/huissier", "Missions par profession",
    "Vue filtrée des missions par profession de prestataire (huissier, expert, avocat…). La liste des professions reprend les rôles définis dans le paramétrage.",
    ["Filtre par profession", "Ordres de mission par métier"]);

  add("taches", "/cabinet/taches", "Tâches",
    "Gestion des tâches du cabinet : titre, affectataire, échéance, priorité et statut. Les tâches générées depuis les modèles peuvent produire des documents PDF/Word.",
    ["Statuts et priorités", "Affectation et échéances", "Génération de documents depuis les modèles", "Pagination par 5"]);

  add("calendrier", "/cabinet/calendrier", "Calendrier",
    "Calendrier des événements : vues jour, semaine et mois. Les tâches avec échéance y apparaissent comme des événements. Audiences et réunions créées dans Administration alimentent automatiquement le calendrier.",
    ["Vues jour / semaine / mois", "Tâches et événements fusionnés", "Création d'événements"]);

  add("documents", "/cabinet/documents", "Documents",
    "Bibliothèque documentaire du cabinet : upload, catégories, publication client, partage externe aux intervenants, versions et circuit de validation. Liste paginée par 5.",
    ["Catégories et recherche", "Publication client et partage externe", "Versions et validation", "Pagination par 5"]);
  if (ids.document) {
    add("document-detail", `/cabinet/documents/${ids.document.id}`, "Fiche document",
      "Détail d'un document : aperçu, téléchargement, historique des versions (hash d'intégrité) et circuit de validation (relecture, validation, rejet).",
      ["Historique des versions paginé", "Circuit de validation horodaté", "Partage externe et client"]);
  }

  add("alertes", "/cabinet/alertes", "Alertes et notifications",
    "Centre d'alertes : tâches en retard ou à venir, prochains événements, factures en retard de paiement et notifications métier. Chaque section est paginée par 5.",
    ["Tâches en retard", "Événements proches", "Factures échues", "Notifications"]);

  add("factures", "/cabinet/factures", "Factures",
    "Facturation client : lignes de prestations, TVA, totaux HT/TTC, échéances et paiements partiels ou complets. Liste paginée par 5 avec statuts (Brouillon, Émise, Partiellement payée, Payée).",
    ["Lignes HT/TVA/TTC", "Suivi des paiements", "Statuts de facturation", "Pagination par 5"]);
  if (ids.facture) {
    add("facture-detail", `/cabinet/factures/${ids.facture.id}`, "Fiche facture",
      "Détail d'une facture : lignes détaillées, totaux, intervenants du dossier, paiements enregistrés et formulaire d'encaissement du restant dû.",
      ["Lignes paginées par 5", "Historique des paiements", "Encaissement du solde"]);
  }
  add("paiements-intervenants", "/cabinet/paiements-intervenants", "Paiements intervenants",
    "Paiements des prestataires externes (huissiers, experts…) : montants, lignes, statuts et bulletins imprimables.",
    ["Lignes de paiement détaillées", "Bulletins imprimables", "Pagination par 5"]);
  add("charges", "/cabinet/charges", "Charges et immobilisations",
    "Charges du cabinet par catégorie avec écriture comptable automatique (D 6xx / C 52-57, TVA 445). Les immobilisations amorties génèrent un plan de dotations mensuelles comptabilisées automatiquement.",
    ["Catégories paramétrables", "Immobilisations et dotations mensuelles", "Écritures comptables automatiques", "Pagination par 5"]);

  add("personnel", "/cabinet/personnel", "Personnel",
    "Gestion du personnel : employés, contrats, congés, assurances et paie. Le tableau des derniers bulletins affiche le brut, le net, l'IRPP du mois et le statut de paiement, paginé par 5.",
    ["Employés et bulletins paginés", "Génération groupée des bulletins (rattrapage possible)", "Liens congés / contrats / assurances"]);
  if (ids.employee) {
    add("personnel-detail", `/cabinet/personnel/${ids.employee.id}`, "Fiche employé",
      "Fiche employé : identité, historique des changements (poste, régime), bulletins de paie avec paiement unitaire et contrats de travail téléchargeables.",
      ["Historique des modifications paginé", "Bulletins et paiement", "Contrats téléchargeables"]);
  }
  add("conges", "/cabinet/personnel/conges", "Congés",
    "Demandes d'absences et congés : types paramétrables, workflow soumis → approuvé/rejeté, solde et périodes. Table paginée par 5.",
    ["Types de congés", "Approbation / rejet", "Pagination par 5"]);
  add("contrats", "/cabinet/personnel/contrats", "Contrats de travail",
    "Contrats de travail : types, périodes, fonctions, obligations de l'employeur et du salarié (paramétrables), documents téléchargeables et impression du contrat.",
    ["Types et statuts de contrat", "Obligations personnalisables", "Impression du contrat", "Pagination par 5"]);
  add("assurances", "/cabinet/personnel/assurances", "Assurances",
    "Assurance maladie du personnel : assureurs, contrats, employés assurés et ayants droit, prestataires, factures de soins avec workflow de validation et paiement, totaux par employé.",
    ["Assureurs et contrats", "Employés et ayants droit", "Factures de soins à approuver/payer", "Totaux par employé"]);
  add("paie-validation", "/cabinet/personnel/paie/validation", "Validation de la paie",
    "Écran de validation avant paiement : brut, net, IRPP du mois et coût employeur par employé, avec ligne de totaux. Les bulletins peuvent être générés pour un mois antérieur (rattrapage, avec avertissement).",
    ["Récapitulatif brut / net / IRPP / coût employeur", "Ligne de totaux", "Rattrapage de mois antérieurs"]);

  add("comptabilite", "/cabinet/comptabilite", "Comptabilité",
    "Module comptable SYSCOHADA : écritures, journaux, plan comptable, tiers, grand livre, bilan et compte de résultat. Le bouton « Versements sociaux et fiscaux » ouvre le récapitulatif IRPP / IPRES / CNSS / CSS imprimable à l'identité du cabinet.",
    ["Journaux et écritures validées", "Plan comptable et tiers", "Versements sociaux et fiscaux", "Factures d'assurance à approuver"]);
  add("ecritures", "/cabinet/comptabilite/ecritures", "Écritures comptables",
    "Journal des écritures : pièces générées automatiquement par la paie, les charges, les factures et les paiements. Équilibre débit/crédit contrôlé à la validation. Liste paginée par 5.",
    ["Écritures équilibrées SYSCOHADA", "Validation", "Pagination par 5"]);
  add("grand-livre", "/cabinet/comptabilite/grand-livre", "Grand livre",
    "Le grand livre reprend compte par compte les mouvements débit/crédit des écritures validées avec soldes progressifs.",
    ["Mouvements par compte", "Soldes cumulés", "Pagination par 5"]);
  add("journaux", "/cabinet/comptabilite/journaux", "Journaux",
    "Les journaux comptables (ventes, banque, caisse, opérations diverses…) regroupent les écritures par nature.",
    ["Journaux par nature", "Pagination par 5"]);
  add("plan", "/cabinet/comptabilite/plan", "Plan comptable",
    "Le plan de comptes SYSCOHADA : classes 1 à 7, comptes principaux et auxiliaires utilisés par les écritures automatiques.",
    ["Classes OHADA", "Comptes auxiliaires", "Pagination par 5"]);
  add("tiers", "/cabinet/comptabilite/tiers", "Tiers",
    "Les comptes de tiers (clients, fournisseurs, employés, État, organismes sociaux) avec leurs soldes.",
    ["Clients / fournisseurs / personnel", "Pagination par 5"]);
  add("bilan", "/cabinet/comptabilite/bilan", "Bilan",
    "Le bilan (actif / passif) photographié au dernier jour de la période, avec résultat net cumulé depuis le 1er janvier de l'exercice pour conserver l'équilibre.",
    ["Actif / Passif équilibré", "Résultat cumulé", "Impression"]);
  add("resultat", "/cabinet/comptabilite/resultat", "Compte de résultat",
    "Le compte de résultat de la période : produits et charges par nature, soldes intermédiaires de gestion et résultat net.",
    ["Produits / charges", "SIG", "Impression"]);
  add("rapport", "/cabinet/comptabilite/rapport", "Rapport financier",
    "Rapport financier complet imprimable : plan comptable, journaux, bilan, journal des écritures, compte de résultat, SIG et flux de trésorerie, avec filtre par mois ou période personnalisée et export PDF à l'identité du cabinet.",
    ["Filtre mois ou période personnalisée", "Sections complètes imprimées", "Export PDF thémé"]);

  add("admin-missions", "/cabinet/administration/missions", "Administration — Missions",
    "Gestion des ordres de mission aux prestataires : la profession reprend les rôles du paramétrage ; chaque métier dispose de son formulaire dédié (huissier, expert, avocat, architecte, CLEC…).",
    ["Profession = rôles utilisateurs", "Formulaire par métier", "Ordres de mission PDF", "Pagination par 5"]);
  add("admin-formalites", "/cabinet/administration/formalites", "Administration — Formalités",
    "Suivi des formalités auprès des tribunaux et administrations : type, échéance, statut et dossier concerné.",
    ["Types de formalités", "Échéances et statuts", "Pagination par 5"]);
  add("admin-pieces", "/cabinet/administration/pieces-manquantes", "Administration — Pièces manquantes",
    "Suivi des pièces manquantes et des relances : document attendu, client, dossier et statut de réception.",
    ["Relances", "Statut de réception", "Pagination par 5"]);
  add("admin-demandes", "/cabinet/administration/demandes", "Administration — Demandes et appels",
    "Registre des demandes clients et du journal des appels : sujet, demandeur, canal, réponse, plus les documents requis par type de dossier.",
    ["Registre des demandes", "Journal des appels", "Documents requis par spécialité"]);
  add("admin-courrier", "/cabinet/administration/courrier", "Administration — Courrier",
    "Gestion du courrier entrant et sortant et création de lettres : référence, structure, contact, signataire et impression de la lettre.",
    ["Courrier entrant / sortant", "Lettres à signer et impression", "Pagination par 5"]);
  add("admin-audiences", "/cabinet/administration/audiences", "Administration — Audiences",
    "Préparation des audiences et réunions : date, type, lieu, participants, dossier. La création alimente automatiquement le calendrier.",
    ["Audiences et réunions", "Synchronisation calendrier", "Pagination par 5"]);

  add("parametrage", "/cabinet/parametrage", "Paramétrage",
    "Le paramétrage centralise la configuration du cabinet en onglets : identité et landing page, spécialités, modèles de tâches et de documents, rôles et permissions, utilisateurs, paramètres métier, comptabilité et journal d'audit.",
    ["Onglets thématiques", "Styles PDF (couleurs, police, textes)", "Rôles et permissions RACI"]);

  add("profil", "/cabinet/profil", "Profil utilisateur",
    "Le profil permet de modifier ses informations, sa signature (upload) et de télécharger ses bulletins de paie signés.",
    ["Informations personnelles", "Signature", "Bulletins signés paginés"]);

  return P;
}

// ---------------------------------------------------------------- doc HTML
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(pages, images, meta) {
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const toc = pages.map((p, i) => `<tr><td class="toc-n">${i + 1}.</td><td>${esc(p.title)}</td></tr>`).join("");
  const sections = pages.map((p, i) => {
    const img = images[p.slug];
    const feats = (p.features || []).map((f) => `<li>${esc(f)}</li>`).join("");
    return `
      <section class="doc-section">
        <h2><span class="num">${i + 1}</span> ${esc(p.title)}</h2>
        <p class="desc">${esc(p.desc)}</p>
        ${feats ? `<ul class="feats">${feats}</ul>` : ""}
        ${img ? `<figure><img src="data:image/png;base64,${img}" alt="${esc(p.title)}"/><figcaption>Fig. ${i + 1} — ${esc(p.title)}</figcaption></figure>` : ""}
      </section>`;
  }).join("");

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page { size: A4; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #1e293b; margin: 0; font-size: 10.5pt; }
    .cover { height: 255mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
    .cover .brand { font-size: 30pt; font-weight: 700; color: #0f1b2e; }
    .cover .brand span { color: #b08d2e; }
    .cover h1 { font-size: 22pt; margin: 18px 0 6px; color: #0f1b2e; }
    .cover .sub { color: #64748b; font-size: 12pt; }
    .cover .meta { margin-top: 60px; color: #94a3b8; font-size: 10pt; line-height: 1.8; }
    .cover .rule { width: 90px; height: 4px; background: #b08d2e; margin-top: 24px; }
    .toc-page { page-break-after: always; }
    .toc-page h1 { font-size: 18pt; color: #0f1b2e; border-bottom: 2px solid #b08d2e; padding-bottom: 8px; }
    table.toc { width: 100%; border-collapse: collapse; }
    table.toc td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; font-size: 10pt; }
    td.toc-n { width: 30px; color: #b08d2e; font-weight: 600; }
    .doc-section { page-break-inside: avoid; margin-top: 22px; }
    .doc-section h2 { font-size: 14pt; color: #0f1b2e; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
    .doc-section h2 .num { color: #b08d2e; margin-right: 8px; }
    .desc { color: #334155; line-height: 1.55; margin: 8px 0; }
    ul.feats { margin: 6px 0 10px; padding-left: 18px; color: #475569; }
    ul.feats li { margin: 2px 0; }
    ul.feats li::marker { color: #b08d2e; }
    figure { margin: 10px 0 4px; text-align: center; }
    figure img { max-width: 100%; max-height: 640px; border: 1px solid #e2e8f0; border-radius: 6px; }
    figcaption { font-size: 8.5pt; color: #94a3b8; margin-top: 5px; font-style: italic; }
  </style></head><body>
    <div class="cover">
      <div class="brand">${esc(meta.cabinet || "Cabinet")}<span>.</span></div>
      <h1>Documentation de l'application</h1>
      <div class="sub">Plateforme de gestion de cabinet d'avocats — guide des fonctionnalités illustré</div>
      <div class="rule"></div>
      <div class="meta">
        Document généré le ${today}<br/>
        ${pages.length} sections documentées avec captures d'écran<br/>
        Version de démonstration — environnement local
      </div>
    </div>
    <div class="toc-page">
      <h1>Sommaire</h1>
      <table class="toc">${toc}</table>
    </div>
    ${sections}
  </body></html>`;
}

// ---------------------------------------------------------------- main
(async () => {
  const env = loadEnv();
  if (!env.SESSION_PASSWORD) throw new Error("SESSION_PASSWORD manquant dans .env");
  const { tenant, prisma, user, ids } = await resolveContext(env);
  console.log(`Tenant: ${tenant.raisonSociale || tenant.nom} | user: ${user.email}`);

  const { sealData } = require("iron-session");
  const sealed = await sealData(
    { userId: user.id, email: user.email, tenantId: tenant.id, role: user.role?.nom || "", mfaVerified: true },
    { password: env.SESSION_PASSWORD, ttl: 60 * 30 }
  );

  const { chromium } = require("playwright");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1.5 });
  await ctx.addCookies([{ name: "avocat_session", value: sealed, url: BASE_URL }]);
  const page = await ctx.newPage();

  // Capture bornée : haut du document jusqu'à ~1800px pour rester lisible en PDF
  async function shoot(file) {
    const h = await page.evaluate(() => Math.min(document.documentElement.scrollHeight, 1800));
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1440, height: Math.max(h, 500) } });
  }

  // Onglets du paramétrage à capturer individuellement
  const paramTabs = [
    { slug: "param-cabinet", label: "Cabinet & Présentation", title: "Paramétrage — Cabinet & Landing page", desc: "Identité du cabinet, logo, contacts et personnalisation complète de la page publique : images du carousel (réordonnables), textes héro, valeurs, témoignages et styles PDF (couleurs, police, textes d'en-tête et de pied de page).", features: ["Logo et identité", "Carousel réordonnable", "Styles PDF globaux"] },
    { slug: "param-users", label: "Utilisateurs", title: "Paramétrage — Utilisateurs", desc: "Gestion des comptes utilisateurs du cabinet : nom, titre, spécialité, email, rôle et activation. Les rôles proposés sont ceux définis dans l'onglet Rôles.", features: ["Création et modification", "Rôle et activation", "Pagination par 5"] },
    { slug: "param-roles", label: "Rôles", title: "Paramétrage — Rôles et permissions", desc: "Définition des rôles avec matrice de permissions par onglet et action (lecture, écriture, suppression). Les rôles non-admin déterminent aussi les professions proposées dans les missions.", features: ["Matrice de permissions", "Rôle administrateur ou client", "Professions de missions"] },
    { slug: "param-audit", label: "Audit", title: "Paramétrage — Journal d'audit", desc: "Journal d'audit des actions : utilisateur, action, entité et adresse IP, paginé par 5 avec export et réinitialisation.", features: ["Traçabilité complète", "Pagination serveur par 5"] },
  ];

  const pages = pageList(ids);
  const images = {};

  for (const p of pages) {
    const url = BASE_URL + p.url;
    process.stdout.write(`shot ${p.slug} ${url} ... `);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
      await page.waitForTimeout(600);
      const file = path.join(SHOTS_DIR, `${p.slug}.png`);
      await shoot(file);
      images[p.slug] = fs.readFileSync(file).toString("base64");
      console.log("ok");
    } catch (e) {
      console.log(`ÉCHEC (${e.message.split("\n")[0]})`);
    }
  }

  // Onglets paramétrage : clics successifs puis capture
  for (const t of paramTabs) {
    process.stdout.write(`shot ${t.slug} ... `);
    try {
      if (!page.url().includes("/cabinet/parametrage")) {
        await page.goto(`${BASE_URL}/cabinet/parametrage`, { waitUntil: "domcontentloaded", timeout: 30000 });
      }
      await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
      await page.click(`button[role="tab"]:has-text("${t.label}")`, { timeout: 8000 });
      await page.waitForTimeout(900);
      const file = path.join(SHOTS_DIR, `${t.slug}.png`);
      await shoot(file);
      images[t.slug] = fs.readFileSync(file).toString("base64");
      pages.splice(pages.findIndex((p) => p.slug === "profil"), 0, {
        slug: t.slug, url: "/cabinet/parametrage", title: t.title, desc: t.desc, features: t.features,
      });
      console.log("ok");
    } catch (e) {
      console.log(`ÉCHEC (${e.message.split("\n")[0]})`);
    }
  }

  // Sommaire : les entrées paramTabs insérées avant « profil »
  const meta = { cabinet: tenant.raisonSociale || tenant.nom || "Cabinet" };
  const html = buildHtml(pages, images, meta);
  fs.writeFileSync(path.join(DOCS_DIR, "documentation-application.html"), html, "utf8");

  await page.setContent(html, { waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.pdf({
    path: OUT_PDF,
    format: "A4",
    printBackground: true,
    margin: { top: "16mm", bottom: "14mm", left: "13mm", right: "13mm" },
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:7pt;color:#94a3b8;width:100%;text-align:center;">Documentation — ${esc(meta.cabinet)}</div>`,
    footerTemplate: `<div style="font-size:7pt;color:#94a3b8;width:100%;text-align:center;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
  });

  console.log(`\nPDF généré : ${OUT_PDF}`);
  await browser.close();
  await prisma.$disconnect();
})().catch((e) => {
  console.error("ERREUR:", e);
  process.exit(1);
});
