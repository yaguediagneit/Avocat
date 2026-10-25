import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { DocumentForm } from "./document-form";

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams?: { dossierId?: string; typeDocument?: string; categorie?: string; nom?: string };
}) {
  const dossiers = await prisma.dossier.findMany({
    take: 200,
    orderBy: { referenceInterne: "asc" },
    select: {
      id: true,
      referenceInterne: true,
      client: { select: { raisonSociale: true } },
    },
  });

  const defaultDossierId = searchParams?.dossierId;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nouveau document</h1>
        <Link href="/cabinet/documents" className="text-sm text-cabinet-700 hover:underline">
          ← Retour aux documents
        </Link>
      </div>
      <DocumentForm
        dossiers={dossiers}
        defaultDossierId={defaultDossierId}
        defaultTypeDocument={searchParams?.typeDocument}
        defaultCategorie={searchParams?.categorie}
        defaultNom={searchParams?.nom}
      />
    </div>
  );
}
