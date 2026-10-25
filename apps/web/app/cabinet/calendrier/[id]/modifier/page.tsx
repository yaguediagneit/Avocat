import { prisma } from "@/lib/prisma";
import { getServerAuth, serverCanAccessDossier } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { EvenementEditForm } from "./evenement-edit-form";

export default async function EditEvenementPage({ params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  const evenement = await prisma.evenement.findUnique({
    where: { id: params.id },
    include: { dossier: { select: { referenceInterne: true } } },
  });

  if (!evenement) notFound();

  const canAccess = evenement.dossierId
    ? await serverCanAccessDossier(evenement.dossierId, "write")
    : hasPermission(auth.role, "rendezVous", "write");
  if (!canAccess) redirect("/cabinet/calendrier");

  const dossiers = await prisma.dossier.findMany({
    take: 200,
    orderBy: { referenceInterne: "asc" },
    select: { id: true, referenceInterne: true, client: { select: { raisonSociale: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Modifier l&apos;événement</h1>
        <Link href="/cabinet/calendrier" className="text-sm text-cabinet-700 hover:underline">
          ← Retour au calendrier
        </Link>
      </div>
      <EvenementEditForm evenement={evenement} dossiers={dossiers} />
    </div>
  );
}
