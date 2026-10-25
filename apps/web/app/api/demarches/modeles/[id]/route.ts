import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { hasPermission } from "@/lib/rbac";
import { z } from "zod";

const patchSchema = z.object({
  titre: z.string().min(1).optional(),
  typeId: z.string().uuid().optional().nullable(),
  contenu: z.string().min(1).optional(),
  ordre: z.number().int().optional(),
  actif: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.roleInfo.estAdmin && !hasPermission(ctx.roleInfo, "parametres", "write")) {
    return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
  }
  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const modele = await ctx.prisma.demarcheModele.update({
      where: { id: params.id },
      data: parsed.data as any,
    });
    return NextResponse.json(modele);
  } catch (error) {
    console.error("Update demarche modele error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.roleInfo.estAdmin && !hasPermission(ctx.roleInfo, "parametres", "write")) {
    return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
  }
  await ctx.prisma.demarcheModele.update({
    where: { id: params.id },
    data: { actif: false },
  });
  return NextResponse.json({ ok: true });
}
