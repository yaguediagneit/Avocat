import { prisma } from "@/lib/prisma";
import { tableSearchWhere, codesMatchingLabel, numericClauses, dateClauses } from "@/lib/search";
import { getSession } from "@/lib/session";
import { formatFileSize } from "@/lib/format";
import { clientDossierFilter } from "@/lib/client-access";
import Link from "next/link";
import { ClientDocumentUpload } from "./client-document-upload";
import { SearchInput } from "@/components/search-input";
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

export default async function ClientDocumentsPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; dir?: string };
}) {
  const session = await getSession();
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/client/documents", params: searchParams };

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
  const dossierFilter = clientDossierFilter(session.userId!, session.clientId);
  const [documents, dossiers] = await Promise.all([
    prisma.document.findMany({
      take: 100,
      where: {
        publieClient: true,
        dossier: dossierFilter,
        ...tableSearchWhere(
          q,
          ["nom", "categorie", "dossier.referenceInterne"],
          (t) => [
            { categorie: { in: codesMatchingLabel(t, CATEGORIE_LABELS) } },
            ...numericClauses(t, ["taille"]),
            ...dateClauses(t, ["datePublication", "createdAt"]),
          ]
        ),
      },
      orderBy: { datePublication: "desc" },
      include: { dossier: { select: { referenceInterne: true } } },
    }),
    prisma.dossier.findMany({
      where: dossierFilter,
      orderBy: { createdAt: "desc" },
      select: { id: true, referenceInterne: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes documents</h1>
        <Link href="/client" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>

      <SearchInput placeholder="Filtrer mes documents..." />
      <ClientDocumentUpload dossiers={dossiers} />

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-cabinet-100 text-cabinet-900">
            <tr>
              <SortableTh {...thProps} column="nom" label="Nom" className="px-4 py-3" />
              <SortableTh {...thProps} column="dossier" label="Dossier" className="px-4 py-3" />
              <SortableTh {...thProps} column="categorie" label="Catégorie" className="px-4 py-3" />
              <SortableTh {...thProps} column="taille" label="Taille" className="px-4 py-3" />
              <SortableTh {...thProps} column="publication" label="Publié le" className="px-4 py-3" />
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                  Aucun document publié pour le moment.
                </td>
              </tr>
            )}
            {sortRows(documents, sort, {
              nom: (doc) => doc.nom,
              dossier: (doc) => doc.dossier.referenceInterne,
              categorie: (doc) => CATEGORIE_LABELS[doc.categorie] || doc.categorie,
              taille: (doc) => doc.taille,
              publication: (doc) => doc.datePublication,
            }).map((doc) => {
              const fromClient = Boolean((doc.metadata as Record<string, unknown> | null)?.sourceClient);
              return (
                <tr key={doc.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {doc.nom}
                    {fromClient && (
                      <span className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-cabinet-800">
                        Déposé par vous
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{doc.dossier.referenceInterne}</td>
                  <td className="px-4 py-3">{CATEGORIE_LABELS[doc.categorie] || doc.categorie}</td>
                  <td className="px-4 py-3">{formatFileSize(doc.taille)}</td>
                  <td className="px-4 py-3">
                    {doc.datePublication
                      ? new Date(doc.datePublication).toLocaleDateString("fr-FR")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      className="text-cabinet-700 hover:underline"
                    >
                      Télécharger
                    </a>
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
