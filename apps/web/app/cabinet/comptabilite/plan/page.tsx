import Link from "next/link";
import { getTenantPrisma } from "@/lib/prisma";
import { tableSearchWhere, numericClauses } from "@/lib/search";
import { PaginatedRows } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

const CLASSES = [
  { value: "", label: "Toutes les classes" },
  { value: "1", label: "1 - Comptes de ressources durables" },
  { value: "2", label: "2 - Comptes d'actif immobilisé" },
  { value: "3", label: "3 - Comptes de stocks" },
  { value: "4", label: "4 - Comptes de tiers" },
  { value: "5", label: "5 - Comptes de trésorerie" },
  { value: "6", label: "6 - Comptes de charges" },
  { value: "7", label: "7 - Comptes de produits" },
  { value: "8", label: "8 - Comptes de résultats" },
];

export default async function PlanComptablePage({
  searchParams,
}: {
  searchParams: { classe?: string; q?: string; sort?: string; dir?: string };
}) {
  const prisma = await getTenantPrisma(process.env.DEFAULT_TENANT_ID!);

  const classe = searchParams.classe ? Number(searchParams.classe) : undefined;
  const q = searchParams.q?.trim() || "";
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/cabinet/comptabilite/plan", params: searchParams };

  const accounts = await prisma.accountingAccount.findMany({
    where: {
      ...(classe !== undefined ? { class: classe } : {}),
      ...tableSearchWhere(
        q,
        ["accountCode", "label", "accountType"],
        (t) => numericClauses(t, ["class", "level"])
      ),
    },
    orderBy: [{ class: "asc" }, { accountCode: "asc" }],
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plan comptable Syscohada</h1>
        <Link href="/cabinet/comptabilite" className="text-sm text-cabinet-700 hover:underline">
          ← Retour comptabilité
        </Link>
      </div>

      <form className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium">Recherche</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Code ou libellé"
            className="input w-full"
          />
        </div>
        <div className="w-full md:w-72">
          <label className="mb-1 block text-sm font-medium">Classe</label>
          <select name="classe" defaultValue={searchParams.classe ?? ""} className="input w-full">
            {CLASSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Filtrer
        </button>
        <Link href="/cabinet/comptabilite/plan" className="text-sm text-cabinet-700 hover:underline">
          Réinitialiser
        </Link>
      </form>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-cabinet-100 text-cabinet-900">
            <tr>
              <SortableTh {...thProps} column="compte" label="Compte" className="px-4 py-3" />
              <SortableTh {...thProps} column="libelle" label="Libellé" className="px-4 py-3" />
              <SortableTh {...thProps} column="classe" label="Classe" className="px-4 py-3" />
              <SortableTh {...thProps} column="type" label="Type" className="px-4 py-3" />
              <SortableTh {...thProps} column="niveau" label="Niveau" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                  Aucun compte trouvé.
                </td>
              </tr>
            )}
            <PaginatedRows colSpan={5}>
            {sortRows(accounts, sort, {
              compte: (a) => a.accountCode,
              libelle: (a) => a.label,
              classe: (a) => a.class,
              type: (a) => a.accountType,
              niveau: (a) => a.level,
            }).map((a) => (
              <tr key={a.id} className="border-b hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 font-mono font-medium">{a.accountCode}</td>
                <td className="px-4 py-3">{a.label}</td>
                <td className="px-4 py-3">{a.class}</td>
                <td className="px-4 py-3">{a.accountType}</td>
                <td className="px-4 py-3">{a.level}</td>
              </tr>
            ))}
            </PaginatedRows>
          </tbody>
        </table>
      </div>
    </div>
  );
}
