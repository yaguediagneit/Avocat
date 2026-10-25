import { MeiliSearch } from "meilisearch";
import { prisma, publicPrisma } from "@/lib/prisma";

const host = (process.env.MEILISEARCH_HOST || "http://127.0.0.1:7700").replace(
  "//localhost:",
  "//127.0.0.1:"
);
const apiKey = process.env.MEILISEARCH_API_KEY;

async function run() {
  const tenant = await publicPrisma.tenant.findFirst({ where: { actif: true } });
  if (!tenant) {
    throw new Error("Aucun tenant actif trouvé");
  }
  process.env.DEFAULT_TENANT_ID = tenant.id;

  console.log("Meilisearch host:", host);
  const client = new MeiliSearch({ host, apiKey });
  const index = client.index("search");

  await index.updateSettings({
    searchableAttributes: ["title", "subtitle", "type"],
    filterableAttributes: ["type", "dossierId"],
    sortableAttributes: [],
    typoTolerance: { enabled: true },
  });

  const [clients, dossiers, documents, taches, missionsHuissier, missionsArchitecte, missionsConseiller, missionsClerc, factures, charges] = await Promise.all([
    prisma.client.findMany({ select: { id: true, raisonSociale: true, type: true, identifiant: true } }),
    prisma.dossier.findMany({ include: { client: { select: { raisonSociale: true } } } }),
    prisma.document.findMany({ include: { dossier: { select: { referenceInterne: true } } } }),
    prisma.tache.findMany({ include: { dossier: { select: { referenceInterne: true } } } }),
    prisma.missionHuissier.findMany({ include: { dossier: { select: { referenceInterne: true } } } }),
    prisma.missionArchitecte.findMany({ include: { dossier: { select: { referenceInterne: true } } } }),
    prisma.missionConseillerJuridique.findMany({ include: { dossier: { select: { referenceInterne: true } } } }),
    prisma.missionClerc.findMany({ include: { dossier: { select: { referenceInterne: true } } } }),
    prisma.facture.findMany({ include: { client: { select: { raisonSociale: true } }, dossier: { select: { referenceInterne: true } } } }),
    prisma.charge.findMany({ include: { category: { select: { label: true } } } }),
  ]);

  const docs: any[] = [];

  clients.forEach((c) =>
    docs.push({
      id: `client-${c.id}`,
      type: "clients",
      title: c.raisonSociale,
      subtitle: c.identifiant || c.type,
      href: `/cabinet/clients/${c.id}`,
    })
  );

  dossiers.forEach((d) =>
    docs.push({
      id: `dossier-${d.id}`,
      type: "dossiers",
      title: d.referenceInterne,
      subtitle: `${d.client.raisonSociale} — ${d.typeAffaire}`,
      href: `/cabinet/dossiers/${d.id}`,
      dossierId: d.id,
    })
  );

  documents.forEach((d) =>
    docs.push({
      id: `document-${d.id}`,
      type: "documents",
      title: d.nom,
      subtitle: `${d.dossier.referenceInterne} — ${d.categorie}`,
      href: `/cabinet/documents/${d.id}`,
      dossierId: d.dossierId,
    })
  );

  taches.forEach((t) =>
    docs.push({
      id: `tache-${t.id}`,
      type: "taches",
      title: t.titre,
      subtitle: `${t.dossier.referenceInterne} — ${t.statut}`,
      href: `/cabinet/taches/${t.id}/modifier`,
      dossierId: t.dossierId,
    })
  );

  const pushMission = (m: any, profession: string) =>
    docs.push({
      id: `mission-${m.id}`,
      type: "missions",
      title: m.typeActe,
      subtitle: `${m.dossier.referenceInterne} — ${profession} — ${m.statut}`,
      href: `/cabinet/missions`,
      dossierId: m.dossierId,
    });

  missionsHuissier.forEach((m) => pushMission(m, "Huissier"));
  missionsArchitecte.forEach((m) => pushMission(m, "Architecte"));
  missionsConseiller.forEach((m) => pushMission(m, "Conseiller juridique"));
  missionsClerc.forEach((m) => pushMission(m, "Clerc"));

  factures.forEach((f) =>
    docs.push({
      id: `facture-${f.id}`,
      type: "factures",
      title: f.numero,
      subtitle: `${f.client.raisonSociale} — ${f.statut}`,
      href: `/cabinet/factures/${f.id}`,
      dossierId: f.dossierId,
    })
  );

  charges.forEach((c) =>
    docs.push({
      id: `charge-${c.id}`,
      type: "charges",
      title: c.description || c.category?.label || "Charge",
      subtitle: `${c.supplierName || "—"} — ${(c.totalHt ?? 0) + (c.taxAmount ?? 0) || c.amount} €`,
      href: `/cabinet/charges/${c.id}`,
    })
  );

  const batchSize = 1000;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const { taskUid } = await index.addDocuments(batch, { primaryKey: "id" });
    console.log(`Indexed batch ${i / batchSize + 1}/${Math.ceil(docs.length / batchSize)} (task ${taskUid})`);
  }

  console.log(`Indexed ${docs.length} documents in Meilisearch.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
