// Capture rapide du shell /cabinet pour vérification visuelle.
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";

function loadEnv() {
  const env = {};
  for (const f of [".env", ".env.local"]) {
    const p = path.join(__dirname, "..", f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[m[1]] = v;
    }
  }
  return env;
}

(async () => {
  const env = loadEnv();
  const { PrismaClient: PublicPrisma } = require("../prisma/generated/public");
  const publicPrisma = new PublicPrisma({ datasources: { db: { url: env.DATABASE_URL } } });
  const tenant = await publicPrisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url: tenant.databaseUrl } } });
  const user = await prisma.user.findFirst({ where: { role: { estAdmin: true } }, include: { role: true } })
    || await prisma.user.findFirst({ include: { role: true } });

  const { sealData } = require("iron-session");
  const sealed = await sealData(
    { userId: user.id, email: user.email, tenantId: tenant.id, role: user.role?.nom || "", mfaVerified: true },
    { password: env.SESSION_PASSWORD, ttl: 60 * 30 }
  );

  const { chromium } = require("playwright");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "avocat_session", value: sealed, url: BASE_URL }]);
  const page = await ctx.newPage();

  for (const [name, url] of [
    ["shell-dashboard", "/cabinet"],
    ["shell-compta", "/cabinet/comptabilite/ecritures"],
  ]) {
    await page.goto(BASE_URL + url, { waitUntil: "networkidle", timeout: 90000 });
    await page.screenshot({ path: path.join(__dirname, `../../../docs/screenshots/${name}.png`) });
    console.log("saved", name);
  }

  // Capture d'un menu déroulant ouvert.
  await page.getByRole("button", { name: /Comptabilit/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, "../../../docs/screenshots/shell-dropdown.png") });
  console.log("saved shell-dropdown");

  await browser.close();
  await prisma.$disconnect();
  await publicPrisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
