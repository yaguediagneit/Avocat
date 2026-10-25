import { getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { DemarchesParametrage } from "./parametrage-client";

export default async function DemarchesParametragePage() {
  const auth = await getServerAuth();
  const canWrite = auth.estAdmin || hasPermission(auth.role, "demarches", "write");
  if (!canWrite) redirect("/cabinet/dossiers/demarches");

  const [types, autorites, modeles] = await Promise.all([
    auth.prisma.demarcheType.findMany({
      include: { pieces: { orderBy: { ordre: "asc" } } },
      orderBy: { ordre: "asc" },
    }),
    auth.prisma.demarcheAutorite.findMany({ orderBy: [{ typeAutorite: "asc" }, { nom: "asc" }] }),
    auth.prisma.demarcheModele.findMany({
      include: { type: { select: { code: true, libelle: true } } },
      orderBy: [{ ordre: "asc" }, { titre: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Paramétrage des démarches administratives</h1>
      <p className="text-sm text-gray-500">
        Catalogue des démarches, check-lists de pièces, autorités compétentes et modèles de documents.
        Les listes de pièces doivent être revalidées périodiquement par un avocat, un fiscaliste
        ou — pour les dossiers fonciers complexes — un notaire, un géomètre ou un interlocuteur administratif.
      </p>
      <DemarchesParametrage
        types={JSON.parse(JSON.stringify(types))}
        autorites={JSON.parse(JSON.stringify(autorites))}
        modeles={JSON.parse(JSON.stringify(modeles))}
      />
    </div>
  );
}
