import { getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { tableSearchWhere } from "@/lib/search";
import { ParcellesClient } from "./parcelles-client";

export default async function ParcellesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const auth = await getServerAuth();
  const canWrite = auth.estAdmin || hasPermission(auth.role, "demarches", "write");
  if (!auth.estAdmin && !hasPermission(auth.role, "demarches", "read")) {
    redirect("/cabinet/dossiers/demarches");
  }

  const parcelles = await auth.prisma.parcelle.findMany({
    where: tableSearchWhere(searchParams.q || "", [
      "nicad",
      "titreFoncier",
      "referenceDroit",
      "commune",
      "quartier",
      "departement",
      "region",
      "adresse",
      "numeroParcelle",
    ]),
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Parcelles & biens</h1>
      <p className="text-sm text-gray-500">
        Fiches parcelles réutilisables : références cadastrales, NICAD, titre foncier,
        droits d'occupation, charges et état de vérification.
      </p>
      <ParcellesClient parcelles={JSON.parse(JSON.stringify(parcelles))} canWrite={canWrite} />
    </div>
  );
}
