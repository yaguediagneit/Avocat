/**
 * Pousse le schéma tenant.prisma vers tous les schémas des tenants
 * enregistrés dans la base publique (ou un seul via --tenant=<slug>).
 *
 * Usage : node scripts/push-tenant-schema.js [--tenant=<slug>]
 */
try {
  process.loadEnvFile(".env");
} catch {
  // Pas de fichier .env en production (variables injectées par le conteneur).
}
const { execSync } = require("child_process");
const { PrismaClient: PublicClient } = require("../prisma/generated/public");

const TENANT_ARG = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1];

(async () => {
  const pub = new PublicClient();
  let tenants = await pub.tenant.findMany();
  if (TENANT_ARG) tenants = tenants.filter((t) => t.slug === TENANT_ARG || t.id === TENANT_ARG);
  const base = process.env.DATABASE_URL;

  for (const t of tenants) {
    const url = t.databaseUrl || `${base}${base.includes("?") ? "&" : "?"}schema=${t.schemaName}`;
    console.log(`\n===== TENANT ${t.slug || t.id} (${t.schemaName}) =====`);
    try {
      execSync(
        `npx prisma db push --schema=./prisma/schema/tenant.prisma --accept-data-loss --skip-generate`,
        { env: { ...process.env, DATABASE_URL_TENANT_TEMPLATE: url }, stdio: "inherit" }
      );
      console.log(`  OK`);
    } catch (e) {
      console.error(`  ÉCHEC pour ${t.slug || t.id}`);
      process.exitCode = 1;
    }
  }
  await pub.$disconnect();
})();
