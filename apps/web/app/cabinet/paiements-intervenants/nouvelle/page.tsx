import { prisma } from "@/lib/prisma";
import {
  getServerDossierFilter,
  getServerDossierScopedFilter,
  serverHasPermission,
} from "@/lib/server-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PaiementForm } from "./paiement-form";

export default async function NewPaiementIntervenantPage() {
  if (!(await serverHasPermission("comptabilite", "write"))) {
    redirect("/cabinet");
  }

  const [dossierFilter, tacheFilter, missionFilter] = await Promise.all([
    getServerDossierFilter(),
    getServerDossierScopedFilter("taches"),
    getServerDossierScopedFilter("missions"),
  ]);

  const [rawDossiers, rawTaches, rawMissions, tvaRates] = await Promise.all([
    prisma.dossier.findMany({
      where: dossierFilter,
      take: 200,
      orderBy: { referenceInterne: "asc" },
      select: {
        id: true,
        referenceInterne: true,
        clientId: true,
        avocatResponsableId: true,
        huissierResponsableId: true,
        createurId: true,
        client: { select: { raisonSociale: true } },
        collaborateursRACI: { select: { userId: true } },
      },
    }),
    prisma.tache.findMany({
      where: tacheFilter,
      take: 200,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        titre: true,
        dossierId: true,
        responsableId: true,
        dossier: { select: { referenceInterne: true } },
      },
    }),
    Promise.all([
      prisma.missionHuissier.findMany({
        where: missionFilter,
        take: 200,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          typeActe: true,
          dossierId: true,
          huissierId: true,
          dossier: { select: { referenceInterne: true } },
        },
      }),
      prisma.missionArchitecte.findMany({
        where: missionFilter,
        take: 200,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          typeActe: true,
          dossierId: true,
          architecteId: true,
          dossier: { select: { referenceInterne: true } },
        },
      }),
      prisma.missionConseillerJuridique.findMany({
        where: missionFilter,
        take: 200,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          typeActe: true,
          dossierId: true,
          conseillerJuridiqueId: true,
          dossier: { select: { referenceInterne: true } },
        },
      }),
      prisma.missionClerc.findMany({
        where: missionFilter,
        take: 200,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          typeActe: true,
          dossierId: true,
          clercId: true,
          dossier: { select: { referenceInterne: true } },
        },
      }),
    ]).then(([huissiers, architectes, conseillers, clercs]) => [
      ...huissiers.map((m) => ({ ...m, type: "huissier" as const, typeLabel: "Huissier", intervenantId: m.huissierId })),
      ...architectes.map((m) => ({ ...m, type: "architecte" as const, typeLabel: "Architecte", intervenantId: m.architecteId })),
      ...conseillers.map((m) => ({ ...m, type: "conseiller_juridique" as const, typeLabel: "Conseiller Juridique", intervenantId: m.conseillerJuridiqueId })),
      ...clercs.map((m) => ({ ...m, type: "clerc" as const, typeLabel: "Clerc", intervenantId: m.clercId })),
    ]),
    prisma.tvaRate.findMany({
      where: { isActive: true },
      orderBy: { rate: "asc" },
    }),
  ]);

  const userIdsByDossier = new Map<string, Set<string>>();
  const addDossierUser = (dossierId: string, userId: string | null | undefined) => {
    if (!userId) return;
    const set = userIdsByDossier.get(dossierId) ?? new Set<string>();
    set.add(userId);
    userIdsByDossier.set(dossierId, set);
  };
  for (const t of rawTaches) addDossierUser(t.dossierId, t.responsableId);
  for (const m of rawMissions) addDossierUser(m.dossierId, m.intervenantId);

  const dossiers = rawDossiers.map((d) => ({
    id: d.id,
    referenceInterne: d.referenceInterne,
    clientId: d.clientId,
    client: d.client,
    associatedUserIds: Array.from(
      new Set([
        d.avocatResponsableId,
        d.huissierResponsableId,
        d.createurId,
        ...d.collaborateursRACI.map((c) => c.userId),
        ...(userIdsByDossier.get(d.id) ?? new Set()),
      ].filter((id): id is string => Boolean(id)))
    ),
  }));

  const taches = rawTaches.map((t) => ({
    id: t.id,
    titre: t.titre,
    dossierId: t.dossierId,
    responsableId: t.responsableId,
    dossier: t.dossier,
  }));

  const missions = rawMissions.map((m) => ({
    id: m.id,
    type: m.type,
    typeLabel: m.typeLabel,
    typeActe: m.typeActe,
    dossierId: m.dossierId,
    intervenantId: m.intervenantId,
    dossier: m.dossier,
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Paiement intervenant externe</h1>
        <Link href="/cabinet/paiements-intervenants" className="text-sm text-cabinet-700 hover:underline">
          ← Retour aux paiements
        </Link>
      </div>
      <PaiementForm dossiers={dossiers} taches={taches} missions={missions} tvaRates={tvaRates} />
    </div>
  );
}
