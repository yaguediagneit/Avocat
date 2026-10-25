import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { z } from "zod";

const patchSchema = z.object({
  libelle: z.string().optional(),
  categorie: z
    .enum([
      "DOCUMENT_INTERNE_CABINET",
      "DOCUMENT_ADMINISTRATIF_A_OBTENIR",
      "PIECE_CLIENT",
      "PIECE_TECHNIQUE",
      "PREUVE_DE_DEPOT_ET_SUIVI",
    ])
    .optional(),
  niveau: z.enum(["OBLIGATOIRE", "CONDITIONNELLE", "FACULTATIVE"]).optional(),
  condition: z.string().optional().nullable(),
  sourceAttendue: z
    .enum(["CLIENT", "CABINET", "ADMINISTRATION", "ARCHITECTE", "GEOMETRE", "NOTAIRE", "AUTRE"])
    .optional(),
  statut: z
    .enum([
      "NON_DEMANDEE",
      "DEMANDEE",
      "RECUE",
      "ILLISIBLE",
      "EXPIREE",
      "VALIDEE",
      "NON_APPLICABLE",
      "REJETEE",
    ])
    .optional(),
  documentId: z.string().uuid().optional().nullable(),
  recueLe: z.string().optional().nullable(),
  expireLe: z.string().optional().nullable(),
  commentaire: z.string().optional().nullable(),
  visibleClient: z.boolean().optional(),
  ordre: z.number().int().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; pieceId: string } }
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
    const data = parsed.data;

    const update: Record<string, unknown> = {};
    for (const k of ["libelle", "categorie", "niveau", "sourceAttendue", "statut", "ordre", "visibleClient"] as const) {
      if (k in data && data[k] !== undefined) update[k] = data[k];
    }
    if ("condition" in data) update.condition = data.condition || null;
    if ("documentId" in data) update.documentId = data.documentId || null;
    if ("commentaire" in data) update.commentaire = data.commentaire || null;
    if ("recueLe" in data) update.recueLe = data.recueLe ? new Date(data.recueLe) : null;
    if ("expireLe" in data) update.expireLe = data.expireLe ? new Date(data.expireLe) : null;

    if (update.statut === "RECUE" && !update.recueLe) update.recueLe = new Date();
    if (update.statut === "VALIDEE") {
      update.verifiePar = ctx.userId;
      update.verifieLe = new Date();
      if (!update.recueLe) update.recueLe = new Date();
    }

    const piece = await ctx.prisma.demarchePiece.update({
      where: { id: params.pieceId },
      data: update,
    });
    return NextResponse.json(piece);
  } catch (error) {
    console.error("Update demarche piece error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; pieceId: string } }
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

  await ctx.prisma.demarchePiece.delete({ where: { id: params.pieceId } });
  return NextResponse.json({ ok: true });
}
