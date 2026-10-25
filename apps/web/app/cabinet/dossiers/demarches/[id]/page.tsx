import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerAuth, serverCanAccessDossier } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { DemarcheDetailClient } from "./demarche-detail-client";

export default async function DemarcheDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const auth = await getServerAuth();
  const canWrite = auth.estAdmin || hasPermission(auth.role, "demarches", "write");
  const canValidate = auth.estAdmin || hasPermission(auth.role, "demarches", "validate");

  const demarche = await auth.prisma.demarche.findUnique({
    where: { id: params.id },
    include: {
      type: { include: { pieces: { where: { actif: true }, orderBy: { ordre: "asc" } } } },
      dossier: { select: { id: true, referenceInterne: true, statut: true, client: { select: { id: true, raisonSociale: true } } } },
      demandeur: { include: { client: { select: { id: true, raisonSociale: true } } } },
      mandataire: { include: { client: { select: { id: true, raisonSociale: true } } } },
      parcelle: true,
      autorite: true,
      pieces: { orderBy: { ordre: "asc" } },
      parties: { include: { demandeur: true }, orderBy: { ordre: "asc" } },
      evenements: { orderBy: { date: "desc" }, take: 200 },
      frais: { orderBy: { date: "desc" } },
    },
  });
  if (!demarche) return notFound();

  const ok = await serverCanAccessDossier(demarche.dossierId, "read");
  if (!ok) redirect("/cabinet/dossiers/demarches");

  const [documents, modeles, autorites, demandeurs, parcelles, users, validePar] =
    await Promise.all([
      auth.prisma.document.findMany({
        where: { dossierId: demarche.dossierId, actif: true },
        select: { id: true, nom: true, categorie: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      auth.prisma.demarcheModele.findMany({
        where: { actif: true, OR: [{ typeId: demarche.typeId }, { typeId: null }] },
        orderBy: { ordre: "asc" },
      }),
      auth.prisma.demarcheAutorite.findMany({
        where: { actif: true },
        orderBy: { nom: "asc" },
      }),
      auth.prisma.demandeur.findMany({ orderBy: { nom: "asc" }, take: 300 }),
      auth.prisma.parcelle.findMany({ orderBy: { updatedAt: "desc" }, take: 300 }),
      auth.prisma.user.findMany({
        where: { actif: true },
        select: { id: true, prenom: true, nom: true, role: { select: { nom: true } } },
        orderBy: { nom: "asc" },
      }),
      demarche.valideParId
        ? auth.prisma.user.findUnique({
            where: { id: demarche.valideParId },
            select: { prenom: true, nom: true },
          })
        : null,
    ]);

  const userNames = Object.fromEntries(users.map((u) => [u.id, `${u.prenom} ${u.nom}`]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/cabinet/dossiers/demarches" className="text-sm text-cabinet-700 hover:underline">
          ← Démarches
        </Link>
      </div>
      <DemarcheDetailClient
        demarche={JSON.parse(JSON.stringify(demarche))}
        documents={JSON.parse(JSON.stringify(documents))}
        modeles={JSON.parse(JSON.stringify(modeles))}
        autorites={JSON.parse(JSON.stringify(autorites))}
        demandeurs={JSON.parse(JSON.stringify(demandeurs))}
        parcelles={JSON.parse(JSON.stringify(parcelles))}
        users={JSON.parse(JSON.stringify(users))}
        userNames={userNames}
        canWrite={canWrite}
        canValidate={canValidate}
        valideParNom={validePar ? `${validePar.prenom} ${validePar.nom}` : null}
      />
    </div>
  );
}
