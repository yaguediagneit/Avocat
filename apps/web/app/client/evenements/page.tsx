import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { clientDossierFilter } from "@/lib/client-access";
import Link from "next/link";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

const TYPE_LABELS: Record<string, string> = {
  audience: "Audience",
  echeance: "Échéance",
  rdv: "Rendez-vous",
  signification: "Signification",
  deadline: "Deadline",
  journal: "Journal",
};

export default async function ClientEvenementsPage({
  searchParams,
}: {
  searchParams: { sort?: string; dir?: string };
}) {
  const session = await getSession();
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/client/evenements", params: searchParams };

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

  const maintenant = new Date();
  const dossierFilter = clientDossierFilter(session.userId!, session.clientId);

  const evenements = await prisma.evenement.findMany({
    where: {
      estPublicClient: true,
      dateDebut: { gte: maintenant },
      OR: [{ dossier: dossierFilter }, { dossierId: null }],
    },
    orderBy: { dateDebut: "asc" },
    include: { dossier: { select: { referenceInterne: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rendez-vous et échéances</h1>
        <Link href="/client" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-cabinet-100 text-cabinet-900">
            <tr>
              <SortableTh {...thProps} column="evenement" label="Événement" className="px-4 py-3" />
              <SortableTh {...thProps} column="type" label="Type" className="px-4 py-3" />
              <SortableTh {...thProps} column="dossier" label="Dossier" className="px-4 py-3" />
              <SortableTh {...thProps} column="date" label="Date" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {evenements.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                  Aucun événement partagé à venir.
                </td>
              </tr>
            )}
            {sortRows(evenements, sort, {
              evenement: (e) => e.titre,
              type: (e) => TYPE_LABELS[e.type] || e.type,
              dossier: (e) => e.dossier?.referenceInterne,
              date: (e) => e.dateDebut,
            }).map((e) => (
              <tr key={e.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <p>{e.titre}</p>
                  {e.lieu && <p className="text-xs text-cabinet-500">Lieu : {e.lieu}</p>}
                </td>
                <td className="px-4 py-3">{TYPE_LABELS[e.type] || e.type}</td>
                <td className="px-4 py-3">{e.dossier?.referenceInterne ?? "—"}</td>
                <td className="px-4 py-3">
                  {new Date(e.dateDebut).toLocaleString("fr-FR")}
                  {e.dateFin && ` – ${new Date(e.dateFin).toLocaleString("fr-FR")}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
