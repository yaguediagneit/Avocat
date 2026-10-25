import { getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { tableSearchWhere } from "@/lib/search";
import { DemandeursClient } from "./demandeurs-client";

export default async function DemandeursPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const auth = await getServerAuth();
  const canWrite = auth.estAdmin || hasPermission(auth.role, "demarches", "write");
  if (!auth.estAdmin && !hasPermission(auth.role, "demarches", "read")) {
    redirect("/cabinet/dossiers/demarches");
  }

  const [demandeurs, clients] = await Promise.all([
    auth.prisma.demandeur.findMany({
      where: tableSearchWhere(searchParams.q || "", [
        "nom",
        "prenoms",
        "raisonSociale",
        "commune",
        "telephone",
        "email",
        "pieceIdentiteNumero",
        "ninea",
        "rccm",
        "client.raisonSociale",
      ]),
      include: { client: { select: { id: true, raisonSociale: true } } },
      orderBy: { nom: "asc" },
      take: 500,
    }),
    auth.prisma.client.findMany({
      where: { actif: true },
      select: { id: true, raisonSociale: true },
      orderBy: { raisonSociale: "asc" },
      take: 500,
    }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Demandeurs</h1>
      <p className="text-sm text-gray-500">
        Fiches réutilisables (personnes physiques et morales) — héritiers, mandants,
        bénéficiaires réels, représentants. Un demandeur peut être lié à un client du cabinet.
        Le mandat / procuration est suivi dans chaque fiche.
      </p>
      <DemandeursClient
        demandeurs={JSON.parse(JSON.stringify(demandeurs))}
        clients={JSON.parse(JSON.stringify(clients))}
        canWrite={canWrite}
      />
    </div>
  );
}
