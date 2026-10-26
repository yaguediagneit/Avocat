/**
 * Alertes de délais de recours : génère des `Notification` pour les
 * recours dont le délai court encore (avant déclaration), aux jalons
 * J-15, J-7, J-3, J-1, J0 et dès que le délai est dépassé.
 *
 * Appelée depuis `/api/notifications` (génération périodique) et après
 * chaque changement de recours pour rafraîchir l'état.
 */
import { PrismaClient } from "@prisma/client";
import {
  RECOURS_STATUTS_DELAI_ACTIF,
  TYPE_RECOURS_LABELS,
  joursRestants,
} from "./recours";

const JALONS = [15, 7, 3, 1, 0];

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function syncRecoursNotifications(
  prisma: PrismaClient,
  dossierId?: string
): Promise<number> {
  const maintenant = new Date();
  const horizon = addDays(maintenant, 16);

  const recours = await prisma.recours.findMany({
    where: {
      ...(dossierId ? { dossierId } : {}),
      statut: { in: RECOURS_STATUTS_DELAI_ACTIF },
      dateLimite: { not: null, lte: horizon },
    },
    include: {
      dossier: {
        select: { referenceInterne: true, avocatResponsableId: true },
      },
    },
  });

  let creees = 0;
  for (const r of recours) {
    if (!r.dateLimite) continue;
    const destinataire = r.avocatId || r.dossier.avocatResponsableId;
    if (!destinataire) continue;

    const restants = joursRestants(r.dateLimite, maintenant);
    const typeRecours = TYPE_RECOURS_LABELS[r.typeRecours] || r.typeRecours;
    const reference = r.dossier.referenceInterne;

    // Délai dépassé : alerte critique unique par jour.
    if (restants < 0) {
      const type = `delai_recours_depasse_${r.id}`;
      const existe = await prisma.notification.findFirst({
        where: {
          userId: destinataire,
          type,
          dateDeclenchement: { gte: addDays(maintenant, -1) },
        },
      });
      if (!existe) {
        await prisma.notification.create({
          data: {
            userId: destinataire,
            dossierId: r.dossierId,
            type,
            titre: `DÉLAI DÉPASSÉ — ${typeRecours} (${reference})`,
            message: `Le délai de ${typeRecours.toLowerCase()} du dossier ${reference} est dépassé depuis ${Math.abs(restants)} jour(s) (limite : ${r.dateLimite.toLocaleDateString("fr-FR")}). Recours non déclaré.`,
            severite: "urgent",
          },
        });
        creees++;
      }
      continue;
    }

    if (!JALONS.includes(restants)) continue;
    const type = `delai_recours_${r.id}_J${restants}`;
    const existe = await prisma.notification.findFirst({
      where: { userId: destinataire, type },
    });
    if (existe) continue;

    await prisma.notification.create({
      data: {
        userId: destinataire,
        dossierId: r.dossierId,
        type,
        titre:
          restants === 0
            ? `Dernier jour — ${typeRecours} (${reference})`
            : `J-${restants} — ${typeRecours} (${reference})`,
        message:
          restants === 0
            ? `Le délai de ${typeRecours.toLowerCase()} du dossier ${reference} expire aujourd'hui.`
            : `Le délai de ${typeRecours.toLowerCase()} du dossier ${reference} expire le ${r.dateLimite.toLocaleDateString("fr-FR")} (${restants} jour(s) restant).`,
        severite: restants <= 1 ? "urgent" : restants <= 3 ? "warning" : "info",
      },
    });
    creees++;
  }
  return creees;
}
