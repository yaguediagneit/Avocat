import { NextRequest, NextResponse } from "next/server";
import { publicPrisma } from "@/lib/prisma";
import { guardSuperAdmin, sanitizeTenant, TENANT_PUBLIC_SELECT } from "@/lib/superadmin";
import { createTenantWithAdmin } from "@/lib/tenant-manager";
import { z } from "zod";

const createSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  raisonSociale: z.string().min(2).max(200),
  adresse: z.string().max(500).optional(),
  identifiantFiscal: z.string().max(100).optional(),
  domaine: z.string().max(253).optional(),
  planId: z.string().uuid().optional(),
  modeAbonnement: z.enum(["mensuel", "annuel"]).optional(),
  debutAbonnement: z.string().optional(),
  finAbonnement: z.string().optional(),
  configuration: z.record(z.unknown()).optional(),
  liens: z.array(z.string().max(2048)).max(20).optional(),
  admin: z.object({
    email: z.string().email(),
    prenom: z.string().min(1).max(100),
    nom: z.string().min(1).max(100),
    password: z.string().min(8).max(128),
  }),
});

export async function GET(req: NextRequest) {
  const ok = await guardSuperAdmin(req);
  if (ok !== true) return ok;

  const tenants = await publicPrisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    select: { ...TENANT_PUBLIC_SELECT, _count: { select: { keys: true } } },
  });

  return NextResponse.json(tenants);
}

export async function POST(req: NextRequest) {
  const ok = await guardSuperAdmin(req);
  if (ok !== true) return ok;

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { admin, liens, configuration, ...input } = parsed.data;
    const config: Record<string, unknown> = { ...(configuration || {}) };
    if (liens && liens.length > 0) {
      config.liens = liens;
    }

    const tenant = await createTenantWithAdmin(
      {
        ...input,
        debutAbonnement: input.debutAbonnement ? new Date(input.debutAbonnement) : new Date(),
        finAbonnement: input.finAbonnement ? new Date(input.finAbonnement) : undefined,
        configuration: Object.keys(config).length > 0 ? config : undefined,
      },
      admin
    );

    return NextResponse.json(sanitizeTenant(tenant), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    console.error("Create tenant error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
