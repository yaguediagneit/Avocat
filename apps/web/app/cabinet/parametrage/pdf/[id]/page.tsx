import { prisma, publicPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getServerDossierFilter, getServerAuth } from "@/lib/server-auth";
import { redirect } from "next/navigation";
import { PdfFormClient } from "../../pdf-form-client";

export default async function PdfFormPage({
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

  // Récupérer les missions huissier de ces dossiers
  const missions = dossierIds.length > 0
    ? await prisma.missionHuissier.findMany({
        where: { dossierId: { in: dossierIds } },
        select: { id: true, dossierId: true, typeActe: true },
        orderBy: { typeActe: "asc" },
      })
    : [];

  const defaultDossier = searchParams?.dossierId
    ? dossiers.find((d) => d.id === searchParams.dossierId)
    : undefined;
  // La génération depuis une tâche est réservée à l'affectataire, à l'admin
  // et au responsable du dossier (avocat / huissier).
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

  // Informations pour le pré-remplissage des champs du modèle de document.
  const [tenant, currentUser] = await Promise.all([
    publicPrisma.tenant.findUnique({ where: { id: session.tenantId } }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { prenom: true, nom: true, titre: true },
    }),
  ]);
  const tenantConfig =
    (tenant?.configuration as Record<string, unknown> | null) || {};

  return (
    <PdfFormClient
      defaultDossierId={searchParams?.dossierId}
      defaultTacheId={searchParams?.tacheId}
      defaultReference={defaultDossier?.referenceInterne}
      defaultRecipient={defaultDossier?.client?.raisonSociale}
      defaultSubject={defaultTache?.titre}
      defaultBody={defaultTache?.description}
      template={{
        id: template.id,
        titre: template.titre,
        description: template.description,
        contenuDocument: template.contenuDocument,
        specialite: template.specialite
          ? { libelle: template.specialite.libelle }
          : null,
        workflowEtape: template.workflowEtape
          ? { libelle: template.workflowEtape.libelle }
          : null,
        delaiJours: template.delaiJours,
        roleAttendu: template.roleAttendu,
        priorite: template.priorite,
      }}
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
      missions={missions.map((m) => ({
        id: m.id,
        dossierId: m.dossierId,
        typeActe: m.typeActe,
      }))}
      cabinet={{
        raisonSociale: tenant?.raisonSociale,
        adresse: tenant?.adresse ?? undefined,
        telephone: String(tenantConfig.telephonePrincipal ?? ""),
        email: String(tenantConfig.email ?? ""),
        siteWeb: String(tenantConfig.siteWeb ?? ""),
      }}
      user={{
        prenom: currentUser?.prenom,
        nom: currentUser?.nom,
        titre: currentUser?.titre ?? undefined,
      }}
    />
  );
}
