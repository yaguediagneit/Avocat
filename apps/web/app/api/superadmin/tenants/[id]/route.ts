import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/prisma/generated/public";
import { publicPrisma } from "@/lib/prisma";
import { guardSuperAdmin, TENANT_PUBLIC_SELECT, uuidSchema } from "@/lib/superadmin";
import { z } from "zod";

const patchSchema = z.object({
  actif: z.boolean().optional(),
  planId: z.string().uuid().optional().nullable(),
  modeAbonnement: z.enum(["mensuel", "annuel"]).optional(),
  debutAbonnement: z.string().optional(),
  finAbonnement: z.string().optional(),
});

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

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
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data: Prisma.TenantUpdateInput = {};
    if (parsed.data.actif !== undefined) data.actif = parsed.data.actif;
    if (parsed.data.planId !== undefined) {
      data.plan = parsed.data.planId ? { connect: { id: parsed.data.planId } } : { disconnect: true };
    }
    if (parsed.data.modeAbonnement) data.modeAbonnement = parsed.data.modeAbonnement;
    const debut = parseDate(parsed.data.debutAbonnement);
    const fin = parseDate(parsed.data.finAbonnement);
    if (debut) data.debutAbonnement = debut;
    if (fin) data.finAbonnement = fin;

    const tenant = await publicPrisma.tenant.update({
      where: { id: params.id },
      data,
      select: { ...TENANT_PUBLIC_SELECT, _count: { select: { keys: true } } },
    });

    return NextResponse.json(tenant);
  } catch (error) {
    console.error("Update tenant error:", error);
    return NextResponse.json({ error: "Tenant non trouvé" }, { status: 404 });
  }
}
