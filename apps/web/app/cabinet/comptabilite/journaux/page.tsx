import Link from "next/link";
import { getTenantPrisma } from "@/lib/prisma";
import { PaginatedRows } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

export default async function JournauxPage({
  searchParams,
}: {
  searchParams: { sort?: string; dir?: string };
}) {
  const prisma = await getTenantPrisma(process.env.DEFAULT_TENANT_ID!);
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/cabinet/comptabilite/journaux", params: searchParams };
  const journals = await prisma.accountingJournal.findMany({
    orderBy: { code: "asc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Journaux comptables</h1>
        <Link href="/cabinet/comptabilite" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-cabinet-100 text-cabinet-900">
            <tr>
              <SortableTh {...thProps} column="code" label="Code" className="px-4 py-3" />
              <SortableTh {...thProps} column="libelle" label="Libellé" className="px-4 py-3" />
              <SortableTh {...thProps} column="type" label="Type" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {journals.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                  Aucun journal.
                </td>
              </tr>
            )}
            <PaginatedRows colSpan={3}>
            {sortRows(journals, sort, {
              code: (j) => j.code,
              libelle: (j) => j.label,
              type: (j) => j.journalType,
            }).map((j) => (
              <tr key={j.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-medium">{j.code}</td>
                <td className="px-4 py-3">{j.label}</td>
                <td className="px-4 py-3">{j.journalType}</td>
              </tr>
            ))}
            </PaginatedRows>
          </tbody>
        </table>
      </div>
    </div>
  );
}
