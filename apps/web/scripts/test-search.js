// Test rapide de /api/search avec une session forgée.
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
  const user = await prisma.user.findFirst({ where: { role: { estAdmin: true } }, include: { role: true } });

  const { sealData } = require("iron-session");
  const sealed = await sealData(
    { userId: user.id, email: user.email, tenantId: tenant.id, role: user.role?.nom || "", mfaVerified: true },
    { password: env.SESSION_PASSWORD, ttl: 60 * 30 }
  );

  for (const q of ["diop", "REF", "paie", "tribunal", "422", "courrier"]) {
    const res = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(q)}&limit=5`, {
      headers: { cookie: `avocat_session=${sealed}` },
    });
    const data = await res.json();
    const counts = Object.entries(data)
      .filter(([, v]) => Array.isArray(v) && v.length > 0)
      .map(([k, v]) => `${k}:${v.length}`);
    console.log(`q="${q}" status=${res.status} → ${counts.join(", ") || "aucun résultat"}`);
    if (data.error) console.log("  ERROR:", data.error);
  }
  await prisma.$disconnect();
  await publicPrisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
