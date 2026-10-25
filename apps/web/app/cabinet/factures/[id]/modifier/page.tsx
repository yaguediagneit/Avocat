import { prisma } from "@/lib/prisma";
import { serverCanAccessDossier } from "@/lib/server-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { FactureEditForm } from "./facture-edit-form";

export default async function EditFacturePage({ params }: { params: { id: string } }) {
  const facture = await prisma.facture.findUnique({
    where: { id: params.id },
    include: { dossier: { select: { referenceInterne: true } }, client: { select: { raisonSociale: true } } },
  });

  if (!facture || !facture.dossierId) notFound();

  const canAccess = await serverCanAccessDossier(facture.dossierId, "write");
  if (!canAccess) redirect("/cabinet/factures");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Modifier la facture</h1>
        <Link href="/cabinet/factures" className="text-sm text-cabinet-700 hover:underline">
          ← Retour aux factures
        </Link>
      </div>
      <FactureEditForm facture={facture} />
    </div>
  );
}
