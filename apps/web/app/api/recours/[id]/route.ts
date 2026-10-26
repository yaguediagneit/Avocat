import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import {
  ORIGINES_RECOURS,
  ISSUES_RECOURS,
  computeDateLimite,
} from "@/lib/recours";

const optionalDate = () =>
  z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.coerce.date().nullable().optional()
  );

const recoursUpdateSchema = z
  .object({
    origine: z.enum(ORIGINES_RECOURS.map((o) => o.code) as [string, ...string[]]),
    juridictionCible: z.string().max(200).nullable(),
    pointDepart: z.enum(["prononce", "signification"]).nullable(),
    delaiJours: z.coerce.number().int().min(1).max(3650).nullable(),
    dateReference: optionalDate(),
    dateLimite: optionalDate(),
    dateDeclaration: optionalDate(),
    dateSignification: optionalDate(),
    dateConsignation: optionalDate(),
    dateMemoire: optionalDate(),
    issue: z
      .enum(ISSUES_RECOURS.map((i) => i.code) as [string, ...string[]])
      .nullable(),
    avocatId: z.string().uuid().nullable(),
    notes: z.string().max(5000).nullable(),
  })
  .partial();

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const recours = await ctx.prisma.recours.findUnique({ where: { id: params.id } });
  if (!recours) {
    return NextResponse.json({ error: "Recours non trouvé" }, { status: 404 });
  }

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, recours.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = recoursUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    // Si le point de départ ou la durée change sans date limite explicite,
    // on recalcule la date limite.
    const delai = data.delaiJours ?? recours.delaiJours;
    const reference = data.dateReference !== undefined ? data.dateReference : recours.dateReference;
    if (
      data.dateLimite === undefined &&
      reference &&
      delai &&
      (data.delaiJours !== undefined || data.dateReference !== undefined || data.pointDepart !== undefined)
    ) {
      (data as Record<string, unknown>).dateLimite = computeDateLimite(reference, delai);
    }

    const updated = await ctx.prisma.recours.update({
      where: { id: params.id },
      data,
    });

    await logAudit(ctx.prisma, ctx.userId, "recours_updated", "recours", params.id, {
      dossierId: recours.dossierId,
      champs: Object.keys(data),
    }, req);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update recours error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
