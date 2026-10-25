import { getServerAuth, getServerDossierFilter } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { TransactionWizard } from "./transaction-wizard";

export default async function NouvelleTransactionPage({
  searchParams,
}: {
  searchParams: {
    dossierId?: string;
    typeCode?: string;
    objet?: string;
    origine?: string;
  };
}) {
  const auth = await getServerAuth();
  if (!auth.estAdmin && !hasPermission(auth.role, "transactions", "write")) {
    redirect("/cabinet/dossiers/transactions");
  }

  const dossierFilter = await getServerDossierFilter();

  const [types, dossiers, biens, demandeurs, users] = await Promise.all([
    auth.prisma.transactionType.findMany({
      where: { actif: true },
      include: { pieces: { where: { actif: true }, orderBy: { ordre: "asc" } } },
      orderBy: { ordre: "asc" },
    }),
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
    auth.prisma.bien.findMany({
      select: {
        id: true,
        designation: true,
        nature: true,
        commune: true,
        typeDroit: true,
        referenceDroit: true,
        parcelleId: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    auth.prisma.demandeur.findMany({
      include: { client: { select: { id: true, raisonSociale: true } } },
      orderBy: { nom: "asc" },
      take: 300,
    }),
    auth.prisma.user.findMany({
      where: { actif: true },
      select: { id: true, prenom: true, nom: true, role: { select: { nom: true } } },
      orderBy: { nom: "asc" },
    }),
  ]);

  const initial = {
    dossierId: dossiers.some((d) => d.id === searchParams.dossierId) ? searchParams.dossierId! : "",
    typeCode: searchParams.typeCode || "",
    objet: searchParams.objet || "",
    origine: searchParams.origine || "",
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nouvelle transaction</h1>
      <p className="text-sm text-gray-500">
        Assistant : type → dossier → parties → bien → conditions. Le cabinet
        intervient comme conseil et intermédiaire ; pour un immeuble sous titre
        foncier, la mutation est achevée par le notaire puis la Conservation.
      </p>
      <TransactionWizard
        types={JSON.parse(JSON.stringify(types))}
        dossiers={JSON.parse(JSON.stringify(dossiers))}
        biens={JSON.parse(JSON.stringify(biens))}
        demandeurs={JSON.parse(JSON.stringify(demandeurs))}
        users={JSON.parse(JSON.stringify(users))}
        initial={initial}
      />
    </div>
  );
}
