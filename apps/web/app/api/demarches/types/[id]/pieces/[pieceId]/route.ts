import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { hasPermission } from "@/lib/rbac";
import { z } from "zod";

const patchSchema = z.object({
  libelle: z.string().min(1).optional(),
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
  ordre: z.number().int().optional(),
  actif: z.boolean().optional(),
});

function adminOnly(ctx: any): NextResponse | null {
  if (ctx.roleInfo.estAdmin) return null;
  if (hasPermission(ctx.roleInfo, "parametres", "write")) return null;
  return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { pieceId: string } }
) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  const denied = adminOnly(ctx);
  if (denied) return denied;

  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const piece = await ctx.prisma.demarcheTypePiece.update({
      where: { id: params.pieceId },
      data: parsed.data as any,
    });
    return NextResponse.json(piece);
  } catch (error) {
    console.error("Update type piece error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { pieceId: string } }
) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  const denied = adminOnly(ctx);
  if (denied) return denied;

  // Désactivation (soft delete) : la pièce est conservée pour la traçabilité.
  await ctx.prisma.demarcheTypePiece.update({ where: { id: params.pieceId }, data: { actif: false } });
  return NextResponse.json({ ok: true });
}
