import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { hasPermission } from "@/lib/rbac";
import { z } from "zod";

const patchSchema = z.object({
  nom: z.string().min(1).optional(),
  typeAutorite: z
    .enum(["MAIRIE", "CADASTRE", "DGID", "CONSERVATION", "CENTRE_FISCAL", "TRIBUNAL", "AUTRE"])
    .optional(),
  commune: z.string().optional().nullable(),
  departement: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  adresse: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
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
    const autorite = await ctx.prisma.demarcheAutorite.update({
      where: { id: params.id },
      data: parsed.data as any,
    });
    return NextResponse.json(autorite);
  } catch (error) {
    console.error("Update autorite error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.roleInfo.estAdmin && !hasPermission(ctx.roleInfo, "parametres", "write")) {
    return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
  }
  // Désactivation logique : les démarches existantes conservent la référence.
  await ctx.prisma.demarcheAutorite.update({
    where: { id: params.id },
    data: { actif: false },
  });
  return NextResponse.json({ ok: true });
}
