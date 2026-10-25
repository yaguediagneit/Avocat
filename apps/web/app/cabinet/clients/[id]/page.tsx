import { prisma } from "@/lib/prisma";
import { getServerClientFilter, getServerDossierFilter } from "@/lib/server-auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PaginatedRows, PaginatedUl } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { sort?: string; dir?: string };
}) {
  const [clientFilter, dossierFilter] = await Promise.all([
    getServerClientFilter(),
    getServerDossierFilter(),
  ]);
  const client = await prisma.client.findFirst({
    where: { id: params.id, ...clientFilter },
    include: {
      dossiers: {
        where: dossierFilter,
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { documents: { take: 0 } },
      },
    },
  });

  if (!client) {
    notFound();
  }

  const coordonnees = client.coordonnees as Record<string, string> | null;
  const representants = (client.representants as Record<string, string>[] | null) || [];
  const sort = getSortSpec(searchParams);
  const thProps = { path: `/cabinet/clients/${params.id}`, params: searchParams };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{client.raisonSociale}</h1>
          <p className="text-sm capitalize text-gray-600">
            {client.type} · {client.identifiant || "Sans identifiant"}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/cabinet/clients/${client.id}/modifier`}
            className="btn-secondary"
          >
            Modifier
          </Link>
          <Link href="/cabinet/clients" className="text-sm text-cabinet-700 hover:underline">
            ← Retour
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card space-y-4">
          <h2 className="font-semibold">Coordonnées</h2>
          <div className="space-y-2 text-sm">
            {client.adresse ? (
              <p className="whitespace-pre-line text-gray-700">{client.adresse}</p>
            ) : (
              <p className="text-gray-500">Aucune adresse renseignée.</p>
            )}
            {coordonnees?.telephone && (
              <p>
                <span className="text-gray-500">Téléphone :</span> {coordonnees.telephone}
              </p>
            )}
            {coordonnees?.email && (
              <p>
                <span className="text-gray-500">E-mail :</span> {coordonnees.email}
              </p>
            )}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold">Représentants</h2>
          {representants.length > 0 ? (
            <ul className="space-y-2 text-sm">
              <PaginatedUl>
              {representants.map((rep, i) => (
                <li key={i} className="rounded-lg bg-gray-50 p-2">
                  {rep.nom || rep.raisonSociale || "Représentant"}
                  {rep.fonction && <span className="text-gray-500"> — {rep.fonction}</span>}
                </li>
              ))}
              </PaginatedUl>
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Aucun représentant.</p>
          )}
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Dossiers liés</h2>
          <Link
            href={`/cabinet/dossiers/nouveau?clientId=${client.id}`}
            className="btn-primary text-xs"
          >
            + Nouveau dossier
          </Link>
        </div>
        {client.dossiers.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="reference" label="Référence" className="px-4 py-2" />
                <SortableTh {...thProps} column="type" label="Type" className="px-4 py-2" />
                <SortableTh {...thProps} column="statut" label="Statut" className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              <PaginatedRows colSpan={3}>
              {sortRows(client.dossiers, sort, {
                reference: (d) => d.referenceInterne,
                type: (d) => d.typeAffaire,
                statut: (d) => d.statut,
              }).map((d) => (
                <tr key={d.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link href={`/cabinet/dossiers/${d.id}`} className="text-cabinet-700 hover:underline">
                      {d.referenceInterne}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{d.typeAffaire}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-cabinet-50 px-2 py-1 text-xs font-medium">
                      {d.statut}
                    </span>
                  </td>
                </tr>
              ))}
              </PaginatedRows>
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-500">Aucun dossier pour ce client.</p>
        )}
      </div>
    </div>
  );
}
