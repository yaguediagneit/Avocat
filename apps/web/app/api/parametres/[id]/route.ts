import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const parametreUpdateSchema = z.object({
  categorie: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  libelle: z.string().min(1).optional(),
  ordre: z.coerce.number().int().optional(),
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
    const parsed = parametreUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const parametre = await ctx.prisma.parametre.update({
      where: { id: params.id },
      data: parsed.data,
    });

    await logAudit(ctx.prisma, ctx.userId, "parametre_updated", "parametre", parametre.id);
    return NextResponse.json(parametre);
  } catch (error) {
    console.error("Update parametre error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "parametres", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Seul un administrateur peut supprimer un paramètre" }, { status: 403 });
  }

  try {
    // Désactivation (soft delete) : les paramètres sont conservés pour la traçabilité.
    await ctx.prisma.parametre.update({
      where: { id: params.id },
      data: { actif: false },
    });

    await logAudit(ctx.prisma, ctx.userId, "parametre_deactivated", "parametre", params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete parametre error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
