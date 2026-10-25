process.loadEnvFile(".env");
const { PrismaClient: TenantClient } = require("@prisma/client");
const { PrismaClient: PublicClient } = require("../prisma/generated/public");
const { TEMPLATES } = require("./tache-doc-templates");

const DRY_RUN = process.argv.includes("--dry-run");

(async () => {
  const pub = new PublicClient();
  const tenants = await pub.tenant.findMany();
  const base = process.env.DATABASE_URL;
  let updated = 0, skipped = 0;
  const unmatched = [];

  for (const t of tenants) {
    const url = t.databaseUrl || `${base}${base.includes("?") ? "&" : "?"}schema=${t.schemaName}`;
    const db = new TenantClient({ datasources: { db: { url } } });
    console.log(`\n===== TENANT ${t.slug || t.id} (${t.schemaName}) =====`);

    const specs = await db.specialite.findMany({ include: { tacheTemplates: true } });
    for (const s of specs) {
      const map = TEMPLATES[s.code];
      if (!map) continue;
      for (const tt of s.tacheTemplates) {
        const contenu = map[tt.titre];
        if (!contenu) {
          unmatched.push(`${s.code} :: ${tt.titre}`);
          continue;
        }
        if (DRY_RUN) {
          console.log(`  [dry] ${s.code} :: ${tt.titre} -> ${contenu.length} chars`);
          skipped++;
          continue;
        }
        await db.tacheTemplate.update({
          where: { id: tt.id },
          data: { contenuDocument: contenu },
        });
        console.log(`  ok  ${s.code} :: ${tt.titre}`);
        updated++;
      }
    }
    await db.$disconnect();
  }

  console.log(`\n${DRY_RUN ? "[dry-run] " : ""}${updated} modèles injectés, ${skipped} simulés, ${unmatched.length} sans correspondance.`);
  if (unmatched.length) {
    console.log("Tâches sans modèle défini :");
    unmatched.forEach((u) => console.log("  - " + u));
  }
  await pub.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
