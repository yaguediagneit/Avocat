import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/prisma/generated/public";
import { publicPrisma } from "@/lib/prisma";
import { guardSuperAdmin } from "@/lib/superadmin";
import { z } from "zod";

const planSchema = z.object({
  code: z.string().min(1),
  nom: z.string().min(1),
  joursEssai: z.coerce.number().int().min(0),
  acces: z.string().optional(),
  modules: z.array(z.string()).optional(),
  nbUtilisateurs: z.number().int().min(0).optional().nullable(),
  support: z.object({
    mail: z.boolean().optional(),
    telephone: z.boolean().optional(),
    prioritaire: z.boolean().optional(),
  }).optional().nullable(),
  prixMensuel: z.coerce.number().int().min(0),
  prixAnnuel: z.coerce.number().int().min(0),
  ordre: z.coerce.number().int().default(0),
});

export async function GET(req: NextRequest) {
  const ok = await guardSuperAdmin(req);
  if (ok !== true) return ok;

  const plans = await publicPrisma.plan.findMany({
    orderBy: { ordre: "asc" },
  });

  return NextResponse.json(plans);
}

export async function POST(req: NextRequest) {
  const ok = await guardSuperAdmin(req);
  if (ok !== true) return ok;

  try {
    const body = await req.json();
    const parsed = planSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { support, modules, acces, ...rest } = parsed.data;
    const plan = await publicPrisma.plan.create({
      data: {
        ...rest,
        modules: modules ?? [],
        acces: acces || null,
        support: support ?? Prisma.JsonNull,
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    console.error("Create plan error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
