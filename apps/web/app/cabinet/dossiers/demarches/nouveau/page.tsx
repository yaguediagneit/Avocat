import { getServerAuth, getServerDossierFilter } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { DemarcheWizard } from "./demarche-wizard";

export default async function NouvelleDemarchePage({
  searchParams,
}: {
  searchParams: {
    dossierId?: string;
    objet?: string;
    demandeurNom?: string;
    demandeurTel?: string;
    demandeurEmail?: string;
    clientId?: string;
    origine?: string;
  };
}) {
  const auth = await getServerAuth();
  if (!auth.estAdmin && !hasPermission(auth.role, "demarches", "write")) {
    redirect("/cabinet/dossiers/demarches");
  }

  const dossierFilter = await getServerDossierFilter();

  const [types, demandeurs, parcelles, autorites, dossiers, users] = await Promise.all([
    auth.prisma.demarcheType.findMany({
      where: { actif: true },
      include: { pieces: { where: { actif: true }, orderBy: { ordre: "asc" } } },
      orderBy: { ordre: "asc" },
    }),
    auth.prisma.demandeur.findMany({
      include: { client: { select: { id: true, raisonSociale: true } } },
      orderBy: { nom: "asc" },
      take: 300,
    }),
    auth.prisma.parcelle.findMany({ orderBy: { updatedAt: "desc" }, take: 300 }),
    auth.prisma.demarcheAutorite.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    auth.prisma.dossier.findMany({
      where: { ...dossierFilter, actif: true },
      select: {
        id: true,
        referenceInterne: true,
        typeAffaire: true,
        client: { select: { id: true, raisonSociale: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    auth.prisma.user.findMany({
      where: { actif: true },
      select: { id: true, prenom: true, nom: true, role: { select: { nom: true } } },
      orderBy: { nom: "asc" },
    }),
  ]);

  // Pré-remplissage : depuis un dossier (« + Ajouter » de la fiche dossier)
  // ou une demande client (« Convertir en démarche »).
  const initial = {
    dossierId: dossiers.some((d) => d.id === searchParams.dossierId) ? searchParams.dossierId! : "",
    objet: searchParams.objet || "",
    demandeurNom: searchParams.demandeurNom || "",
    demandeurTel: searchParams.demandeurTel || "",
    demandeurEmail: searchParams.demandeurEmail || "",
    clientId: searchParams.clientId || "",
    origine: searchParams.origine || "",
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nouvelle démarche administrative</h1>
      <p className="text-sm text-gray-500">
        Assistant guidé : démarche → demandeur → bien → circuit → validation.
        Les démarches ambiguës exigent une qualification complète avant dépôt.
      </p>
      <DemarcheWizard
        types={JSON.parse(JSON.stringify(types))}
        demandeurs={JSON.parse(JSON.stringify(demandeurs))}
        parcelles={JSON.parse(JSON.stringify(parcelles))}
        autorites={JSON.parse(JSON.stringify(autorites))}
        dossiers={JSON.parse(JSON.stringify(dossiers))}
        users={JSON.parse(JSON.stringify(users))}
        initial={initial}
      />
    </div>
  );
}
