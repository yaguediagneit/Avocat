import Link from "next/link";
import { getTenantPrisma } from "@/lib/prisma";
import { listTiers, tiersMapOf } from "@/lib/tiers";
import { PaginatedRows } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

export default async function EcrituresPage({
  searchParams,
}: {
  searchParams: { sort?: string; dir?: string };
}) {
  const prisma = await getTenantPrisma(process.env.DEFAULT_TENANT_ID!);
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/cabinet/comptabilite/ecritures", params: searchParams };
  const tenantId = process.env.DEFAULT_TENANT_ID!;
  const [entries, tiers] = await Promise.all([
    prisma.accountingEntry.findMany({
      where: { tenantId },
      include: { journal: true, lines: { include: { account: true } } },
      orderBy: { entryDate: "desc" },
      take: 100,
    }),
    listTiers(prisma),
  ]);
  const tiersMap = tiersMapOf(tiers);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Écritures comptables</h1>
        <div className="flex items-center gap-3">
          <Link href="/cabinet/comptabilite" className="text-sm text-cabinet-700 hover:underline">
            ← Retour
          </Link>
          <Link href="/cabinet/comptabilite/ecritures/nouvelle" className="btn-primary">
            + Nouvelle écriture
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="date" label="Date" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="journal" label="Journal" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="ref" label="Réf." className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="libelle" label="Libellé" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="tiers" label="Tiers" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="debit" label="Débit" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="credit" label="Crédit" className="px-2 py-3 text-xs whitespace-nowrap" />
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-gray-500">
                    Aucune écriture pour le moment.
                  </td>
                </tr>
              )}
              <PaginatedRows colSpan={7}>
              {sortRows(entries, sort, {
                date: (e) => e.entryDate,
                journal: (e) => e.journal.code,
                ref: (e) => e.reference,
                libelle: (e) => e.libelle,
                tiers: (e) =>
                  e.lines
                    .filter((l) => l.thirdPartyType && l.thirdPartyId)
                    .map((l) => tiersMap.get(`${l.thirdPartyType}:${l.thirdPartyId}`) ?? "")
                    .join(", ") ||
                  e.lines.filter((l) => Number(l.account?.class) === 4).map((l) => l.account!.label).join(", "),
                debit: (e) => Number(e.totalDebit),
                credit: (e) => Number(e.totalCredit),
              }).map((e) => {
              const tiersLabels = Array.from(
                new Set(
                  e.lines
                    .filter((l) => l.thirdPartyType && l.thirdPartyId)
                    .map((l) => tiersMap.get(`${l.thirdPartyType}:${l.thirdPartyId}`) ?? l.thirdPartyId!)
                )
              );
              // Sans tiers explicite, on affiche le propriétaire du compte
              // (libellé des comptes de tiers — classe 4).
              const ownerLabels = tiersLabels.length
                ? []
                : Array.from(
                    new Set(
                      e.lines
                        .filter((l) => Number(l.account?.class) === 4)
                        .map((l) => l.account!.label)
                    )
                  );
              return (
                <tr key={e.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{new Date(e.entryDate).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">{e.journal.code}</td>
                  <td className="px-4 py-3">{e.reference || "—"}</td>
                  <td className="px-4 py-3">{e.libelle}</td>
                  <td className="px-4 py-3">
                    {tiersLabels.join(", ") || ownerLabels.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">{Number(e.totalDebit).toLocaleString("fr-FR")}</td>
                  <td className="px-4 py-3">{Number(e.totalCredit).toLocaleString("fr-FR")}</td>
                </tr>
              );
            })}
              </PaginatedRows>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
