import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { hasPermission } from "@/lib/rbac";
import { z } from "zod";

const patchSchema = z.object({
  libelle: z.string().min(1).optional(),
  famille: z.enum(["URBANISME", "CADASTRE", "FISCALITE", "DOMAINES", "LIVRE_FONCIER", "TRANSVERSAL"]).optional(),
  autoritePrincipale: z.string().optional().nullable(),
  natureResultat: z.string().optional().nullable(),
  sousTypes: z.array(z.object({ code: z.string(), libelle: z.string() })).optional().nullable(),
  qualificationObligatoire: z.boolean().optional(),
  parcelleRequise: z.boolean().optional(),
  validationAvocat: z.boolean().optional(),
  sensible: z.boolean().optional(),
  nbExemplaires: z.number().int().min(1).optional(),
  delaiRelanceJours: z.number().int().min(1).optional(),
  delaiLegalJours: z.number().int().optional().nullable(),
  reglesRisque: z.array(z.string()).optional().nullable(),
  avertissement: z.string().optional().nullable(),
  ordre: z.number().int().optional(),
  actif: z.boolean().optional(),
});

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
  ordre: z.number().int().default(0),
});

function adminOnly(ctx: any): NextResponse | null {
  if (ctx.roleInfo.estAdmin) return null;
  if (hasPermission(ctx.roleInfo, "parametres", "write")) return null;
  return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  const denied = adminOnly(ctx);
  if (denied) return denied;

  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data as any;
    if ("sousTypes" in data) data.sousTypes = data.sousTypes ?? null;
    if ("reglesRisque" in data) data.reglesRisque = data.reglesRisque ?? null;
    const type = await ctx.prisma.demarcheType.update({
      where: { id: params.id },
      data,
      include: { pieces: { orderBy: { ordre: "asc" } } },
    });
    return NextResponse.json(type);
  } catch (error) {
    console.error("Update demarche type error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/// Ajout d'une pièce à la check-list du type (body = pieceSchema).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  const denied = adminOnly(ctx);
  if (denied) return denied;

  try {
    const parsed = pieceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const piece = await ctx.prisma.demarcheTypePiece.create({
      data: { ...parsed.data, condition: parsed.data.condition || null, typeId: params.id },
    });
    return NextResponse.json(piece, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Une pièce avec ce code existe déjà" }, { status: 409 });
    }
    console.error("Add type piece error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
