import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { getClientAccessFilter } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { ensureTiersAccount } from "@/lib/tiers";

const clientSchema = z.object({
  type: z.enum(["physique", "entreprise", "administration"]),
  raisonSociale: z.string().min(1),
  identifiant: z.string().optional(),
  adresse: z.string().optional(),
  coordonnees: z.record(z.string()).optional(),
  representants: z.array(z.record(z.string())).optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "clients", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const accessFilter = await getClientAccessFilter(ctx.prisma, ctx.userId, ctx.roleInfo);
  const clients = await ctx.prisma.client.findMany({
    where: accessFilter,
    take: 500,
    orderBy: { raisonSociale: "asc" },
  });

  return NextResponse.json(clients);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "clients", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = clientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const client = await ctx.prisma.client.create({
      data: {
        ...parsed.data,
        representants: parsed.data.representants || [],
      },
    });

    // Création automatique du compte auxiliaire tiers (SYSCOHADA révisé).
    try {
      await ensureTiersAccount(ctx.prisma, "client", client.raisonSociale);
    } catch (tiersError) {
      console.error("Compte tiers client:", tiersError);
    }

    await logAudit(ctx.prisma, ctx.userId, "client_created", "client", client.id);
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("Create client error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
