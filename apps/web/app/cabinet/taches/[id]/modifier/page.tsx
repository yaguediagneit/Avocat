import { prisma } from "@/lib/prisma";
import { getServerAuth, serverCanAccessDossier } from "@/lib/server-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { TacheEditForm } from "./tache-edit-form";

export default async function EditTachePage({ params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  const tache = await prisma.tache.findUnique({
    where: { id: params.id },
    include: {
      dossier: {
        select: {
          referenceInterne: true,
          avocatResponsableId: true,
          huissierResponsableId: true,
        },
      },
    },
  });

  if (!tache) notFound();

  const canAccess = await serverCanAccessDossier(tache.dossierId, "write");
  if (!canAccess) redirect("/cabinet/taches");

  // La modification est réservée à l'administrateur et au responsable du
  // dossier (avocat / huissier).
  const canEditTask =
    auth.estAdmin ||
    tache.dossier.avocatResponsableId === auth.userId ||
    tache.dossier.huissierResponsableId === auth.userId;
  if (!canEditTask) redirect("/cabinet/taches");

  const [dossiers, users] = await Promise.all([
    prisma.dossier.findMany({
      take: 200,
      orderBy: { referenceInterne: "asc" },
      select: { id: true, referenceInterne: true, client: { select: { raisonSociale: true } } },
    }),
    prisma.user.findMany({
      where: { actif: true, clientId: null, role: { estClient: false } },
      take: 200,
      select: { id: true, prenom: true, nom: true, titre: true },
      orderBy: { nom: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Modifier la tâche</h1>
        <Link href="/cabinet/taches" className="text-sm text-cabinet-700 hover:underline">
          ← Retour aux tâches
        </Link>
      </div>
      <TacheEditForm tache={tache} dossiers={dossiers} users={users} currentUserId={auth.userId} />
    </div>
  );
}
