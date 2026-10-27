try {
  process.loadEnvFile(".env");
} catch {
  // Pas de fichier .env en production (variables injectées par le conteneur).
}
const { PrismaClient: TenantClient } = require("@prisma/client");
const { PrismaClient: PublicClient } = require("../prisma/generated/public");

(async () => {
  const pub = new PublicClient();
  const tenants = await pub.tenant.findMany();
  const base = process.env.DATABASE_URL;
  for (const t of tenants) {
    const url = t.databaseUrl || `${base}${base.includes("?") ? "&" : "?"}schema=${t.schemaName}`;
    const db = new TenantClient({ datasources: { db: { url } } });
    console.log(`\n===== TENANT ${t.slug || t.id} (${t.schemaName}) =====`);
    const specs = await db.specialite.findMany({
      orderBy: { ordre: "asc" },
      include: {
        workflowEtapes: { orderBy: { ordre: "asc" } },
        tacheTemplates: {
          orderBy: { ordre: "asc" },
          include: { workflowEtape: true },
        },
        typesDocuments: { orderBy: { ordre: "asc" } },
      },
    });
    for (const s of specs) {
      console.log(`\n## ${s.code} — ${s.libelle} ${s.selectionnee ? "[selectionnee]" : ""} ${s.actif ? "" : "[inactif]"}`);
      if (s.description) console.log(`   desc: ${s.description}`);
      console.log("   Étapes workflow:");
      for (const w of s.workflowEtapes)
        console.log(`     - ${w.code} : ${w.libelle}${w.estInitial ? " (initiale)" : ""}${w.estFinal ? " (finale)" : ""}`);
      console.log("   Tâches (templates):");
      for (const tt of s.tacheTemplates)
        console.log(
          `     - [${tt.ordre}] ${tt.titre} | etape=${tt.workflowEtape?.code || "-"} | delai=${tt.delaiJours}j | role=${tt.roleAttendu} | prio=${tt.priorite} | doc=${tt.contenuDocument ? "OUI" : "non"}`
        );
      console.log("   Types de documents:");
      for (const d of s.typesDocuments)
        console.log(`     - ${d.code} : ${d.libelle}${d.obligatoire ? " (obligatoire)" : ""}`);
    }
    await db.$disconnect();
  }
  await pub.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
