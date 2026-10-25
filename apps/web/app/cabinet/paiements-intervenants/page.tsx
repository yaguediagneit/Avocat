import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { tableSearchWhere, numericClauses, dateClauses, boolClauses } from "@/lib/search";
import {
  getServerAuth,
  getServerDossierScopedFilter,
  serverHasPermission,
} from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { RowActions } from "@/components/row-actions";
import { SearchInput } from "@/components/search-input";
import { ChargePayerButton } from "../charges/payer-button";
import { PaginatedRows } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

const STATUT_BADGES: Record<string, string> = {
  Impayée: "bg-amber-100 text-amber-700",
  Payée: "bg-emerald-100 text-emerald-700",
};

export default async function PaiementsIntervenantsPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; dir?: string };
}) {
  if (!(await serverHasPermission("comptabilite", "read"))) {
    redirect("/cabinet");
  }

  const auth = await getServerAuth();
  const q = (searchParams.q || "").trim();
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/cabinet/paiements-intervenants", params: searchParams };
  const accessFilter = await getServerDossierScopedFilter("comptabilite");
  const dossierIds = (accessFilter as any).dossierId?.in as string[] | undefined;

  const accessWhere =
    !dossierIds || dossierIds.length === 0
      ? undefined
      : {
          OR: [
            { dossierId: null },
            { dossierId: { in: dossierIds } },
            { tache: { dossierId: { in: dossierIds } } },
            { missionHuissier: { dossierId: { in: dossierIds } } },
          ],
        };

  const charges = await prisma.charge.findMany({
    where: {
      category: { code: "PAIEMENT_INTERVENANT" },
      ...tableSearchWhere(
        q,
        [
          "id",
          "description",
          "supplierName",
          "supplierInvoiceRef",
          "paymentMethod",
          "dossier.referenceInterne",
          "tache.titre",
          "missionHuissier.typeActe",
          "missionHuissier.destinataire",
          "lines.some.description",
        ],
        (t) => [
          ...numericClauses(t, [
            "amount",
            "totalHt",
            "taxAmount",
            "lines.some.quantite",
            "lines.some.prixUnitaire",
            "lines.some.totalHt",
            "lines.some.totalTtc",
          ]),
          ...dateClauses(t, ["chargeDate", "createdAt"]),
          ...boolClauses(t, ["isPaid"], {
            true: ["payée", "payee", "payé", "paye"],
            false: ["impayée", "impayee", "impayé", "impaye", "attente"],
          }),
        ]
      ),
      ...(accessWhere ? accessWhere : {}),
    },
    take: 100,
    include: {
      category: true,
      dossier: { select: { referenceInterne: true } },
      tache: { select: { titre: true } },
      missionHuissier: { select: { typeActe: true } },
      lines: { orderBy: { ordre: "asc" } },
    },
    orderBy: { chargeDate: "desc" },
  });

  const canWrite = hasPermission(auth.role, "comptabilite", "write");
  const canValidate =
    canWrite && (auth.role.nom.toLowerCase().includes("comptable") || auth.estAdmin);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Paiements intervenants externes</h1>
        <Link href="/cabinet/paiements-intervenants/nouvelle" className="btn-primary">
          + Nouveau
        </Link>
      </div>
      <SearchInput placeholder="Filtrer paiements..." className="w-1/4" />
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-[11px]">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="numero" label="Numéro" className="w-20 px-1 py-2" />
                <SortableTh {...thProps} column="libelle" label="Libellé" className="w-24 px-1 py-2" />
                <SortableTh {...thProps} column="designation" label="Désignation" className="w-24 px-1 py-2" />
                <SortableTh {...thProps} column="dossier" label="Dossier" className="w-24 px-1 py-2" />
                <SortableTh {...thProps} column="intervenant" label="Intervenant" className="w-24 px-1 py-2" />
                <SortableTh {...thProps} column="date" label="Date" className="w-16 px-1 py-2" />
                <SortableTh {...thProps} column="total" label="Total TTC" className="w-20 px-1 py-2" />
                <SortableTh {...thProps} column="reste" label="Reste" className="w-16 px-1 py-2" />
                <SortableTh {...thProps} column="statut" label="Statut" className="w-14 px-1 py-2" />
                <th className="w-20 px-1 py-2 text-right">Actions</th>
              </tr>
            </thead>
          <tbody>
            {charges.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-sm text-gray-500">
                  Aucun paiement intervenant pour le moment.
                </td>
              </tr>
            )}
            <PaginatedRows colSpan={10}>
            {sortRows(charges, sort, {
              numero: (c) => c.supplierInvoiceRef || c.id,
              libelle: (c) => c.description,
              designation: (c) => c.supplierInvoiceRef,
              dossier: (c) => c.dossier?.referenceInterne,
              intervenant: (c) => c.supplierName,
              date: (c) => c.chargeDate,
              total: (c) => Number(c.amount),
              reste: (c) => (c.isPaid ? 0 : Number(c.amount)),
              statut: (c) => (c.isPaid ? "Payée" : "Impayée"),
            }).map((c) => {
              const reste = c.isPaid ? 0 : Number(c.amount);
              const statut = c.isPaid ? "Payée" : "Impayée";
              return (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-1 py-2 truncate">
                    <Link
                      href={`/cabinet/paiements-intervenants/${c.id}/imprimer`}
                      className="font-medium text-cabinet-700 hover:underline"
                    >
                      {c.supplierInvoiceRef || c.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-1 py-2 truncate">{c.description || "—"}</td>
                  <td className="px-1 py-2 truncate">{c.supplierInvoiceRef || "—"}</td>
                  <td className="px-1 py-2 truncate">{c.dossier?.referenceInterne ?? "—"}</td>
                  <td className="px-1 py-2 truncate">{c.supplierName || "—"}</td>
                  <td className="px-1 py-2 whitespace-nowrap">
                    {new Date(c.chargeDate).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-1 py-2 truncate">{Number(c.amount).toLocaleString("fr-FR")} F</td>
                  <td className="px-1 py-2 truncate">{reste.toLocaleString("fr-FR")} F</td>
                  <td className="px-1 py-2">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        STATUT_BADGES[statut] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {statut}
                    </span>
                  </td>
                  <td className="px-1 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!c.isPaid &&
                        (canValidate ? (
                          <ChargePayerButton charge={{ id: c.id, amount: Number(c.amount) }} />
                        ) : (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            Attente
                          </span>
                        ))}
                      <RowActions
                        resource="charges"
                        id={c.id}
                        active={c.actif}
                        isAdmin={auth.estAdmin}
                        canEdit={canWrite}
                        printHref={`/cabinet/paiements-intervenants/${c.id}/imprimer`}
                        entityLabel={`paiement du ${new Date(c.chargeDate).toLocaleDateString("fr-FR")}`}
                      />
                    </div>
                  </td>
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
