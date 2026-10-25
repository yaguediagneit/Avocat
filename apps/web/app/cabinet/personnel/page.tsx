import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { tableSearchWhere, numericClauses, dateClauses } from "@/lib/search";
import { serverHasPermission, getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { RowActions } from "@/components/row-actions";
import { SearchInput } from "@/components/search-input";
import { PayrollRowActions } from "./payroll-row-actions";
import { PaginatedRows } from "@/components/pagination";
import { GeneratePayrollsButton } from "./generate-payrolls-button";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

export default async function PersonnelPage({
  searchParams,
}: {
  searchParams: { q?: string; m?: string; y?: string; sort?: string; dir?: string };
}) {
  // Isolation : réservé aux rôles ayant la permission comptabilite.
  if (!(await serverHasPermission("comptabilite", "read"))) {
    redirect("/cabinet");
  }

  const auth = await getServerAuth();
  const canWrite = hasPermission(auth.role, "comptabilite", "write");
  const q = (searchParams.q || "").trim();
  const now = new Date();
  const currentMonth = searchParams.m ? Number(searchParams.m) : now.getMonth() + 1;
  const currentYear = searchParams.y ? Number(searchParams.y) : now.getFullYear();

  const newerMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const newerYear = currentMonth === 12 ? currentYear + 1 : currentYear;
  const olderMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const olderYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const monthYearLabel = new Date(currentYear, currentMonth - 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const [employees, payrolls] = await Promise.all([
    prisma.employee.findMany({
      where: {
        isActive: true,
        ...tableSearchWhere(
          q,
          [
            "firstName",
            "lastName",
            "employeeCode",
            "position",
            "department",
            "contractType",
            "email",
            "phone",
            "cnssNumber",
            "ipresNumber",
          ],
          (t) => [
            ...numericClauses(t, ["baseSalary"]),
            ...dateClauses(t, ["hireDate", "contractEndDate"]),
          ]
        ),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.payroll.findMany({
      where: { periodMonth: currentMonth, periodYear: currentYear },
      include: { employee: true },
      orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
    }),
  ]);

  const draftCount = payrolls.filter((p: any) => p.status === "draft").length;
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/cabinet/personnel", params: searchParams };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestion du personnel</h1>
        <div className="no-scrollbar flex min-w-max items-end gap-1 overflow-x-auto rounded-t-xl border border-cabinet-200/80 bg-cabinet-100/50 px-3 pt-2">
          <Link
            href="/cabinet/personnel/nouveau"
            className="relative flex w-auto items-center justify-center whitespace-nowrap rounded-t-xl border border-b-transparent border-emerald-200/80 border-t-emerald-500 bg-emerald-100 px-3 py-2 text-center text-[10px] font-semibold text-emerald-900 shadow-[0_-6px_16px_-8px_rgba(15,27,46,0.25)] transition hover:bg-emerald-200"
          >
            + Ajouter un employé
          </Link>
          <Link
            href="/cabinet/personnel/contrats"
            className="relative flex w-auto items-center justify-center whitespace-nowrap rounded-t-xl border border-b-transparent border-yellow-200/80 border-t-yellow-500 bg-yellow-100 px-3 py-2 text-center text-[10px] font-semibold text-yellow-900 shadow-[0_-6px_16px_-8px_rgba(15,27,46,0.25)] transition hover:bg-yellow-200"
          >
            Contrats
          </Link>
          <Link
            href="/cabinet/personnel/nouvelle_paie"
            className="relative flex w-auto items-center justify-center whitespace-nowrap rounded-t-xl border border-b-transparent border-green-200/80 border-t-green-500 bg-green-100 px-3 py-2 text-center text-[10px] font-semibold text-green-900 shadow-[0_-6px_16px_-8px_rgba(15,27,46,0.25)] transition hover:bg-green-200"
          >
            + Ajouter Nouvelle Fiche Paie
          </Link>
          <Link
            href="#derniers-bulletins"
            className="relative flex w-auto items-center justify-center whitespace-nowrap rounded-t-xl border border-b-transparent border-gray-200/80 border-t-gray-500 bg-gray-100 px-3 py-2 text-center text-[10px] font-semibold text-gray-900 shadow-[0_-6px_16px_-8px_rgba(15,27,46,0.25)] transition hover:bg-gray-200"
          >
            Derniers bulletins
          </Link>
          {canWrite && <GeneratePayrollsButton />}
          <Link
            href="/cabinet/personnel/assurances"
            className="relative flex w-auto items-center justify-center whitespace-nowrap rounded-t-xl border border-b-transparent border-blue-200/80 border-t-blue-500 bg-blue-100 px-3 py-2 text-center text-[10px] font-semibold text-blue-900 shadow-[0_-6px_16px_-8px_rgba(15,27,46,0.25)] transition hover:bg-blue-200"
          >
            Assurance et Prises en Charges
          </Link>
          <Link
            href="/cabinet/personnel/conges"
            className="relative flex w-auto items-center justify-center whitespace-nowrap rounded-t-xl border border-b-transparent border-amber-200/80 border-t-amber-500 bg-amber-100 px-3 py-2 text-center text-[10px] font-semibold text-amber-900 shadow-[0_-6px_16px_-8px_rgba(15,27,46,0.25)] transition hover:bg-amber-200"
          >
            Congés & Absences
          </Link>
        </div>
      </div>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold">Employés</h2>
        <SearchInput placeholder="Filtrer employés..." className="w-full sm:w-2/5" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="code" label="Code" className="px-4 py-3" />
                <SortableTh {...thProps} column="nom" label="Nom" className="px-4 py-3" />
                <SortableTh {...thProps} column="poste" label="Poste" className="px-4 py-3" />
                <SortableTh {...thProps} column="service" label="Service" className="px-4 py-3" />
                <SortableTh {...thProps} column="salaire" label="Salaire de base" className="px-4 py-3" />
                <SortableTh {...thProps} column="contrat" label="Contrat" className="px-4 py-3" />
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Aucun employé.
                  </td>
                </tr>
              )}
              <PaginatedRows colSpan={7}>
              {sortRows(employees, sort, {
                code: (e) => e.employeeCode,
                nom: (e) => `${e.lastName} ${e.firstName}`,
                poste: (e) => e.position,
                service: (e) => e.department,
                salaire: (e) => Number(e.baseSalary),
                contrat: (e) => e.contractType,
              }).map((e) => (
                <tr key={e.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-cabinet-700">
                    <Link href={`/cabinet/personnel/${e.id}`}>{e.employeeCode}</Link>
                  </td>
                  <td className="px-4 py-3">
                    {e.firstName} {e.lastName}
                  </td>
                  <td className="px-4 py-3">{e.position || "—"}</td>
                  <td className="px-4 py-3">{e.department || "—"}</td>
                  <td className="px-4 py-3">{Number(e.baseSalary).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA</td>
                  <td className="px-4 py-3">{e.contractType}</td>
                  <td className="px-4 py-3 text-right">
                    <RowActions
                      resource="employees"
                      id={e.id}
                      active={e.isActive}
                      isAdmin={auth.estAdmin}
                      canEdit={hasPermission(auth.role, "comptabilite", "write")}
                      editHref={`/cabinet/personnel/${e.id}/modifier`}
                      entityLabel={`${e.firstName} ${e.lastName}`}
                    />
                  </td>
                </tr>
              ))}
              </PaginatedRows>
            </tbody>
          </table>
        </div>
      </section>

      <section id="derniers-bulletins" className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Derniers bulletins</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/cabinet/personnel/paie/imprimer?m=${currentMonth}&y=${currentYear}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-cabinet-100 px-3 py-1 text-sm font-medium text-cabinet-700 transition hover:bg-cabinet-200"
            >
              Imprimer la paie du mois
            </Link>
            <Link
              href={
                draftCount > 0
                  ? `/cabinet/personnel/paie/validation?m=${currentMonth}&y=${currentYear}`
                  : "#"
              }
              target={draftCount > 0 ? "_blank" : undefined}
              rel={draftCount > 0 ? "noopener noreferrer" : undefined}
              aria-disabled={draftCount === 0}
              tabIndex={draftCount === 0 ? -1 : undefined}
              className={`
                rounded-md px-3 py-1 text-sm font-medium text-white transition
                ${
                  draftCount > 0
                    ? "bg-orange-500 hover:bg-orange-600"
                    : "pointer-events-none bg-orange-300"
                }
              `}
              title={
                draftCount > 0
                  ? "Imprimer la liste de contrôle des bulletins en brouillon"
                  : "Aucun bulletin en brouillon à valider pour ce mois"
              }
            >
              Paie à valider {draftCount > 0 ? `(${draftCount})` : "(0)"}
            </Link>
            <Link
              href={`/cabinet/personnel?m=${olderMonth}&y=${olderYear}#derniers-bulletins`}
              className="rounded-md bg-emerald-500 px-3 py-1 text-sm font-medium text-white transition hover:bg-emerald-600"
            >
              Précédent
            </Link>
            <span className="min-w-[8rem] text-center text-sm font-medium capitalize">{monthYearLabel}</span>
            <Link
              href={`/cabinet/personnel?m=${newerMonth}&y=${newerYear}#derniers-bulletins`}
              className="rounded-md bg-blue-500 px-3 py-1 text-sm font-medium text-white transition hover:bg-blue-600"
            >
              Suivant
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px]">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="periode" label="Période" className="whitespace-nowrap px-1 py-1" />
                <SortableTh {...thProps} column="employe" label="Employé" className="min-w-[150px] whitespace-nowrap px-1 py-1" />
                <SortableTh {...thProps} column="brut" label="Brut" className="whitespace-nowrap px-1 py-1 text-right" />
                <SortableTh {...thProps} column="net" label="Net" className="whitespace-nowrap px-1 py-1 text-right" />
                <SortableTh {...thProps} column="irpp" label="IRPP" className="whitespace-nowrap px-1 py-1 text-right" />
                <SortableTh {...thProps} column="ipresPP" label="IPRES(PP)" className="whitespace-nowrap px-1 py-1 text-right" />
                <SortableTh {...thProps} column="cnssPP" label="CNSS(PP)" className="whitespace-nowrap px-1 py-1 text-right" />
                <SortableTh {...thProps} column="ipresPE" label="IPRES(PE)" className="whitespace-nowrap px-1 py-1 text-right" />
                <SortableTh {...thProps} column="cnssPE" label="CNSS(PE)" className="whitespace-nowrap px-1 py-1 text-right" />
                <SortableTh {...thProps} column="cout" label={<>Coût total employeur<br />(sans les frais d'assurance)</>} className="whitespace-normal px-1 py-1 text-right leading-tight" />
                <SortableTh {...thProps} column="bstatut" label="Statut" className="whitespace-nowrap px-1 py-1" />
                <th className="whitespace-nowrap px-1 py-1 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-1 py-3 text-center text-gray-500">
                    Aucun bulletin.
                  </td>
                </tr>
              )}
              <PaginatedRows colSpan={12}>
              {sortRows(payrolls, sort, {
                periode: (p) => p.periodYear * 100 + p.periodMonth,
                employe: (p) => `${p.employee.lastName} ${p.employee.firstName}`,
                brut: (p) => Number(p.grossSalary),
                net: (p) => Number(p.netSalary),
                irpp: (p) => Number(p.irppAmount || 0),
                ipresPP: (p) => Number(p.ipresEmployerAmount || 0),
                cnssPP: (p) => Number(p.cssEmployerAmount || 0),
                ipresPE: (p) => Number(p.ipresAmount || 0),
                cnssPE: (p) => Number(p.cssAmount || 0),
                cout: (p) => Number(p.totalEmployerCost || 0),
                bstatut: (p) => p.status,
              }).map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="whitespace-nowrap px-1 py-1">{p.periodMonth}/{p.periodYear}</td>
                  <td className="min-w-[150px] whitespace-nowrap px-1 py-1">{p.employee.firstName} {p.employee.lastName}</td>
                  <td className="whitespace-nowrap px-1 py-1 text-right">{Number(p.grossSalary).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
                  <td className="whitespace-nowrap px-1 py-1 text-right">{Number(p.netSalary).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
                  <td className="whitespace-nowrap px-1 py-1 text-right">{Number(p.irppAmount || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
                  <td className="whitespace-nowrap px-1 py-1 text-right">{Number(p.ipresEmployerAmount || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
                  <td className="whitespace-nowrap px-1 py-1 text-right">{Number(p.cssEmployerAmount || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
                  <td className="whitespace-nowrap px-1 py-1 text-right">{Number(p.ipresAmount || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
                  <td className="whitespace-nowrap px-1 py-1 text-right">{Number(p.cssAmount || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
                  <td className="whitespace-nowrap px-1 py-1 text-right">{Number(p.totalEmployerCost || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
                  <td className="whitespace-nowrap px-1 py-1">
                    <span
                      className={`
                        inline-block rounded-full px-1.5 py-0.5 font-medium
                        ${
                          p.status === "paid"
                            ? "bg-green-100 text-green-700"
                            : ""
                        }
                      `}
                    >
                      {{
                        draft: "Brouillon",
                        validated: "Validé",
                        paid: "Payé",
                        cancelled: "Désactivé",
                      }[p.status] || p.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-1 py-1">
                    <PayrollRowActions payroll={p} canWrite={canWrite} />
                  </td>
                </tr>
              ))}
              </PaginatedRows>
            </tbody>
            {(() => {
              const totalIpres = payrolls.reduce((s, p) => s + Number(p.ipresEmployerAmount || 0) + Number(p.ipresAmount || 0), 0);
              const totalCnss = payrolls.reduce((s, p) => s + Number(p.cssEmployerAmount || 0) + Number(p.cssAmount || 0), 0);
              const totalIrpp = payrolls.reduce((s, p) => s + Number(p.irppAmount || 0), 0);
              return (
                <tfoot className="bg-cabinet-50 text-cabinet-900">
                  <tr className="border-t-2 border-cabinet-300 font-semibold">
                    <td className="whitespace-nowrap px-1 py-1" colSpan={5}>Total IPRES</td>
                    <td className="whitespace-nowrap px-1 py-1 text-right" colSpan={7}>{totalIpres.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
                  </tr>
                  <tr className="border-t border-cabinet-100 font-semibold">
                    <td className="whitespace-nowrap px-1 py-1" colSpan={5}>Total CNSS</td>
                    <td className="whitespace-nowrap px-1 py-1 text-right" colSpan={7}>{totalCnss.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
                  </tr>
                  <tr className="border-t border-cabinet-100 font-semibold">
                    <td className="whitespace-nowrap px-1 py-1" colSpan={5}>IRPP</td>
                    <td className="whitespace-nowrap px-1 py-1 text-right" colSpan={7}>{totalIrpp.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        </div>
      </section>
    </div>
  );
}
