import { NextRequest, NextResponse } from "next/server";
import { publicPrisma } from "@/lib/prisma";
import { Prisma } from "@/prisma/generated/public";
import { guardSuperAdmin, uuidSchema } from "@/lib/superadmin";
import { z } from "zod";

const planSchema = z.object({
  code: z.string().min(1).optional(),
  nom: z.string().min(1).optional(),
  joursEssai: z.coerce.number().int().min(0).optional(),
  acces: z.string().optional(),
  modules: z.array(z.string()).optional(),
  nbUtilisateurs: z.coerce.number().int().min(0).optional().nullable(),
  support: z.object({
    mail: z.boolean().optional(),
    telephone: z.boolean().optional(),
    prioritaire: z.boolean().optional(),
  }).optional().nullable(),
  prixMensuel: z.coerce.number().int().min(0).optional(),
  prixAnnuel: z.coerce.number().int().min(0).optional(),
  ordre: z.coerce.number().int().default(0).optional(),
  actif: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ok = await guardSuperAdmin(req);
  if (ok !== true) return ok;

  if (!uuidSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { support, modules, ...rest } = parsed.data;
    const updateData: Prisma.PlanUpdateInput = { ...rest };
    if (modules !== undefined) updateData.modules = modules;
    if (support !== undefined) updateData.support = support === null ? Prisma.JsonNull : support;

    const plan = await publicPrisma.plan.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Update plan error:", error);
    return NextResponse.json({ error: "Plan non trouvé" }, { status: 404 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ok = await guardSuperAdmin(req);
  if (ok !== true) return ok;

  if (!uuidSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  try {
    await publicPrisma.plan.update({ where: { id: params.id }, data: { actif: false } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete plan error:", error);
    return NextResponse.json({ error: "Plan non trouvé" }, { status: 404 });
  }
}
