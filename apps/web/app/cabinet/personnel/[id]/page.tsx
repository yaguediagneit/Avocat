import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PayerButton } from "./payer-button";
import { PaginatedRows } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { sort?: string; dir?: string };
}) {
  const sort = getSortSpec(searchParams);
  const thProps = { path: `/cabinet/personnel/${params.id}`, params: searchParams };
  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      payrolls: { orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }] },
      contracts: { orderBy: { createdAt: "desc" } },
      histories: { orderBy: { changedAt: "desc" } },
    },
  });
  if (!employee) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {employee.firstName} {employee.lastName}
        </h1>
        <Link href="/cabinet/personnel" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>

      <div className="card grid gap-4 text-sm md:grid-cols-2">
        <div><span className="text-gray-500">Code</span><p>{employee.employeeCode}</p></div>
        <div><span className="text-gray-500">Poste</span><p>{employee.position || "—"}</p></div>
        <div><span className="text-gray-500">Service</span><p>{employee.department || "—"}</p></div>
        <div><span className="text-gray-500">Régime</span><p>{employee.regime === "cadre" ? "Cadre" : "Régime général"}</p></div>
        <div><span className="text-gray-500">Contrat</span><p>{employee.contractType}</p></div>
        <div><span className="text-gray-500">Embauche</span><p>{new Date(employee.hireDate).toLocaleString("fr-FR")}</p></div>
        <div><span className="text-gray-500">Salaire de base</span><p>{Number(employee.baseSalary).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA</p></div>
        <div><span className="text-gray-500">CNSS</span><p>{employee.cnssNumber || "—"}</p></div>
        <div><span className="text-gray-500">IPRES</span><p>{employee.ipresNumber || "—"}</p></div>
        <div><span className="text-gray-500">Parts fiscales</span><p>{employee.taxShares}</p></div>
      </div>

      {employee.histories && employee.histories.length > 0 && (
        <section className="card space-y-4">
          <h2 className="text-lg font-semibold">Historique des changements</h2>
          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <SortableTh {...thProps} column="h_date" label="Date" className="px-3 py-2" />
                  <SortableTh {...thProps} column="h_champ" label="Champ" className="px-3 py-2" />
                  <SortableTh {...thProps} column="h_old" label="Ancienne valeur" className="px-3 py-2" />
                  <SortableTh {...thProps} column="h_new" label="Nouvelle valeur" className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <PaginatedRows colSpan={4}>
                {sortRows(employee.histories, sort, {
                  h_date: (h) => h.changedAt,
                  h_champ: (h) => h.field,
                  h_old: (h) => h.oldValue,
                  h_new: (h) => h.newValue,
                }).map((h) => (
                  <tr key={h.id} className="border-b">
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {new Date(h.changedAt).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2">
                      {h.field === "position" ? "Poste" : h.field === "regime" ? "Régime" : h.field}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{h.oldValue || "—"}</td>
                    <td className="px-3 py-2 font-medium">{h.newValue || "—"}</td>
                  </tr>
                ))}
                </PaginatedRows>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Bulletins de paie</h2>
        <table className="w-full text-left text-sm">
          <thead className="bg-cabinet-100 text-cabinet-900">
            <tr>
              <SortableTh {...thProps} column="p_periode" label="Période" className="px-4 py-3" />
              <SortableTh {...thProps} column="p_brut" label="Brut" className="px-4 py-3" />
              <SortableTh {...thProps} column="p_net" label="Net" className="px-4 py-3" />
              <SortableTh {...thProps} column="p_statut" label="Statut" className="px-4 py-3" />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {employee.payrolls.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">Aucun bulletin.</td>
              </tr>
            )}
            <PaginatedRows colSpan={5}>
            {sortRows(employee.payrolls, sort, {
              p_periode: (p) => p.periodYear * 100 + p.periodMonth,
              p_brut: (p) => Number(p.grossSalary),
              p_net: (p) => Number(p.netSalary),
              p_statut: (p) => p.status,
            }).map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">{p.periodMonth}/{p.periodYear}</td>
                <td className="px-4 py-3">{Number(p.grossSalary).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA</td>
                <td className="px-4 py-3">{Number(p.netSalary).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA</td>
                <td className="px-4 py-3">{p.status}</td>
                <td className="px-4 py-3">{p.status !== "paid" && <PayerButton payrollId={p.id} />}</td>
              </tr>
            ))}
            </PaginatedRows>
          </tbody>
        </table>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Contrats de travail</h2>
        <table className="w-full text-left text-sm">
          <thead className="bg-cabinet-100 text-cabinet-900">
            <tr>
              <SortableTh {...thProps} column="c_type" label="Type" className="px-4 py-3" />
              <SortableTh {...thProps} column="c_periode" label="Période" className="px-4 py-3" />
              <SortableTh {...thProps} column="c_fonction" label="Fonction" className="px-4 py-3" />
              <SortableTh {...thProps} column="c_statut" label="Statut" className="px-4 py-3" />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {employee.contracts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">Aucun contrat.</td>
              </tr>
            )}
            <PaginatedRows colSpan={5}>
            {sortRows(employee.contracts, sort, {
              c_type: (c) => c.typeContrat,
              c_periode: (c) => c.dateDebut,
              c_fonction: (c) => c.fonction,
              c_statut: (c) => c.statut,
            }).map((c) => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">{c.typeContrat}</td>
                <td className="px-4 py-3">{c.dateDebut.toLocaleDateString("fr-FR")} {c.dateFin ? `→ ${c.dateFin.toLocaleDateString("fr-FR")}` : ""}</td>
                <td className="px-4 py-3">{c.fonction || "—"}</td>
                <td className="px-4 py-3 capitalize">{c.statut}</td>
                <td className="px-4 py-3">
                  {c.documentPath ? (
                    <a href={`/api/personnel/contracts/${c.id}/download`} target="_blank" className="text-cabinet-700 hover:underline">Télécharger</a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            </PaginatedRows>
          </tbody>
        </table>
      </section>
    </div>
  );
}
