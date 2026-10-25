import { prisma } from "@/lib/prisma";
import { tableSearchWhere, codesMatchingLabel, dateClauses } from "@/lib/search";
import { getServerDossierFilter, getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import Link from "next/link";
import { RowActions } from "@/components/row-actions";
import { SearchInput } from "@/components/search-input";
import { PaginatedRows } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

const STATUT_BADGES: Record<string, string> = {
  Prospect: "bg-slate-100 text-slate-700",
  Nouveau: "bg-cabinet-100 text-cabinet-800",
  "À qualifier": "bg-amber-100 text-amber-700",
  "Conflit d'intérêts à vérifier": "bg-red-100 text-red-700",
  "En attente de pièces": "bg-yellow-100 text-yellow-700",
  Ouvert: "bg-sky-100 text-sky-700",
  "En cours d'analyse": "bg-blue-100 text-blue-700",
  "En rédaction": "bg-indigo-100 text-indigo-700",
  "En relecture": "bg-violet-100 text-violet-700",
  "En validation": "bg-purple-100 text-purple-700",
  "À signifier": "bg-fuchsia-100 text-fuchsia-700",
  "Signification en cours": "bg-pink-100 text-pink-700",
  "En attente de retour": "bg-orange-100 text-orange-700",
  "Audience ou échéance à venir": "bg-rose-100 text-rose-700",
  "En attente du client": "bg-neutral-100 text-neutral-700",
  "En négociation": "bg-lime-100 text-lime-700",
  "En attente de décision": "bg-cyan-100 text-cyan-700",
  "Décision rendue": "bg-green-100 text-green-700",
  "En exécution": "bg-teal-100 text-teal-700",
  Facturation: "bg-stone-100 text-stone-700",
  Clôturé: "bg-emerald-100 text-emerald-700",
  Archivé: "bg-gray-100 text-gray-700",
};

export default async function DossiersPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; dir?: string };
}) {
  const accessFilter = await getServerDossierFilter();
  const auth = await getServerAuth();
  const q = (searchParams.q || "").trim();
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/cabinet/dossiers", params: searchParams };

  // Libellés des types d'affaire (spécialités + anciens paramètres) : servent à
  // l'affichage et à retrouver un dossier par le libellé (« Divorce » → code).
  const [typeParametres, specialites] = await Promise.all([
    prisma.parametre.findMany({
      where: { categorie: "type_affaire" },
      select: { code: true, libelle: true },
    }),
    prisma.specialite.findMany({
      select: { code: true, libelle: true },
    }),
  ]);
  const typeLabels = Object.fromEntries([
    ...typeParametres.map((p) => [p.code, p.libelle] as const),
    ...specialites.map((s) => [s.code, s.libelle] as const),
  ]);

  const dossiers = await prisma.dossier.findMany({
    where: {
      ...accessFilter,
      ...tableSearchWhere(
        q,
        [
          "referenceInterne",
          "typeAffaire",
          "statut",
          "client.raisonSociale",
          "client.identifiant",
        ],
        (t) => [
          { typeAffaire: { in: codesMatchingLabel(t, typeLabels) } },
          ...dateClauses(t, ["createdAt", "dateOuverture", "dateEcheance"]),
        ]
      ),
    },
    take: 200,
    include: { client: { select: { id: true, raisonSociale: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dossiers</h1>
        <Link href="/cabinet/dossiers/nouveau" className="btn-primary">
          + Nouveau dossier
        </Link>
      </div>
      <div className="w-full sm:w-2/5">
        <SearchInput placeholder="Saisir ici pour rechercher" />
      </div>
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="reference" label="Réf. - Ouvrir" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="client" label="Client" className="px-2 py-3 text-xs" />
                <SortableTh {...thProps} column="type" label="Type" className="px-2 py-3 text-xs" />
                <SortableTh {...thProps} column="statut" label="Statut" className="px-2 py-3 text-xs" />
                <SortableTh {...thProps} column="soumis" label="Soumis" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="echeance" label="Échéance" className="px-2 py-3 text-xs whitespace-nowrap" />
                <th className="px-2 py-3 text-right text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-sm text-gray-500">
                    Aucun dossier pour le moment.
                  </td>
                </tr>
              )}
              <PaginatedRows colSpan={7}>
              {sortRows(dossiers, sort, {
                reference: (d) => d.referenceInterne,
                client: (d) => d.client.raisonSociale,
                type: (d) => typeLabels[d.typeAffaire] || d.typeAffaire,
                statut: (d) => d.statut,
                soumis: (d) => d.createdAt,
                echeance: (d) => d.dateEcheance,
              }).map((d) => {
              const isTerminal = d.statut === "Clôturé" || d.statut === "Archivé";
              const canOpen = !isTerminal || auth.estAdmin;
              const canEdit = hasPermission(auth.role, "dossiers", "write") && canOpen;
              return (
                <tr key={d.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {canOpen ? (
                      <Link href={`/cabinet/dossiers/${d.id}`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
                        {d.referenceInterne}
                      </Link>
                    ) : (
                      <span className="font-medium text-gray-600">{d.referenceInterne}</span>
                    )}
                  </td>
                <td className="px-4 py-3">
                  <Link href={`/cabinet/clients/${d.clientId}`} className="text-cabinet-700 hover:underline">
                    {d.client.raisonSociale}
                  </Link>
                </td>
                <td className="px-4 py-3">{typeLabels[d.typeAffaire] || d.typeAffaire}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUT_BADGES[d.statut] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {d.statut}
                  </span>
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-600">
                  {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-2 py-3 whitespace-nowrap text-xs text-gray-600">
                  {d.dateEcheance
                    ? new Date(d.dateEcheance).toLocaleDateString("fr-FR")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <RowActions
                    resource="dossiers"
                    id={d.id}
                    active={d.actif}
                    isAdmin={auth.estAdmin}
                    canEdit={canEdit}
                    editHref={canOpen ? `/cabinet/dossiers/${d.id}/modifier` : undefined}
                    entityLabel={d.referenceInterne}
                  />
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
