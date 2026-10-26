import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/prisma/generated/public";
import { publicPrisma } from "@/lib/prisma";
import { guardSuperAdmin, TENANT_PUBLIC_SELECT, uuidSchema } from "@/lib/superadmin";
import { normalizeDomain } from "@/lib/tenant-url";
import { z } from "zod";

const patchSchema = z.object({
  raisonSociale: z.string().trim().min(2, "Le nom du cabinet doit contenir au moins 2 caractères").max(255).optional(),
  actif: z.boolean().optional(),
  planId: z.string().uuid().optional().nullable(),
  modeAbonnement: z.enum(["mensuel", "annuel"]).optional(),
  debutAbonnement: z.string().optional(),
  finAbonnement: z.string().optional(),
  domaine: z.string().max(2048).optional().nullable(),
  lien: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Le lien doit commencer par http:// ou https://")
    .optional()
    .nullable(),
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
    if (parsed.data.raisonSociale !== undefined) data.raisonSociale = parsed.data.raisonSociale;
    if (parsed.data.actif !== undefined) data.actif = parsed.data.actif;
    if (parsed.data.planId !== undefined) {
      data.plan = parsed.data.planId ? { connect: { id: parsed.data.planId } } : { disconnect: true };
    }
    if (parsed.data.modeAbonnement) data.modeAbonnement = parsed.data.modeAbonnement;
    const debut = parseDate(parsed.data.debutAbonnement);
    const fin = parseDate(parsed.data.finAbonnement);
    if (debut) data.debutAbonnement = debut;
    if (fin) data.finAbonnement = fin;

    if (parsed.data.domaine !== undefined) {
      try {
        data.domaine = normalizeDomain(parsed.data.domaine);
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 400 });
      }
    }

    if (parsed.data.lien !== undefined) {
      const current = await publicPrisma.tenant.findUnique({ where: { id: params.id }, select: { configuration: true } });
      if (!current) return NextResponse.json({ error: "Tenant non trouvé" }, { status: 404 });
      const config =
        current.configuration && typeof current.configuration === "object" && !Array.isArray(current.configuration)
          ? { ...(current.configuration as Record<string, unknown>) }
          : {};
      if (parsed.data.lien) config.lien = parsed.data.lien;
      else delete config.lien;
      data.configuration = config as Prisma.InputJsonObject;
    }

    const tenant = await publicPrisma.tenant.update({
      where: { id: params.id },
      data,
      select: { ...TENANT_PUBLIC_SELECT, _count: { select: { keys: true } } },
    });

    return NextResponse.json(tenant);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ce domaine est déjà utilisé par un autre cabinet." }, { status: 409 });
    }
    console.error("Update tenant error:", error);
    return NextResponse.json({ error: "Tenant non trouvé" }, { status: 404 });
  }
}
