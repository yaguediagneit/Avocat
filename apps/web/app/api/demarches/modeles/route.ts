import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { hasPermission } from "@/lib/rbac";
import { extractTemplateVariables } from "@/lib/document-template";
import { z } from "zod";

const modeleSchema = z.object({
  code: z.string().min(2).regex(/^[A-Z0-9_]+$/),
  titre: z.string().min(1),
  typeId: z.string().uuid().optional().nullable(),
  contenu: z.string().min(1),
  ordre: z.number().int().optional(),
  actif: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const typeId = searchParams.get("typeId");

  const modeles = await ctx.prisma.demarcheModele.findMany({
    where: {
      actif: true,
      ...(typeId ? { OR: [{ typeId }, { typeId: null }] } : {}),
    },
    include: { type: { select: { code: true, libelle: true } } },
    orderBy: [{ ordre: "asc" }, { titre: "asc" }],
  });

  // Les variables extraites sont jointes pour pré-remplir le formulaire
  // de génération côté client (évite un second aller-retour).
  return NextResponse.json(
    modeles.map((m) => ({ ...m, variables: extractTemplateVariables(m.contenu) }))
  );
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.roleInfo.estAdmin && !hasPermission(ctx.roleInfo, "parametres", "write")) {
    return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
  }
  try {
    const parsed = modeleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const modele = await ctx.prisma.demarcheModele.create({
      data: { ...parsed.data, typeId: parsed.data.typeId || null },
    });
    return NextResponse.json(modele, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Un modèle avec ce code existe déjà" }, { status: 409 });
    }
    console.error("Create demarche modele error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
