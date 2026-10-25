import { prisma } from "@/lib/prisma";
import { tableSearchWhere, codesMatchingLabel, usersMatchingQuery, userIdsMatchingTerm, numericClauses, dateClauses, boolClauses } from "@/lib/search";
import { getServerDossierScopedFilter, getServerAuth } from "@/lib/server-auth";
import { hasPermission, estIntervenantExterne } from "@/lib/rbac";
import Link from "next/link";
import { formatFileSize } from "@/lib/format";
import { RowActions } from "@/components/row-actions";
import { SearchInput } from "@/components/search-input";
import { PaginatedRows } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

const CATEGORIE_LABELS: Record<string, string> = {
  correspondance: "Correspondance",
  contrat: "Contrat",
  conclusions: "Conclusions",
  pv: "Procès-verbal",
  facture: "Facture",
  titre_foncier: "Titre foncier",
  assignation: "Assignation",
  note_interne: "Note interne",
  autre: "Autre",
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; dir?: string };
}) {
  const accessFilter = await getServerDossierScopedFilter("documents");
  const auth = await getServerAuth();
  const q = (searchParams.q || "").trim();
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/cabinet/documents", params: searchParams };
  // creePar est une chaîne sans relation : pré-chargé pour chercher sur l'auteur.
  const searchUsers = q ? await usersMatchingQuery(prisma, q) : [];
  const documents = await prisma.document.findMany({
    // Les intervenants externes ne voient que les documents partagés avec eux.
    where: {
      ...(estIntervenantExterne(auth.role)
        ? { ...accessFilter, partageExterne: true }
        : accessFilter),
      ...tableSearchWhere(
        q,
        ["nom", "categorie", "dossier.referenceInterne", "dossier.client.raisonSociale"],
        (t) => [
          { categorie: { in: codesMatchingLabel(t, CATEGORIE_LABELS) } },
          { creePar: { in: userIdsMatchingTerm(searchUsers, t) } },
          { metadata: { path: ["typeDocument"], string_contains: t } },
          ...numericClauses(t, ["taille"]),
          ...dateClauses(t, ["createdAt", "datePublication", "dateExpiration"]),
          ...boolClauses(t, ["publieClient", "partageExterne"]),
        ]
      ),
    },
    take: 100,
    include: { dossier: { select: { referenceInterne: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Résoudre les IDs des auteurs en noms affichables
  const auteurIds = [...new Set(documents.map((d) => d.creePar).filter(Boolean) as string[])];
  const auteurs = auteurIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: auteurIds } },
        select: { id: true, prenom: true, nom: true },
      })
    : [];
  const auteurMap = new Map(auteurs.map((u) => [u.id, `${u.prenom} ${u.nom}`.trim()]));
  const auteurLabel = (id: string | null | undefined) =>
    (id && auteurMap.get(id)) || "Utilisateur inconnu";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <Link href="/cabinet/documents/nouveau" className="btn-primary">
          + Ajouter un document
        </Link>
      </div>
      <SearchInput placeholder="Filtrer documents..." />
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="nom" label="Nom" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="dossier" label="Dossier" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="categorie" label="Cat." className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="taille" label="Taille" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="auteur" label="Auteur" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="upload" label="Upload" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="client" label="Client" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="externe" label="Externe" className="px-2 py-3 text-xs whitespace-nowrap" />
                <th className="px-2 py-3 text-right text-xs whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              <PaginatedRows colSpan={9}>
              {sortRows(documents, sort, {
                nom: (d) => d.nom,
                dossier: (d) => d.dossier.referenceInterne,
                categorie: (d) => CATEGORIE_LABELS[d.categorie] || d.categorie,
                taille: (d) => d.taille,
                auteur: (d) => auteurLabel(d.creePar),
                upload: (d) => d.createdAt,
                client: (d) => (d.publieClient ? 1 : 0),
                externe: (d) => (d.partageExterne ? 1 : 0),
              }).map((d) => (
              <tr key={d.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/cabinet/documents/${d.id}`} className="font-medium text-cabinet-700 hover:underline">
                    {d.nom}
                  </Link>
                  {Boolean((d.metadata as Record<string, unknown> | null)?.sourceClient) && (
                    <span className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-cabinet-800">
                      Dépôt client
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{d.dossier.referenceInterne}</td>
                <td className="px-4 py-3">{CATEGORIE_LABELS[d.categorie] || d.categorie}</td>
                <td className="px-4 py-3">{formatFileSize(d.taille)}</td>
                <td className="px-4 py-3">{auteurLabel(d.creePar)}</td>
                <td className="px-4 py-3 text-gray-600">
                  {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3">{d.publieClient ? "Oui" : "Non"}</td>
                <td className="px-4 py-3">{d.partageExterne ? "Oui" : "Non"}</td>
                <td className="px-4 py-3 text-right">
                  <RowActions
                    resource="documents"
                    id={d.id}
                    active={d.actif}
                    isAdmin={auth.estAdmin}
                    canEdit={hasPermission(auth.role, "documents", "write")}
                    editHref={`/cabinet/documents/${d.id}/modifier`}
                    entityLabel={d.nom}
                  />
                </td>
              </tr>
            ))}
              </PaginatedRows>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
