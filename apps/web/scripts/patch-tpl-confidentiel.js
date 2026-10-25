/* Ajoute les marqueurs [[CONFIDENTIEL]] autour de l'article RÉMUNÉRATION
   du modèle TPL_MANDAT_INTERMEDIATION_IMMO sur tous les tenants —
   seulement si les marqueurs sont absents. */
const { PrismaClient: TenantClient } = require("@prisma/client");
const { PrismaClient: PublicClient } = require("../prisma/generated/public");
const TENANT_ARG = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1];

const ARTICLE = `ARTICLE 3 — RÉMUNÉRATION
La rémunération du Cabinet est fixée à {{remuneration|Montant ou taux de rémunération}},
calculée sur la base de {{base_calcul|Base de calcul}}.
Les débours et formalités externes sont facturés en sus sur justificatifs.`;

const NOUVEAU = `[[CONFIDENTIEL]]
ARTICLE 3 — RÉMUNÉRATION
La rémunération du Cabinet est fixée à {{commission|Montant ou taux de rémunération}},
calculée sur la base des loyers encaissés ({{base_calcul|Base de calcul}}).
Les débours et formalités externes sont facturés en sus sur justificatifs.
[[/CONFIDENTIEL]]`;

(async () => {
  const pub = new PublicClient();
  let tenants = await pub.tenant.findMany();
  if (TENANT_ARG) tenants = tenants.filter((t) => t.slug === TENANT_ARG || t.id === TENANT_ARG);
  const base = process.env.DATABASE_URL;
  for (const t of tenants) {
    const url = t.databaseUrl || `${base}${base.includes("?") ? "&" : "?"}schema=${t.schemaName}`;
    const db = new TenantClient({ datasources: { db: { url } } });
    const m = await db.transactionModele.findUnique({ where: { code: "TPL_MANDAT_INTERMEDIATION_IMMO" } });
    if (!m) { console.log(`${t.schemaName}: modèle absent`); await db.$disconnect(); continue; }
    if (m.contenu.includes("[[CONFIDENTIEL]]")) { console.log(`${t.schemaName}: déjà marqué`); await db.$disconnect(); continue; }
    if (!m.contenu.includes(ARTICLE)) { console.log(`${t.schemaName}: article personnalisé — non touché`); await db.$disconnect(); continue; }
    await db.transactionModele.update({ where: { id: m.id }, data: { contenu: m.contenu.replace(ARTICLE, NOUVEAU) } });
    console.log(`${t.schemaName}: marqueurs CONFIDENTIEL insérés`);
    await db.$disconnect();
  }
  await pub.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
