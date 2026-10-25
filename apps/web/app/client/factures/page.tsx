import { prisma } from "@/lib/prisma";
import { tableSearchWhere, numericClauses, dateClauses } from "@/lib/search";
import { getSession } from "@/lib/session";
import Link from "next/link";
import { SearchInput } from "@/components/search-input";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

const STATUT_BADGES: Record<string, string> = {
  Brouillon: "bg-gray-100 text-gray-700",
  Emise: "bg-cabinet-100 text-cabinet-800",
  "Partiellement payée": "bg-amber-100 text-amber-700",
  Payée: "bg-emerald-100 text-emerald-700",
};

export default async function ClientFacturesPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; dir?: string };
}) {
  const session = await getSession();
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/client/factures", params: searchParams };

  if (!session.isClient || !session.clientId) {
    return (
      <div className="card p-6 text-center">
        <p className="text-gray-600">Veuillez vous connecter avec un compte client.</p>
        <Link href="/client/login" className="btn-primary mt-4 inline-block">
          Se connecter
        </Link>
      </div>
    );
  }

  const q = (searchParams.q || "").trim();
  const factures = await prisma.facture.findMany({
    take: 100,
    where: {
      clientId: session.clientId,
      ...tableSearchWhere(
        q,
        ["numero", "libelle", "designation", "statut", "dossier.referenceInterne"],
        (t) => [
          ...numericClauses(t, [
            "totalTtc",
            "totalHt",
            "debours",
            "frais",
            "paiements.some.montant",
          ]),
          ...dateClauses(t, ["dateEmission", "dateEcheance"]),
        ]
      ),
    },
    include: { paiements: true },
    orderBy: { dateEmission: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes factures</h1>
        <Link href="/client" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>
      <SearchInput placeholder="Filtrer mes factures..." />
      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-cabinet-100 text-cabinet-900">
            <tr>
              <SortableTh {...thProps} column="numero" label="Numéro" className="px-4 py-3" />
              <SortableTh {...thProps} column="libelle" label="Libellé" className="px-4 py-3" />
              <SortableTh {...thProps} column="designation" label="Désignation" className="px-4 py-3" />
              <SortableTh {...thProps} column="emission" label="Émission" className="px-4 py-3" />
              <SortableTh {...thProps} column="echeance" label="Échéance" className="px-4 py-3" />
              <SortableTh {...thProps} column="total" label="Total TTC" className="px-4 py-3" />
              <SortableTh {...thProps} column="paye" label="Payé" className="px-4 py-3" />
              <SortableTh {...thProps} column="solde" label="Solde" className="px-4 py-3" />
              <SortableTh {...thProps} column="statut" label="Statut" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {factures.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-gray-500">
                  Aucune facture à afficher.
                </td>
              </tr>
            )}
            {sortRows(factures, sort, {
              numero: (f) => f.numero,
              libelle: (f) => f.libelle,
              designation: (f) => f.designation,
              emission: (f) => f.dateEmission,
              echeance: (f) => f.dateEcheance,
              total: (f) => Number(f.totalTtc),
              paye: (f) => f.paiements.reduce((acc, p) => acc + Number(p.montant), 0),
              solde: (f) => Number(f.totalTtc) - f.paiements.reduce((acc, p) => acc + Number(p.montant), 0),
              statut: (f) => f.statut,
            }).map((f) => {
              const paye = f.paiements.reduce((acc, p) => acc + Number(p.montant), 0);
              const solde = Number(f.totalTtc) - paye;
              return (
                <tr key={f.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{f.numero}</td>
                  <td className="px-4 py-3">{f.libelle || "—"}</td>
                  <td className="px-4 py-3">{f.designation || "—"}</td>
                  <td className="px-4 py-3">
                    {new Date(f.dateEmission).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3">
                    {f.dateEcheance
                      ? new Date(f.dateEcheance).toLocaleDateString("fr-FR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{Number(f.totalTtc).toLocaleString("fr-FR")} FCFA</td>
                  <td className="px-4 py-3">{paye.toLocaleString("fr-FR")} FCFA</td>
                  <td className="px-4 py-3">{solde.toLocaleString("fr-FR")} FCFA</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUT_BADGES[f.statut] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {f.statut}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
