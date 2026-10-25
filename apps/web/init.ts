import { execSync } from "child_process";
import { existsSync, readFileSync, appendFileSync } from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env");

function loadEnv() {
  if (!existsSync(envPath)) {
    return;
  }
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireEnv(keys: string[]) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Variables manquantes dans .env : ${missing.join(", ")}`);
  }
}

function run(cmd: string, extraEnv?: Record<string, string>) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
    cwd: process.cwd(),
  });
}

function updateEnvWithTenant(tenantId: string) {
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  if (/^DEFAULT_TENANT_ID=/m.test(content)) return;
  appendFileSync(envPath, `\nDEFAULT_TENANT_ID=${tenantId}\n`);
}

async function main() {
  loadEnv();
  requireEnv(["DATABASE_URL", "SESSION_PASSWORD"]);

  if ((process.env.SESSION_PASSWORD as string).length < 32) {
    throw new Error("SESSION_PASSWORD doit faire au moins 32 caractères");
  }

  console.log("Génération et synchronisation du schéma public...");
  run("npx prisma generate --schema=./prisma/schema/public.prisma");
  run("npx prisma db push --schema=./prisma/schema/public.prisma --accept-data-loss --skip-generate");

  console.log("Génération du client tenant...");
  run("npx prisma generate --schema=./prisma/schema/tenant.prisma");

  console.log("Création du premier cabinet...");
  const { createTenant } = await import("./lib/tenant-manager");
  const tenant = await createTenant({
    slug: "default",
    raisonSociale: "Cabinet Défaut",
  });

  console.log(`\nCabinet créé : ${tenant.id} (${tenant.slug})`);

  updateEnvWithTenant(tenant.id);
  process.env.DEFAULT_TENANT_ID = tenant.id;

  console.log("Injection des rôles et comptes de test...");
  run("npx tsx seed.ts");

  console.log("\n✓ Initialisation terminée");
  console.log(`DEFAULT_TENANT_ID=${tenant.id}`);
  console.log("Comptes de test :");
  console.log("  admin@cabinet.sn / Admin1234!");
  console.log("  avocat@cabinet.sn / Avocat1234!");
  console.log("\nLancez l'application avec : npm run dev");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
