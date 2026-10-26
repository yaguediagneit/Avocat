import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard, ensureDossierAccess } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { NIVEAUX_PROCEDURE, TYPES_DECISION, SENS_DECISION } from "@/lib/recours";

const optionalDate = () =>
  z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.coerce.date().nullable().optional()
  );

const procedureCreateSchema = z.object({
  niveau: z.enum(NIVEAUX_PROCEDURE.map((n) => n.code) as [string, ...string[]]),
  juridiction: z.string().min(1, "Juridiction obligatoire").max(200),
  chambre: z.string().max(150).optional().nullable(),
  greffe: z.string().max(150).optional().nullable(),
  referenceRg: z.string().max(80).optional().nullable(),
  dateSaisine: optionalDate(),
  datePrononce: optionalDate(),
  dateSignification: optionalDate(),
  typeDecision: z
    .enum(TYPES_DECISION.map((t) => t.code) as [string, ...string[]])
    .optional()
    .nullable(),
  decision: z.string().max(20000).optional().nullable(),
  sensDecision: z
    .enum(SENS_DECISION.map((s) => s.code) as [string, ...string[]])
    .optional(),
  publieClient: z.boolean().optional(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDossierAccess(ctx, params.id, "read");
  if (access !== true) return access;

  const procedures = await ctx.prisma.procedure.findMany({
    where: { dossierId: params.id },
    orderBy: [{ createdAt: "asc" }],
    include: {
      recoursExerces: { orderBy: { createdAt: "asc" } },
      evenements: { orderBy: { date: "desc" }, take: 20 },
    },
  });

  return NextResponse.json(procedures);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  try {
    const body = await req.json();
    const parsed = procedureCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    const statut = data.datePrononce
      ? data.dateSignification
        ? "DECISION_SIGNIFIEE"
        : "DECISION_RENDUE"
      : "EN_COURS";

    const procedure = await ctx.prisma.procedure.create({
      data: {
        dossierId: params.id,
        niveau: data.niveau,
        juridiction: data.juridiction,
        chambre: data.chambre || null,
        greffe: data.greffe || null,
        referenceRg: data.referenceRg || null,
        dateSaisine: data.dateSaisine ?? null,
        datePrononce: data.datePrononce ?? null,
        dateSignification: data.dateSignification ?? null,
        typeDecision: data.typeDecision || null,
        decision: data.decision || null,
        sensDecision: data.sensDecision || "en_attente",
        statut,
        publieClient: data.publieClient ?? true,
        notes: data.notes || null,
        creePar: ctx.userId,
      },
    });

    if (data.dateSaisine) {
      await ctx.prisma.procedureEvenement.create({
        data: {
          procedureId: procedure.id,
          type: "SAISINE",
          description: `Saisine de ${data.juridiction}`,
          date: data.dateSaisine,
          creePar: ctx.userId,
        },
      });
    }

    await logAudit(ctx.prisma, ctx.userId, "procedure_created", "procedure", procedure.id, {
      dossierId: params.id,
      niveau: data.niveau,
      juridiction: data.juridiction,
    }, req);

    return NextResponse.json(procedure, { status: 201 });
  } catch (error) {
    console.error("Create procedure error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
