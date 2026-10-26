import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import {
  assertProcedureTransition,
  computeDateLimite,
  TYPES_DECISION,
  SENS_DECISION,
  RECOURS_STATUTS_DELAI_ACTIF,
} from "@/lib/recours";

const optionalDate = () =>
  z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.coerce.date().nullable().optional()
  );

const procedureUpdateSchema = z
  .object({
    juridiction: z.string().min(1).max(200),
    chambre: z.string().max(150).nullable(),
    greffe: z.string().max(150).nullable(),
    referenceRg: z.string().max(80).nullable(),
    dateSaisine: optionalDate(),
    datePrononce: optionalDate(),
    dateSignification: optionalDate(),
    typeDecision: z
      .enum(TYPES_DECISION.map((t) => t.code) as [string, ...string[]])
      .nullable(),
    decision: z.string().max(20000).nullable(),
    sensDecision: z.enum(SENS_DECISION.map((s) => s.code) as [string, ...string[]]),
    statut: z.string(),
    publieClient: z.boolean(),
    notes: z.string().max(5000).nullable(),
  })
  .partial();

/// Après mise à jour des dates de la procédure, recalcule la date limite
/// des recours encore dans leur délai (point de départ prononcé ou
/// signification selon le recours).
async function resyncRecoursDelais(prisma: any, procedureId: string) {
  const procedure = await prisma.procedure.findUnique({
    where: { id: procedureId },
    select: { datePrononce: true, dateSignification: true },
  });
  if (!procedure) return;
  const recours = await prisma.recours.findMany({
    where: {
      procedureOrigineId: procedureId,
      statut: { in: RECOURS_STATUTS_DELAI_ACTIF },
    },
  });
  for (const r of recours) {
    if (!r.delaiJours) continue;
    const ref =
      r.pointDepart === "prononce"
        ? (procedure.datePrononce ?? procedure.dateSignification)
        : (procedure.dateSignification ?? procedure.datePrononce);
    if (!ref) continue;
    await prisma.recours.update({
      where: { id: r.id },
      data: { dateReference: ref, dateLimite: computeDateLimite(ref, r.delaiJours) },
    });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const procedure = await ctx.prisma.procedure.findUnique({ where: { id: params.id } });
  if (!procedure) {
    return NextResponse.json({ error: "Procédure non trouvée" }, { status: 404 });
  }

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, procedure.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = procedureUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    if (data.statut && data.statut !== procedure.statut) {
      const check = assertProcedureTransition(procedure.statut, data.statut);
      if (!check.ok) {
        return NextResponse.json({ error: check.erreurs.join(" ") }, { status: 400 });
      }
    }
    if (data.statut === "DECISION_RENDUE" && !(data.datePrononce ?? procedure.datePrononce)) {
      return NextResponse.json(
        { error: "Date de prononcé obligatoire pour marquer la décision rendue." },
        { status: 400 }
      );
    }
    if (data.statut === "DECISION_SIGNIFIEE" && !(data.dateSignification ?? procedure.dateSignification)) {
      return NextResponse.json(
        { error: "Date de signification obligatoire." },
        { status: 400 }
      );
    }

    const updated = await ctx.prisma.procedure.update({
      where: { id: params.id },
      data,
    });

    // Journalise les jalons (décision rendue / signifiée, changement de statut).
    const evenements: { type: string; description: string; date: Date }[] = [];
    if (data.datePrononce && data.datePrononce.getTime() !== procedure.datePrononce?.getTime()) {
      evenements.push({ type: "DECISION", description: "Décision prononcée", date: data.datePrononce });
    }
    if (
      data.dateSignification &&
      data.dateSignification.getTime() !== procedure.dateSignification?.getTime()
    ) {
      evenements.push({
        type: "SIGNIFICATION",
        description: "Décision signifiée / notifiée",
        date: data.dateSignification,
      });
    }
    if (data.statut && data.statut !== procedure.statut) {
      evenements.push({
        type: "CHANGEMENT_STATUT",
        description: `${procedure.statut} → ${data.statut}`,
        date: new Date(),
      });
    }
    for (const evt of evenements) {
      await ctx.prisma.procedureEvenement.create({
        data: { procedureId: params.id, ...evt, creePar: ctx.userId },
      });
    }

    // La date de prononcé / signification pilote le point de départ des délais.
    if (data.datePrononce !== undefined || data.dateSignification !== undefined) {
      await resyncRecoursDelais(ctx.prisma, params.id);
    }

    await logAudit(ctx.prisma, ctx.userId, "procedure_updated", "procedure", params.id, {
      dossierId: procedure.dossierId,
      champs: Object.keys(data),
    }, req);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update procedure error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const procedure = await ctx.prisma.procedure.findUnique({
    where: { id: params.id },
    include: { recoursExerces: { select: { id: true } }, recoursSource: { select: { id: true } } },
  });
  if (!procedure) {
    return NextResponse.json({ error: "Procédure non trouvée" }, { status: 404 });
  }

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, procedure.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json(
      { error: "Seul un administrateur peut supprimer une procédure" },
      { status: 403 }
    );
  }
  if (procedure.recoursExerces.length > 0 || procedure.recoursSource.length > 0) {
    return NextResponse.json(
      { error: "Impossible de supprimer une procédure liée à un recours" },
      { status: 400 }
    );
  }

  await ctx.prisma.procedure.delete({ where: { id: params.id } });
  await logAudit(ctx.prisma, ctx.userId, "procedure_deleted", "procedure", params.id, {
    dossierId: procedure.dossierId,
  }, req);

  return NextResponse.json({ ok: true });
}
