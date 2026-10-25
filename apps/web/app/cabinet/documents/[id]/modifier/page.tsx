import { prisma } from "@/lib/prisma";
import { serverCanAccessDossier } from "@/lib/server-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { DocumentEditForm } from "./document-edit-form";

export default async function EditDocumentPage({ params }: { params: { id: string } }) {
  const document = await prisma.document.findUnique({
    where: { id: params.id },
    include: { dossier: { select: { referenceInterne: true, clientId: true, client: { select: { raisonSociale: true } } } } },
  });

  if (!document) notFound();

  const canAccess = await serverCanAccessDossier(document.dossierId, "write");
  if (!canAccess) redirect("/cabinet/documents");

  const dossiers = await prisma.dossier.findMany({
    take: 200,
    orderBy: { referenceInterne: "asc" },
    select: { id: true, referenceInterne: true, client: { select: { raisonSociale: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Modifier le document</h1>
        <Link href="/cabinet/documents" className="text-sm text-cabinet-700 hover:underline">
          ← Retour aux documents
        </Link>
      </div>
      <DocumentEditForm document={document} dossiers={dossiers} />
    </div>
  );
}
