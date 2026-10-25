import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { EvenementForm } from "./evenement-form";

export default async function NewEvenementPage({
  searchParams,
}: {
  searchParams?: { dossierId?: string };
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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nouvel événement</h1>
        <Link href="/cabinet/calendrier" className="text-sm text-cabinet-700 hover:underline">
          ← Retour au calendrier
        </Link>
      </div>
      <EvenementForm dossiers={dossiers} defaultDossierId={searchParams?.dossierId} />
    </div>
  );
}
