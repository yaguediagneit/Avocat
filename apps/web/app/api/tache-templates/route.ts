import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { canAccessDossier } from "@/lib/rbac";
import { findSpecialiteForTypeAffaire } from "@/lib/specialite";

const createTemplateSchema = z.object({
  specialiteId: z.string().uuid(),
  workflowEtapeId: z.string().uuid().nullable().optional(),
  titre: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  contenuDocument: z.string().max(50000).nullable().optional(),
  delaiJours: z.coerce.number().int().min(0).max(365).default(0),
  roleAttendu: z.enum(["avocat", "huissier", "juriste", "assistant", "any"]).default("any"),
  priorite: z.enum(["basse", "moyenne", "haute", "critique"]).default("moyenne"),
  ordre: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const specialiteId = searchParams.get("specialiteId");
  const dossierId = searchParams.get("dossierId");

  // La consultation par dossier est ouverte à tout utilisateur pouvant lire le
  // dossier ; la consultation par spécialité reste réservée au paramétrage.
  const ctx = await guard(
    req,
    dossierId
      ? { resource: "dossiers", action: "read" }
      : { resource: "parametres", action: "read" }
  );
  if (ctx instanceof NextResponse) return ctx;

  // Mode "depuis un dossier" : retourne les modèles de la spécialité
  // correspondant au type d'affaire du dossier + sa date d'ouverture.
  if (dossierId) {
    const dossierOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, dossierId, "read");
    if (!dossierOk) {
      return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
    }
    const dossier = await ctx.prisma.dossier.findUnique({
      where: { id: dossierId },
      select: { typeAffaire: true, dateOuverture: true },
    });
    if (!dossier) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }
    const [paramType, specialites] = await Promise.all([
      ctx.prisma.parametre.findFirst({
        where: { categorie: "type_affaire", code: dossier.typeAffaire },
        select: { libelle: true },
      }),
      ctx.prisma.specialite.findMany({
        where: { actif: true },
        select: { id: true, code: true, libelle: true },
      }),
    ]);
    const specialite = findSpecialiteForTypeAffaire(
      dossier.typeAffaire,
      paramType?.libelle,
      specialites
    );
    const templates = specialite
      ? await ctx.prisma.tacheTemplate.findMany({
          where: { specialiteId: specialite.id, actif: true },
          orderBy: [{ ordre: "asc" }, { titre: "asc" }],
          select: { id: true, titre: true, description: true, priorite: true, delaiJours: true },
        })
      : [];
    return NextResponse.json({
      templates,
      dateOuverture: dossier.dateOuverture,
    });
  }

  const where: Record<string, unknown> = { actif: true };
  if (specialiteId) {
    where.specialiteId = specialiteId;
  }

  const templates = await ctx.prisma.tacheTemplate.findMany({
    where,
    orderBy: [{ ordre: "asc" }, { titre: "asc" }],
    include: {
      specialite: { select: { id: true, code: true, libelle: true } },
      workflowEtape: { select: { id: true, code: true, libelle: true } },
    },
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "parametres", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const template = await ctx.prisma.tacheTemplate.create({
      data: parsed.data,
      include: {
        specialite: { select: { id: true, code: true, libelle: true } },
        workflowEtape: { select: { id: true, code: true, libelle: true } },
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "tache_template_created", "tache_template", template.id, {
      titre: template.titre,
      specialiteId: template.specialiteId,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Create tache template error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
