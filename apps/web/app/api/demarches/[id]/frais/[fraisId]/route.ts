import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { z } from "zod";

const patchSchema = z.object({
  nature: z.enum(["HONORAIRE", "DEBOURS", "TAXE", "TIMBRE", "AVANCE_CLIENT"]).optional(),
  libelle: z.string().optional(),
  montant: z.number().int().min(0).optional(),
  date: z.string().optional().nullable(),
  quittance: z.string().optional().nullable(),
  documentId: z.string().uuid().optional().nullable(),
  rapproche: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; fraisId: string } }
) {
  const ctx = await guard(req, { resource: "demarches", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const demarche = await ctx.prisma.demarche.findUnique({
    where: { id: params.id },
    select: { dossierId: true },
  });
  if (!demarche) return NextResponse.json({ error: "Démarche non trouvée" }, { status: 404 });
  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, demarche.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    const update: Record<string, unknown> = {};
    if (d.nature !== undefined) update.nature = d.nature;
    if (d.libelle !== undefined) update.libelle = d.libelle;
    if (d.montant !== undefined) update.montant = d.montant;
    if (d.date !== undefined) update.date = d.date ? new Date(d.date) : null;
    if (d.quittance !== undefined) update.quittance = d.quittance || null;
    if (d.documentId !== undefined) update.documentId = d.documentId || null;
    if (d.rapproche !== undefined) update.rapproche = d.rapproche;

    const frais = await ctx.prisma.demarcheFrais.update({
      where: { id: params.fraisId },
      data: update,
    });
    return NextResponse.json(frais);
  } catch (error) {
    console.error("Update demarche frais error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; fraisId: string } }
) {
  const ctx = await guard(req, { resource: "demarches", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const demarche = await ctx.prisma.demarche.findUnique({
    where: { id: params.id },
    select: { dossierId: true },
  });
  if (!demarche) return NextResponse.json({ error: "Démarche non trouvée" }, { status: 404 });
  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, demarche.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  await ctx.prisma.demarcheFrais.delete({ where: { id: params.fraisId } });
  return NextResponse.json({ ok: true });
}
