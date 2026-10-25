import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const pieceSchema = z.object({
  code: z.string().min(1),
  libelle: z.string().min(1),
  categorie: z.enum([
    "DOCUMENT_INTERNE_CABINET",
    "DOCUMENT_ADMINISTRATIF_A_OBTENIR",
    "PIECE_CLIENT",
    "PIECE_TECHNIQUE",
    "PREUVE_DE_DEPOT_ET_SUIVI",
  ]),
  niveau: z.enum(["OBLIGATOIRE", "CONDITIONNELLE", "FACULTATIVE"]).default("OBLIGATOIRE"),
  condition: z.string().optional().nullable(),
  sourceAttendue: z
    .enum(["CLIENT", "CABINET", "ADMINISTRATION", "ARCHITECTE", "GEOMETRE", "NOTAIRE", "AUTRE"])
    .default("CLIENT"),
  ordre: z.number().int().optional(),
});

async function checkAccess(ctx: any, demarcheId: string): Promise<NextResponse | null> {
  const demarche = await ctx.prisma.demarche.findUnique({
    where: { id: demarcheId },
    select: { id: true, dossierId: true, statut: true },
  });
  if (!demarche) return NextResponse.json({ error: "Démarche non trouvée" }, { status: 404 });
  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, demarche.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  return null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "demarches", action: "write" });
  if (ctx instanceof NextResponse) return ctx;
  const denied = await checkAccess(ctx, params.id);
  if (denied) return denied;

  try {
    const parsed = pieceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const piece = await ctx.prisma.demarchePiece.create({
      data: { ...parsed.data, condition: parsed.data.condition || null, demarcheId: params.id },
    });
    await logAudit(ctx.prisma, ctx.userId, "demarche_piece_added", "demarche", params.id, {
      pieceId: piece.id,
      libelle: piece.libelle,
    }, req);
    return NextResponse.json(piece, { status: 201 });
  } catch (error) {
    console.error("Add demarche piece error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
