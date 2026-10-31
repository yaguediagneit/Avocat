import Link from "next/link";
import { getTenantPrisma } from "@/lib/prisma";
import { ProvisionForm } from "./provision-form";

export default async function ProvisionsPage() {
  const prisma = await getTenantPrisma(process.env.DEFAULT_TENANT_ID!);
  const tenantId = process.env.DEFAULT_TENANT_ID!;

  const [clients, entries] = await Promise.all([
    prisma.client.findMany({ select: { id: true, raisonSociale: true }, orderBy: { raisonSociale: "asc" }, take: 500 }),
    prisma.accountingEntry.findMany({
      where: { tenantId, reference: { startsWith: "PROV-" } },
      include: { lines: { include: { account: true } } },
      orderBy: { entryDate: "desc" },
      take: 100,
    }),
  ]);

  // Solde restant par client : lignes 419* portant le tiers, toutes écritures validées
  const balances = new Map<string, number>();
  for (const e of entries) {
    if (!e.isValidated) continue;
    for (const l of e.lines) {
      if (!l.account.accountCode.startsWith("419") || l.thirdPartyType !== "client" || !l.thirdPartyId) continue;
      balances.set(l.thirdPartyId, (balances.get(l.thirdPartyId) ?? 0) + (Number(l.credit) - Number(l.debit)));
    }
  }
  const clientName = (id: string) => clients.find((c) => c.id === id)?.raisonSociale ?? id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Provisions clients (419)</h1>
        <Link href="/cabinet/comptabilite" className="text-sm text-cabinet-700 hover:underline">← Retour</Link>
      </div>

      <ProvisionForm clients={clients.map((c) => ({ id: c.id, label: c.raisonSociale }))} />

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-cabinet-100 text-cabinet-900">
            <tr>
              <th className="px-4 py-2 text-xs">Date</th>
              <th className="px-4 py-2 text-xs">Réf.</th>
              <th className="px-4 py-2 text-xs">Libellé</th>
              <th className="px-4 py-2 text-xs">Client</th>
              <th className="px-4 py-2 text-xs text-right">Montant</th>
              <th className="px-4 py-2 text-xs text-right">Reste client</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Aucune provision enregistrée.</td></tr>
            )}
            {entries.map((e) => {
              const l419 = e.lines.find((l) => l.account.accountCode.startsWith("419"));
              const clientId = l419?.thirdPartyId;
              return (
                <tr key={e.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{new Date(e.entryDate).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">{e.reference ?? "—"}</td>
                  <td className="px-4 py-3">{e.libelle}</td>
                  <td className="px-4 py-3">{clientId ? clientName(clientId) : "—"}</td>
                  <td className="px-4 py-3 text-right">{Number(e.totalDebit).toLocaleString("fr-FR")}</td>
                  <td className="px-4 py-3 text-right">{clientId ? (balances.get(clientId) ?? 0).toLocaleString("fr-FR") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
