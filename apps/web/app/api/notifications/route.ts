import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { syncRecoursNotifications } from "@/lib/recours-alertes";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "dossiers", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const nonLues = searchParams.get("nonLues") === "true";

  const where: Record<string, unknown> = { userId: ctx.userId };
  if (nonLues) {
    where.lu = false;
  }

  const notifications = await ctx.prisma.notification.findMany({
    where,
    orderBy: { dateDeclenchement: "desc" },
    take: 100,
  });

  return NextResponse.json(notifications);
}

/// POST : génère les notifications de rappel (J-7, J-3, J-1) à partir des échéances
export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const maintenant = new Date();
    const dans7jours = addDays(maintenant, 7);

    // Récupère toutes les tâches et événements à venir dans les 7 prochains jours
    const [taches, evenements] = await Promise.all([
      ctx.prisma.tache.findMany({
        where: {
          echeance: { lte: dans7jours, gte: maintenant },
          statut: { notIn: ["Terminée", "Annulée"] },
        },
        include: { dossier: { select: { id: true, referenceInterne: true } } },
      }),
      ctx.prisma.evenement.findMany({
        where: {
          dateDebut: { lte: dans7jours, gte: maintenant },
        },
        include: { dossier: { select: { id: true, referenceInterne: true } } },
      }),
    ]);

    const rappels = [7, 3, 1]; // J-7, J-3, J-1
    const notificationsCreees: { type: string; titre: string }[] = [];

    for (const tache of taches) {
      if (!tache.echeance) continue;
      const joursRestants = Math.ceil(
        (tache.echeance.getTime() - maintenant.getTime()) / 86400000
      );

      if (rappels.includes(joursRestants)) {
        // Vérifie si une notification existe déjà pour cette tâche et ce délai
        const existe = await ctx.prisma.notification.findFirst({
          where: {
            userId: tache.responsableId,
            dossierId: tache.dossierId,
            type: `rappel_tache_J${joursRestants}`,
            dateDeclenchement: { gte: addDays(maintenant, -1) },
          },
        });

        if (!existe) {
          await ctx.prisma.notification.create({
            data: {
              userId: tache.responsableId,
              dossierId: tache.dossierId,
              type: `rappel_tache_J${joursRestants}`,
              titre: `Échéance J-${joursRestants} : ${tache.titre}`,
              message: `La tâche « ${tache.titre} » du dossier ${tache.dossier.referenceInterne} arrive à échéance dans ${joursRestants} jour(s).`,
              severite: joursRestants <= 1 ? "urgent" : joursRestants <= 3 ? "warning" : "info",
            },
          });
          notificationsCreees.push({
            type: `rappel_tache_J${joursRestants}`,
            titre: tache.titre,
          });
        }
      }
    }

    for (const evt of evenements) {
      const joursRestants = Math.ceil(
        (evt.dateDebut.getTime() - maintenant.getTime()) / 86400000
      );

      if (rappels.includes(joursRestants) && evt.dossierId) {
        // Notifie l'avocat responsable du dossier
        const dossier = await ctx.prisma.dossier.findUnique({
          where: { id: evt.dossierId },
          select: { avocatResponsableId: true },
        });

        if (!dossier) continue;

        const existe = await ctx.prisma.notification.findFirst({
          where: {
            userId: dossier.avocatResponsableId,
            dossierId: evt.dossierId,
            type: `rappel_evenement_J${joursRestants}`,
            dateDeclenchement: { gte: addDays(maintenant, -1) },
          },
        });

        if (!existe) {
          await ctx.prisma.notification.create({
            data: {
              userId: dossier.avocatResponsableId,
              dossierId: evt.dossierId,
              type: `rappel_evenement_J${joursRestants}`,
              titre: `Événement J-${joursRestants} : ${evt.titre}`,
              message: `L'événement « ${evt.titre} » du dossier ${evt.dossier?.referenceInterne ?? "N/A"} a lieu dans ${joursRestants} jour(s).`,
              severite: joursRestants <= 1 ? "urgent" : joursRestants <= 3 ? "warning" : "info",
            },
          });
          notificationsCreees.push({
            type: `rappel_evenement_J${joursRestants}`,
            titre: evt.titre,
          });
        }
      }
    }

    // Alertes sur les délais de recours (appel, pourvoi…) en cours.
    const alertesRecours = await syncRecoursNotifications(ctx.prisma);

    return NextResponse.json({
      generees: notificationsCreees.length + alertesRecours,
      notifications: notificationsCreees,
      alertesRecours,
    });
  } catch (error) {
    console.error("Generate notifications error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
