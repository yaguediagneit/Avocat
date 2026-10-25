import { prisma } from "@/lib/prisma";
import { getServerDossierScopedFilter, getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import { CalendrierClient, CalendarEvent } from "./calendrier-client";
import { IcalButton } from "./ical-button";

export default async function CalendrierPage() {
  const auth = await getServerAuth();
  const accessFilterRendezVous = await getServerDossierScopedFilter("rendezVous");
  const accessFilterTaches = await getServerDossierScopedFilter("taches");

  const baseWhereEvenement: Prisma.EvenementWhereInput =
    Object.keys(accessFilterRendezVous).length === 0
      ? {}
      : { OR: [{ dossierId: null }, accessFilterRendezVous] };

  const [evenements, taches] = await Promise.all([
    prisma.evenement.findMany({
      where: baseWhereEvenement,
      take: 1000,
      orderBy: { dateDebut: "asc" },
      include: { dossier: { select: { referenceInterne: true } } },
    }),
    prisma.tache.findMany({
      where: {
        ...(accessFilterTaches as any),
        echeance: { not: null },
      },
      take: 1000,
      orderBy: { echeance: "asc" },
      include: { dossier: { select: { referenceInterne: true } } },
    }),
  ]);

  const canWrite = hasPermission(auth.role, "rendezVous", "write");

  const events: CalendarEvent[] = evenements.map((e) => ({
    id: e.id,
    kind: "evenement",
    type: e.type,
    titre: e.titre,
    dateDebut: e.dateDebut.toISOString(),
    dateFin: e.dateFin ? e.dateFin.toISOString() : null,
    lieu: e.lieu,
    dossierId: e.dossierId,
    dossier: e.dossier,
    estPublicClient: e.estPublicClient,
    nbCommentaires: Array.isArray(e.commentaires) ? e.commentaires.length : 0,
  }));

  const tacheEvents: CalendarEvent[] = taches.map((t) => ({
    id: t.id,
    kind: "tache",
    type: "tache",
    statut: t.statut,
    priorite: t.priorite,
    titre: t.titre,
    dateDebut: t.echeance!.toISOString(),
    dateFin: null,
    lieu: null,
    dossierId: t.dossierId,
    dossier: t.dossier,
    estPublicClient: false,
    nbCommentaires: Array.isArray(t.commentaires) ? t.commentaires.length : 0,
  }));

  const combined = [...events, ...tacheEvents].sort(
    (a, b) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Calendrier</h1>
        <div className="flex items-center gap-3">
          <IcalButton />
          {canWrite && (
            <Link href="/cabinet/calendrier/nouveau" className="btn-primary">
              + Nouvel événement
            </Link>
          )}
        </div>
      </div>

      <CalendrierClient
        evenements={combined}
        currentUserId={auth.userId}
        estAdmin={auth.estAdmin}
      />
    </div>
  );
}
