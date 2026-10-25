import { NextRequest, NextResponse } from "next/server";
import { publicPrisma } from "@/lib/prisma";
import { guardSuperAdmin, TENANT_PUBLIC_SELECT } from "@/lib/superadmin";
import { createTenant } from "@/lib/tenant-manager";
import { z } from "zod";

const dateSchema = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Date invalide")
  .optional()
  .nullable();

const itemSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  raisonSociale: z.string().min(2).max(200),
  adresse: z.string().max(500).optional().nullable(),
  identifiantFiscal: z.string().max(100).optional().nullable(),
  domaine: z.string().max(253).optional().nullable(),
  planId: z.string().uuid().optional().nullable(),
  modeAbonnement: z.enum(["mensuel", "annuel"]).optional().nullable(),
  debutAbonnement: dateSchema,
  finAbonnement: dateSchema,
  actif: z.boolean().optional().nullable(),
  configuration: z.record(z.unknown()).optional().nullable(),
});

const importSchema = z.array(itemSchema).max(100);

export async function POST(req: NextRequest) {
  const ok = await guardSuperAdmin(req);
  if (ok !== true) return ok;

  try {
    const body = await req.json();
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const created: unknown[] = [];
    for (const item of parsed.data) {
      const existing = await publicPrisma.tenant.findUnique({
        where: { slug: item.slug },
        select: { id: true },
      });
      if (existing) continue;

      const tenant = await createTenant({
        slug: item.slug,
        raisonSociale: item.raisonSociale,
        adresse: item.adresse ?? undefined,
        identifiantFiscal: item.identifiantFiscal ?? undefined,
        domaine: item.domaine ?? undefined,
        planId: item.planId ?? undefined,
        configuration: item.configuration ?? undefined,
      });

      const updated = await publicPrisma.tenant.update({
        where: { id: tenant.id },
        data: {
          modeAbonnement: item.modeAbonnement || "mensuel",
          debutAbonnement: item.debutAbonnement ? new Date(item.debutAbonnement) : new Date(),
          finAbonnement: item.finAbonnement ? new Date(item.finAbonnement) : undefined,
          actif: item.actif ?? true,
        },
        select: { ...TENANT_PUBLIC_SELECT, _count: { select: { keys: true } } },
      });

      created.push(updated);
    }

    return NextResponse.json({ count: created.length, tenants: created }, { status: 201 });
  } catch (error) {
    console.error("Import tenants error:", error);
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
