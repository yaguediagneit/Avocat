import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTenant } from "@/lib/tenant-manager";
import { logAudit } from "@/lib/audit";
import { publicPrisma } from "@/lib/prisma";

const createSchema = z.object({
  slug: z.string().min(2).max(50),
  raisonSociale: z.string().min(2),
  adresse: z.string().optional(),
  identifiantFiscal: z.string().optional(),
  domaine: z.string().optional(),
});

export async function GET() {
  const tenants = await publicPrisma.tenant.findMany({
    where: { actif: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tenants);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const tenant = await createTenant(parsed.data);

    await logAudit(publicPrisma, "user-id", "tenant_created", "tenant", tenant.id);

    return NextResponse.json(tenant, { status: 201 });
  } catch (error: any) {
    console.error("Create tenant error", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
