import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getServerDossierFilter, getServerAuth } from "@/lib/server-auth";
import { redirect } from "next/navigation";
import { WordFormClient } from "../../word-form-client";

export default async function WordFormPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { dossierId?: string; tacheId?: string };
}) {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const template = await prisma.tacheTemplate.findUnique({
    where: { id: params.id },
    include: {
      specialite: { select: { libelle: true } },
      workflowEtape: { select: { libelle: true } },
    },
  });

  if (!template) {
    redirect("/cabinet/parametrage");
  }

  // Récupérer les dossiers accessibles à l'utilisateur
  const accessFilter = await getServerDossierFilter();
  const dossiers = await prisma.dossier.findMany({
    where: accessFilter as any,
    select: {
      id: true,
      referenceInterne: true,
      typeAffaire: true,
      natureMission: true,
      client: { select: { raisonSociale: true } },
    },
    orderBy: { referenceInterne: "asc" },
    take: 200,
  });

  // Récupérer les tâches de ces dossiers
  const dossierIds = dossiers.map((d) => d.id);
  const taches = dossierIds.length > 0
    ? await prisma.tache.findMany({
        where: { dossierId: { in: dossierIds }, actif: true },
        select: {
          id: true,
          dossierId: true,
          titre: true,
          description: true,
          responsableId: true,
          dossier: {
            select: { avocatResponsableId: true, huissierResponsableId: true },
          },
        },
        orderBy: { titre: "asc" },
      })
    : [];

  const defaultDossier = searchParams?.dossierId
    ? dossiers.find((d) => d.id === searchParams.dossierId)
    : undefined;
  const requestedTache = searchParams?.tacheId
    ? taches.find((t) => t.id === searchParams.tacheId)
    : undefined;
  const auth = await getServerAuth();
  const canGenerateForTache =
    requestedTache &&
    (auth.estAdmin ||
      requestedTache.responsableId === session.userId ||
      requestedTache.dossier.avocatResponsableId === session.userId ||
      requestedTache.dossier.huissierResponsableId === session.userId);
  const defaultTache = canGenerateForTache ? requestedTache : undefined;

  return (
    <WordFormClient
      templateId={template.id}
      templateTitre={template.titre}
      hasWordTemplate={!!template.wordTemplateKey}
      defaultDossierId={searchParams?.dossierId}
      defaultTacheId={searchParams?.tacheId}
      defaultReference={defaultDossier?.referenceInterne}
      defaultSubject={defaultTache?.titre}
      dossiers={dossiers.map((d) => ({
        id: d.id,
        referenceInterne: d.referenceInterne,
        client: d.client?.raisonSociale || "",
        typeAffaire: d.typeAffaire,
      }))}
      taches={taches.map((t) => ({
        id: t.id,
        dossierId: t.dossierId,
        titre: t.titre,
      }))}
    />
  );
}
