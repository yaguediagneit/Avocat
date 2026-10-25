import { prisma } from "@/lib/prisma";
import { getServerAuth, serverCanAccessDossier } from "@/lib/server-auth";
import { estIntervenantExterne } from "@/lib/rbac";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatFileSize } from "@/lib/format";
import { ValidationWorkflow } from "./validation-workflow";
import { DocumentPreviewButton } from "./document-preview-button";
import { PaginatedUl } from "@/components/pagination";

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

export default async function DocumentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      dossier: { select: { referenceInterne: true, clientId: true, client: { select: { raisonSociale: true } } } },
      versions: { orderBy: { numeroVersion: "desc" } },
    },
  });

  if (!document) {
    notFound();
  }

  // Isolation : vérifie l'accès au dossier du document.
  const canAccess = await serverCanAccessDossier(document.dossierId, "read");
  if (!canAccess) {
    notFound();
  }

  // Les intervenants externes n'ont accès qu'aux documents partagés avec eux.
  const auth = await getServerAuth();
  if (estIntervenantExterne(auth.role) && !document.partageExterne) {
    notFound();
  }

  const metadata = (document.metadata as Record<string, unknown>) || {};

  // Résout les IDs des auteurs (document + versions) en noms affichables.
  const auteurIds = [
    ...new Set(
      [document.creePar, ...document.versions.map((v) => v.creePar)].filter(
        (id): id is string => Boolean(id)
      )
    ),
  ];
  const auteurs = auteurIds.length
    ? await prisma.user.findMany({
        where: { id: { in: auteurIds } },
        select: { id: true, prenom: true, nom: true },
      })
    : [];
  const auteurMap = new Map(auteurs.map((u) => [u.id, `${u.prenom} ${u.nom}`.trim()]));
  const auteurLabel = (id: string | null | undefined) =>
    (id && auteurMap.get(id)) || "Utilisateur inconnu";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{document.nom}</h1>
          <p className="text-sm text-gray-600">
            {CATEGORIE_LABELS[document.categorie] || document.categorie} ·{" "}
            {formatFileSize(document.taille)}
          </p>
        </div>
        <Link href="/cabinet/documents" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>

      <div className="card grid gap-4 text-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="text-gray-500">Dossier</span>
            <p>
              <Link href={`/cabinet/dossiers/${document.dossierId}`} className="text-cabinet-700 hover:underline">
                {document.dossier.referenceInterne}
              </Link>
            </p>
          </div>
          <div>
            <span className="text-gray-500">Client</span>
            <p>
              <Link href={`/cabinet/clients/${document.dossier.clientId}`} className="text-cabinet-700 hover:underline">
                {document.dossier.client.raisonSociale}
              </Link>
            </p>
          </div>
          <div>
            <span className="text-gray-500">Publié client</span>
            <p>{document.publieClient ? "Oui" : "Non"}</p>
          </div>
          <div>
            <span className="text-gray-500">Partagé externes</span>
            <p>{document.partageExterne ? "Oui" : "Non"}</p>
          </div>
          <div>
            <span className="text-gray-500">Ajouté par</span>
            <p>{auteurLabel(document.creePar)}</p>
          </div>
          <div>
            <span className="text-gray-500">Date d'ajout</span>
            <p>{new Date(document.createdAt).toLocaleString("fr-FR")}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-gray-500">Description</span>
            <p className="whitespace-pre-line">{(metadata.description as string) || "—"}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-gray-500">Hash SHA-256</span>
            <p className="break-all font-mono text-xs text-gray-600">{document.hashSha256}</p>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <DocumentPreviewButton
            documentId={document.id}
            documentName={document.nom}
          />
          <a
            href={`/api/documents/${document.id}/download`}
            className="btn-primary"
          >
            Télécharger le fichier
          </a>
        </div>
      </div>

      <ValidationWorkflow
        documentId={document.id}
        initialStatut={document.statutValidation}
        initialRelecteurId={document.relecteurId}
        initialCircuit={(document.circuitValidation as any[]) || []}
      />

      {/* Historique des versions */}
      {document.versions.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-lg font-semibold">Historique des versions</h2>
          <ol className="space-y-2">
            <PaginatedUl>
            {document.versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 p-3 text-sm">
                <div>
                  <span className="font-medium">Version {v.numeroVersion}</span>
                  <span className="ml-2 text-gray-500">
                    par {auteurLabel(v.creePar)} · {new Date(v.createdAt).toLocaleString("fr-FR")}
                  </span>
                </div>
                <span className="font-mono text-xs text-gray-400">{v.hashSha256.substring(0, 16)}…</span>
              </li>
            ))}
            </PaginatedUl>
          </ol>
        </div>
      )}
    </div>
  );
}
