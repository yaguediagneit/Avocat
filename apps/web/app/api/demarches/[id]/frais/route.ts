import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { z } from "zod";

const fraisSchema = z.object({
  nature: z.enum(["HONORAIRE", "DEBOURS", "TAXE", "TIMBRE", "AVANCE_CLIENT"]),
  libelle: z.string().min(1),
  montant: z.number().int().min(0),
  date: z.string().optional().nullable(),
  quittance: z.string().optional().nullable(),
  documentId: z.string().uuid().optional().nullable(),
  rapproche: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
    const parsed = fraisSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const frais = await ctx.prisma.demarcheFrais.create({
      data: {
        demarcheId: params.id,
        nature: parsed.data.nature,
        libelle: parsed.data.libelle,
        montant: parsed.data.montant,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
        quittance: parsed.data.quittance || null,
        documentId: parsed.data.documentId || null,
        rapproche: parsed.data.rapproche ?? false,
        creePar: ctx.userId,
      },
    });
    return NextResponse.json(frais, { status: 201 });
  } catch (error) {
    console.error("Add demarche frais error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
