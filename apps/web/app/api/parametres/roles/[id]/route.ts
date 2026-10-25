import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const roleUpdateSchema = z.object({
  nom: z.string().min(1).optional(),
  estAdmin: z.boolean().optional(),
  estClient: z.boolean().optional(),
  actif: z.boolean().optional(),
  permissions: z.record(z.array(z.string())).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "roles", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = roleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const role = await ctx.prisma.role.update({
      where: { id: params.id },
      data: parsed.data,
    });

    await logAudit(ctx.prisma, ctx.userId, "role_updated", "role", role.id);
    return NextResponse.json(role);
  } catch (error) {
    console.error("Update role error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "roles", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Seul un administrateur peut supprimer un rôle" }, { status: 403 });
  }

  try {
    // Désactivation (soft delete) : le rôle est conservé pour la traçabilité
    // et reste valide pour les utilisateurs qui y sont déjà affectés.
    await ctx.prisma.role.update({
      where: { id: params.id },
      data: { actif: false },
    });

    await logAudit(ctx.prisma, ctx.userId, "role_deactivated", "role", params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete role error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
