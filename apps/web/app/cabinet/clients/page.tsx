import { prisma } from "@/lib/prisma";
import { tableSearchWhere, codesMatchingLabel } from "@/lib/search";
import { getServerClientFilter, getServerDossierFilter, getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import Link from "next/link";
import { RowActions } from "@/components/row-actions";
import { SearchInput } from "@/components/search-input";
import { PaginatedRows, PaginatedUl } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

const TYPE_LABELS: Record<string, string> = {
  physique: "Physique",
  entreprise: "Entreprise",
  administration: "Administration",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { q?: string; client?: string; sort?: string; dir?: string };
}) {
  const clientFilter = await getServerClientFilter();
  const auth = await getServerAuth();
  const q = (searchParams.q || "").trim();
  const rawQ = (searchParams.q || "").trim();
  const selectedId = (searchParams.client || "").trim();
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/cabinet/clients", params: searchParams };

  const clients = await prisma.client.findMany({
    where: {
      ...clientFilter,
      ...tableSearchWhere(
        q,
        ["raisonSociale", "identifiant", "adresse"],
        (t) => [
          { type: { in: codesMatchingLabel(t, TYPE_LABELS) } },
          { coordonnees: { path: ["telephone"], string_contains: t } },
          { coordonnees: { path: ["email"], string_contains: t } },
        ]
      ),
    },
    take: 200,
    orderBy: { raisonSociale: "asc" },
  });

  // Client sélectionné : peut être hors de la page courante (filtre q / take 200),
  // donc requête dédiée en secours.
  const selectedClient = selectedId
    ? clients.find((c) => c.id === selectedId) ??
      (await prisma.client.findFirst({
        where: { id: selectedId, ...clientFilter },
      }))
    : null;

  // Dossiers du client sélectionné + libellés des types d'affaire
  // (spécialités pour les nouveaux dossiers, paramètres pour les anciens codes).
  let selectedDossiers: {
    id: string;
    referenceInterne: string;
    typeAffaire: string;
    statut: string;
    dateEcheance: Date | null;
    createdAt: Date;
  }[] = [];
  const typeLabels: Record<string, string> = {};
  if (selectedClient) {
    const dossierFilter = await getServerDossierFilter();
    const [dossiers, typeParametres, specialites] = await Promise.all([
      prisma.dossier.findMany({
        where: { clientId: selectedClient.id, ...dossierFilter },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          referenceInterne: true,
          typeAffaire: true,
          statut: true,
          dateEcheance: true,
          createdAt: true,
        },
      }),
      prisma.parametre.findMany({
        where: { categorie: "type_affaire" },
        select: { code: true, libelle: true },
      }),
      prisma.specialite.findMany({
        select: { code: true, libelle: true },
      }),
    ]);
    selectedDossiers = dossiers;
    for (const s of specialites) typeLabels[s.code] = s.libelle;
    for (const p of typeParametres) typeLabels[p.code] = p.libelle;
  }

  // Lien de sélection : préserve la recherche ; cliquer la ligne déjà
  // sélectionnée désélectionne.
  function selectHref(id: string | null) {
    const params = new URLSearchParams();
    if (rawQ) params.set("q", rawQ);
    if (searchParams.sort) params.set("sort", searchParams.sort);
    if (searchParams.dir) params.set("dir", searchParams.dir);
    if (id) params.set("client", id);
    const s = params.toString();
    return `/cabinet/clients${s ? `?${s}` : ""}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link href="/cabinet/clients/nouveau" className="btn-primary">
          + Nouveau client
        </Link>
      </div>
      <SearchInput placeholder="Filtrer clients..." />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cabinet-100 text-cabinet-900">
                <tr>
                  <SortableTh {...thProps} column="raisonSociale" label="Raison sociale" className="px-2 py-3 text-xs whitespace-nowrap" />
                  <SortableTh {...thProps} column="type" label="Type" className="px-2 py-3 text-xs whitespace-nowrap" />
                  <SortableTh {...thProps} column="identifiant" label="Identifiant" className="px-2 py-3 text-xs whitespace-nowrap" />
                  <SortableTh {...thProps} column="coord" label="Coord." className="px-2 py-3 text-xs whitespace-nowrap" />
                  <th className="px-2 py-3 text-right text-xs whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-sm text-gray-500">
                      Aucun client trouvé.
                    </td>
                  </tr>
                )}
                <PaginatedRows colSpan={5}>
                {sortRows(clients, sort, {
                  raisonSociale: (c) => c.raisonSociale,
                  type: (c) => TYPE_LABELS[c.type] || c.type,
                  identifiant: (c) => c.identifiant,
                  coord: (c) => {
                    const co = c.coordonnees as Record<string, string> | null;
                    return co?.telephone || co?.email;
                  },
                }).map((c) => {
                const coordonnees = c.coordonnees as Record<string, string> | null;
                const isSelected = c.id === selectedClient?.id;
                const href = selectHref(isSelected ? null : c.id);
                return (
                  <tr
                    key={c.id}
                    className={`border-b transition ${
                      isSelected ? "bg-cabinet-100/70" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="p-0">
                      <Link
                        href={href}
                        scroll={false}
                        className={`block px-4 py-3 font-medium ${
                          isSelected ? "text-cabinet-900" : "text-cabinet-700"
                        }`}
                      >
                        {c.raisonSociale}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={href} scroll={false} className="block px-4 py-3">
                        {TYPE_LABELS[c.type] || c.type}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link href={href} scroll={false} className="block px-4 py-3">
                        {c.identifiant || "—"}
                      </Link>
                    </td>
                    <td className="p-0">
                      <Link
                        href={href}
                        scroll={false}
                        className="block px-4 py-3 text-xs text-gray-600"
                      >
                        {coordonnees?.telephone && <div>{coordonnees.telephone}</div>}
                        {coordonnees?.email && <div>{coordonnees.email}</div>}
                        {!coordonnees?.telephone && !coordonnees?.email && "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RowActions
                        resource="clients"
                        id={c.id}
                        active={c.actif}
                        isAdmin={auth.estAdmin}
                        canEdit={hasPermission(auth.role, "clients", "write")}
                        editHref={`/cabinet/clients/${c.id}/modifier`}
                        entityLabel={c.raisonSociale}
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

        {/* Panneau des dossiers du client sélectionné */}
        <div className="card space-y-3 lg:sticky lg:top-4">
          {selectedClient ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-cabinet-900">
                    {selectedClient.raisonSociale}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {selectedDossiers.length} dossier{selectedDossiers.length > 1 ? "s" : ""}
                  </p>
                </div>
                <Link
                  href={`/cabinet/clients/${selectedClient.id}`}
                  className="whitespace-nowrap text-xs text-cabinet-700 hover:underline"
                >
                  Fiche client →
                </Link>
              </div>

              {selectedDossiers.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun dossier pour ce client.</p>
              ) : (
                <ul className="divide-y overflow-hidden rounded-md border border-gray-200">
                  <PaginatedUl>
                  {selectedDossiers.map((d) => {
                    const isTerminal = d.statut === "Clôturé" || d.statut === "Archivé";
                    const canOpen = !isTerminal || auth.estAdmin;
                    const content = (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-cabinet-700">
                            {d.referenceInterne}
                          </span>
                          <span className="whitespace-nowrap rounded-full bg-cabinet-50 px-2 py-0.5 text-xs font-medium">
                            {d.statut}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {typeLabels[d.typeAffaire] || d.typeAffaire}
                          {d.dateEcheance &&
                            ` · Échéance ${new Date(d.dateEcheance).toLocaleDateString("fr-FR")}`}
                        </p>
                      </>
                    );
                    return (
                      <li key={d.id}>
                        {canOpen ? (
                          <Link
                            href={`/cabinet/dossiers/${d.id}`}
                            className="block px-3 py-2.5 transition hover:bg-cabinet-50"
                          >
                            {content}
                          </Link>
                        ) : (
                          <div className="px-3 py-2.5 text-gray-500">{content}</div>
                        )}
                      </li>
                    );
                  })}
                  </PaginatedUl>
                </ul>
              )}

              <Link
                href={`/cabinet/dossiers/nouveau?clientId=${selectedClient.id}`}
                className="btn-primary block text-center text-xs"
              >
                + Nouveau dossier
              </Link>
            </>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-500">
                Cliquez sur un client pour afficher ses dossiers.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
