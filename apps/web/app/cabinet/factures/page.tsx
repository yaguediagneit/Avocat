import { prisma } from "@/lib/prisma";
import { tableSearchWhere, numericClauses, dateClauses } from "@/lib/search";
import { getServerDossierScopedFilter, getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import Link from "next/link";
import { RowActions } from "@/components/row-actions";
import { SearchInput } from "@/components/search-input";
import { PayerButton } from "./payer-button";
import { PaginatedRows } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

const STATUT_BADGES: Record<string, string> = {
  Brouillon: "bg-gray-100 text-gray-700",
  Emise: "bg-cabinet-100 text-cabinet-800",
  "Partiellement payée": "bg-amber-100 text-amber-700",
  Payée: "bg-emerald-100 text-emerald-700",
};

export default async function FacturesPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; dir?: string };
}) {
  const accessFilter = await getServerDossierScopedFilter("factures");
  const auth = await getServerAuth();
  const q = (searchParams.q || "").trim();
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/cabinet/factures", params: searchParams };
  const factures = await prisma.facture.findMany({
    where: {
      ...accessFilter,
      ...tableSearchWhere(
        q,
        [
          "numero",
          "libelle",
          "designation",
          "statut",
          "client.raisonSociale",
          "client.identifiant",
          "dossier.referenceInterne",
          "lines.some.description",
        ],
        (t) => [
          ...numericClauses(t, [
            "totalTtc",
            "totalHt",
            "debours",
            "frais",
            "lines.some.prixUnitaire",
            "lines.some.totalHt",
            "lines.some.totalTtc",
            // Colonne « Payé » : au moins un paiement du montant saisi.
            "paiements.some.montant",
          ]),
          ...dateClauses(t, ["dateEmission", "dateEcheance"]),
        ]
      ),
    },
    take: 100,
    include: {
      dossier: { select: { referenceInterne: true } },
      client: { select: { raisonSociale: true } },
      paiements: true,
    },
    orderBy: { dateEmission: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Facturation</h1>
        <Link href="/cabinet/factures/nouvelle" className="btn-primary">
          + Nouvelle facture
        </Link>
      </div>
      <SearchInput placeholder="Filtrer factures..." className="w-full sm:w-1/4" />
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="numero" label="Num." className="px-2 py-2 text-[11px] whitespace-nowrap" />
                <SortableTh {...thProps} column="libelle" label="Libellé" className="px-2 py-2 text-[11px]" />
                <SortableTh {...thProps} column="designation" label="Désignation" className="px-2 py-2 text-[11px]" />
                <SortableTh {...thProps} column="dossier" label="Dossier" className="px-2 py-2 text-[11px] whitespace-nowrap" />
                <SortableTh {...thProps} column="client" label="Client" className="px-2 py-2 text-[11px]" />
                <SortableTh {...thProps} column="emission" label="Émiss." className="px-2 py-2 text-[11px] whitespace-nowrap" />
                <SortableTh {...thProps} column="ttc" label="TTC&nbsp;(F)" className="px-2 py-2 text-[11px] whitespace-nowrap" />
                <SortableTh {...thProps} column="paye" label="Payé&nbsp;(F)" className="px-2 py-2 text-[11px] whitespace-nowrap" />
                <SortableTh {...thProps} column="reste" label="Reste&nbsp;(F)" className="px-2 py-2 text-[11px] whitespace-nowrap" />
                <SortableTh {...thProps} column="statut" label="Statut" className="px-2 py-2 text-[11px] whitespace-nowrap" />
                <th className="px-2 py-2 text-right text-[11px] whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {factures.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-2 py-6 text-center text-xs text-gray-500">
                    Aucune facture pour le moment.
                  </td>
                </tr>
              )}
              <PaginatedRows colSpan={11}>
              {sortRows(factures, sort, {
                numero: (f) => f.numero,
                libelle: (f) => f.libelle,
                designation: (f) => f.designation,
                dossier: (f) => f.dossier?.referenceInterne,
                client: (f) => f.client.raisonSociale,
                emission: (f) => f.dateEmission,
                ttc: (f) => Number(f.totalTtc),
                paye: (f) => f.paiements.reduce((acc, p) => acc + Number(p.montant), 0),
                reste: (f) => Number(f.totalTtc) - f.paiements.reduce((acc, p) => acc + Number(p.montant), 0),
                statut: (f) => f.statut,
              }).map((f) => {
              const paye = f.paiements.reduce((acc, p) => acc + Number(p.montant), 0);
              const reste = Number(f.totalTtc) - paye;
              return (
                <tr key={f.id} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-2 whitespace-nowrap">
                    <Link href={`/cabinet/factures/${f.id}`} className="font-medium text-cabinet-700 hover:underline">
                      {f.numero}
                    </Link>
                  </td>
                  <td className="px-2 py-2 max-w-[90px] truncate" title={f.libelle || ""}>{f.libelle || "—"}</td>
                  <td className="px-2 py-2 max-w-[110px] truncate" title={f.designation || ""}>{f.designation || "—"}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{f.dossier?.referenceInterne ?? "—"}</td>
                  <td className="px-2 py-2 max-w-[110px] truncate" title={f.client.raisonSociale}>{f.client.raisonSociale}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {new Date(f.dateEmission).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{Number(f.totalTtc).toLocaleString("fr-FR")}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{paye.toLocaleString("fr-FR")}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{reste.toLocaleString("fr-FR")}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        STATUT_BADGES[f.statut] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {f.statut}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-0.5">
                      <RowActions
                        resource="factures"
                        id={f.id}
                        active={f.actif}
                        isAdmin={auth.estAdmin}
                        canEdit={hasPermission(auth.role, "factures", "write")}
                        editHref={`/cabinet/factures/${f.id}/modifier`}
                        printHref={`/cabinet/factures/${f.id}/imprimer`}
                        entityLabel={f.numero}
                      />
                      {hasPermission(auth.role, "factures", "write") && (
                        <PayerButton facture={{ id: f.id, numero: f.numero }} reste={reste} />
                      )}
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
