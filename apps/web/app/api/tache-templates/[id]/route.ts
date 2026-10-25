import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const updateTemplateSchema = z.object({
  titre: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  contenuDocument: z.string().max(50000).nullable().optional(),
  workflowEtapeId: z.string().uuid().nullable().optional(),
  delaiJours: z.coerce.number().int().min(0).max(365).optional(),
  roleAttendu: z.enum(["avocat", "huissier", "juriste", "assistant", "any"]).optional(),
  priorite: z.enum(["basse", "moyenne", "haute", "critique"]).optional(),
  ordre: z.coerce.number().int().min(0).optional(),
  actif: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "parametres", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await ctx.prisma.tacheTemplate.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
    }

    const template = await ctx.prisma.tacheTemplate.update({
      where: { id: params.id },
      data: parsed.data,
      include: {
        specialite: { select: { id: true, code: true, libelle: true } },
        workflowEtape: { select: { id: true, code: true, libelle: true } },
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "tache_template_updated", "tache_template", template.id, {
      titre: template.titre,
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Update tache template error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "parametres", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Seul un administrateur peut supprimer un modèle de tâche" }, { status: 403 });
  }

  try {
    const existing = await ctx.prisma.tacheTemplate.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
    }

    // Soft delete : on désactive au lieu de supprimer
    await ctx.prisma.tacheTemplate.update({
      where: { id: params.id },
      data: { actif: false },
    });

    await logAudit(ctx.prisma, ctx.userId, "tache_template_deleted", "tache_template", params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete tache template error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
