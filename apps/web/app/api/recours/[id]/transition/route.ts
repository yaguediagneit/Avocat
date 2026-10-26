import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import {
  RECOURS_STATUTS,
  RECOURS_STATUT_LABELS,
  ISSUES_RECOURS,
  assertRecoursTransition,
  niveauForRecours,
} from "@/lib/recours";
import { syncRecoursNotifications } from "@/lib/recours-alertes";

const optionalDate = () =>
  z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.coerce.date().nullable().optional()
  );

const transitionSchema = z.object({
  statut: z.enum(RECOURS_STATUTS),
  // Actes de forme transmis avec la transition.
  dateDeclaration: optionalDate(),
  dateSignification: optionalDate(),
  dateConsignation: optionalDate(),
  dateMemoire: optionalDate(),
  juridictionCible: z.string().max(200).optional().nullable(),
  issue: z
    .enum(ISSUES_RECOURS.map((i) => i.code) as [string, ...string[]])
    .optional()
    .nullable(),
  note: z.string().max(5000).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const recours = await ctx.prisma.recours.findUnique({
    where: { id: params.id },
    include: { procedureOrigine: true },
  });
  if (!recours) {
    return NextResponse.json({ error: "Recours non trouvé" }, { status: 404 });
  }

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, recours.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = transitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const cible = data.statut;

    // Fusion des champs du payload avec l'existant pour vérifier les
    // exigences de l'état cible (ex. dateDeclaration pour DECLARE).
    const fusion = {
      ...recours,
      dateDeclaration: data.dateDeclaration ?? recours.dateDeclaration,
      dateSignification: data.dateSignification ?? recours.dateSignification,
      dateConsignation: data.dateConsignation ?? recours.dateConsignation,
      dateMemoire: data.dateMemoire ?? recours.dateMemoire,
      issue: data.issue ?? recours.issue,
    };

    const check = assertRecoursTransition(fusion, cible);
    if (!check.ok) {
      return NextResponse.json({ error: check.erreurs.join(" ") }, { status: 400 });
    }

    const update: Record<string, unknown> = { statut: cible };
    if (data.dateDeclaration !== undefined) update.dateDeclaration = data.dateDeclaration;
    if (data.dateSignification !== undefined) update.dateSignification = data.dateSignification;
    if (data.dateConsignation !== undefined) update.dateConsignation = data.dateConsignation;
    if (data.dateMemoire !== undefined) update.dateMemoire = data.dateMemoire;
    if (data.juridictionCible !== undefined) update.juridictionCible = data.juridictionCible;
    if (data.issue !== undefined) update.issue = data.issue;

    // Une fois déclaré/déposé, la date limite devient le point de départ
    // des délais internes (signification, mémoire…) — elle n'est plus
    // recalculée automatiquement.

    const updated = await ctx.prisma.recours.update({
      where: { id: params.id },
      data: update,
    });

    await ctx.prisma.recoursEvenement.create({
      data: {
        recoursId: recours.id,
        type: "TRANSITION",
        ancienStatut: recours.statut,
        nouveauStatut: cible,
        description:
          data.note?.trim() ||
          `${RECOURS_STATUT_LABELS[recours.statut]} → ${RECOURS_STATUT_LABELS[cible]}`,
        details: {
          dateDeclaration: data.dateDeclaration || undefined,
          dateSignification: data.dateSignification || undefined,
          dateConsignation: data.dateConsignation || undefined,
          dateMemoire: data.dateMemoire || undefined,
          issue: data.issue || undefined,
        },
        creePar: ctx.userId,
      },
    });

    // À l'enregistrement du recours au greffe : création automatique de
    // la procédure devant la juridiction du recours (Cour d'appel /
    // Cour suprême) et passage de la procédure d'origine à « transmis ».
    if (cible === "ENREGISTRE" && !recours.procedureCibleId) {
      const cibleProc = await ctx.prisma.procedure.create({
        data: {
          dossierId: recours.dossierId,
          niveau: niveauForRecours(recours.typeRecours),
          juridiction:
            updated.juridictionCible ||
            (recours.typeRecours === "pourvoi"
              ? "Cour suprême"
              : "Cour d'appel"),
          dateSaisine: updated.dateDeclaration ?? new Date(),
          statut: "EN_COURS",
          publieClient: recours.procedureOrigine.publieClient,
          creePar: ctx.userId,
        },
      });
      await ctx.prisma.recours.update({
        where: { id: recours.id },
        data: { procedureCibleId: cibleProc.id },
      });
      await ctx.prisma.procedure.update({
        where: { id: recours.procedureOrigineId },
        data: { statut: "TRANSMIS_RECOURS" },
      });
    }

    // Recours jugé / irrecevable / archivé : si aucun autre recours actif
    // ne pèse sur la procédure d'origine, elle devient définitive.
    if (["JUGE", "IRRECEVABLE", "ARCHIVE"].includes(cible)) {
      const actifs = await ctx.prisma.recours.count({
        where: {
          procedureOrigineId: recours.procedureOrigineId,
          id: { not: recours.id },
          statut: { notIn: ["JUGE", "IRRECEVABLE", "ARCHIVE"] },
        },
      });
      if (actifs === 0) {
        await ctx.prisma.procedure.update({
          where: { id: recours.procedureOrigineId },
          data: { statut: "DEFINITIF" },
        });
      }
    }

    // Rafraîchit les alertes de délai du dossier.
    await syncRecoursNotifications(ctx.prisma, recours.dossierId);

    await logAudit(ctx.prisma, ctx.userId, "recours_transition", "recours", recours.id, {
      dossierId: recours.dossierId,
      de: recours.statut,
      vers: cible,
    }, req);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Recours transition error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
