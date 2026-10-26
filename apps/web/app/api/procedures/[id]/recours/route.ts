import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import {
  TYPES_RECOURS,
  ORIGINES_RECOURS,
  delaiRecoursJours,
  pointDepartAuto,
  computeDateLimite,
  TYPE_RECOURS_LABELS,
} from "@/lib/recours";

const optionalDate = () =>
  z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.coerce.date().nullable().optional()
  );

const recoursCreateSchema = z.object({
  typeRecours: z.enum(TYPES_RECOURS.map((t) => t.code) as [string, ...string[]]),
  origine: z
    .enum(ORIGINES_RECOURS.map((o) => o.code) as [string, ...string[]])
    .default("client"),
  juridictionCible: z.string().max(200).optional().nullable(),
  /// Surcharges du calcul automatique.
  pointDepart: z.enum(["prononce", "signification"]).optional().nullable(),
  delaiJours: z.coerce.number().int().min(1).max(3650).optional().nullable(),
  dateReference: optionalDate(),
  dateLimite: optionalDate(),
  avocatId: z.string().uuid().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const procedure = await ctx.prisma.procedure.findUnique({
    where: { id: params.id },
    include: { dossier: { select: { id: true, matiere: true } } },
  });
  if (!procedure) {
    return NextResponse.json({ error: "Procédure non trouvée" }, { status: 404 });
  }

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, procedure.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = recoursCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const matiere = procedure.dossier.matiere;

    // Calcul du délai : surcharge explicite > calcul matière/type > manuel.
    const delaiJours =
      data.delaiJours ?? delaiRecoursJours(matiere, data.typeRecours);

    const auto = pointDepartAuto(procedure, data.typeRecours, matiere);
    const pointDepart = data.pointDepart ?? auto.pointDepart;
    const dateReference =
      data.dateReference ??
      auto.dateReference ??
      (pointDepart === "prononce"
        ? procedure.datePrononce
        : procedure.dateSignification) ??
      null;

    const dateLimite =
      data.dateLimite ??
      (dateReference && delaiJours ? computeDateLimite(dateReference, delaiJours) : null);

    const recours = await ctx.prisma.recours.create({
      data: {
        dossierId: procedure.dossierId,
        procedureOrigineId: procedure.id,
        typeRecours: data.typeRecours,
        origine: data.origine,
        juridictionCible: data.juridictionCible || null,
        pointDepart,
        delaiJours,
        dateReference,
        dateLimite,
        avocatId: data.avocatId || null,
        notes: data.notes || null,
        creePar: ctx.userId,
      },
    });

    await ctx.prisma.recoursEvenement.create({
      data: {
        recoursId: recours.id,
        type: "TRANSITION",
        nouveauStatut: "A_ANALYSER",
        description: `Recours créé : ${TYPE_RECOURS_LABELS[data.typeRecours] || data.typeRecours}`,
        details: { delaiJours, pointDepart, dateLimite },
        creePar: ctx.userId,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "recours_created", "recours", recours.id, {
      dossierId: procedure.dossierId,
      procedureId: procedure.id,
      typeRecours: data.typeRecours,
      dateLimite,
    }, req);

    return NextResponse.json(recours, { status: 201 });
  } catch (error) {
    console.error("Create recours error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
