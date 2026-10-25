import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { z } from "zod";

const typeSchema = z.object({
  code: z.string().min(2).regex(/^[A-Z0-9_]+$/),
  libelle: z.string().min(1),
  famille: z.enum(["URBANISME", "CADASTRE", "FISCALITE", "DOMAINES", "LIVRE_FONCIER", "TRANSVERSAL"]),
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
  /// Check-list initiale : créée avec le type.
  pieces: z
    .array(
      z.object({
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
      })
    )
    .optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const types = await ctx.prisma.demarcheType.findMany({
    include: {
      pieces: { where: { actif: true }, orderBy: { ordre: "asc" } },
      modeles: { where: { actif: true }, select: { id: true, code: true, titre: true } },
      _count: { select: { demarches: true } },
    },
    orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
  });
  return NextResponse.json(types);
}

export async function POST(req: NextRequest) {
  // Paramétrage du catalogue : administrateur ou rôle avec validate.
  const ctx = await guard(req, { resource: "demarches", action: "validate" });
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.roleInfo.estAdmin) {
    const { hasPermission } = await import("@/lib/rbac");
    if (!hasPermission(ctx.roleInfo, "parametres", "write")) {
      return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
    }
  }

  try {
    const parsed = typeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { pieces, ...data } = parsed.data;
    const type = await ctx.prisma.demarcheType.create({
      data: {
        ...(data as any),
        sousTypes: data.sousTypes ?? null,
        reglesRisque: data.reglesRisque ?? null,
        pieces: pieces?.length ? { create: pieces.map((p) => ({ ...p, condition: p.condition || null })) } : undefined,
      },
      include: { pieces: true },
    });
    return NextResponse.json(type, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Un type avec ce code existe déjà" }, { status: 409 });
    }
    console.error("Create demarche type error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
