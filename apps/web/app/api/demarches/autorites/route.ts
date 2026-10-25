import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { hasPermission } from "@/lib/rbac";
import { z } from "zod";

const autoriteSchema = z.object({
  nom: z.string().min(1),
  typeAutorite: z
    .enum(["MAIRIE", "CADASTRE", "DGID", "CONSERVATION", "CENTRE_FISCAL", "TRIBUNAL", "AUTRE"])
    .default("AUTRE"),
  commune: z.string().optional().nullable(),
  departement: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  adresse: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  actif: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  const autorites = await ctx.prisma.demarcheAutorite.findMany({
    where: { actif: true },
    orderBy: [{ typeAutorite: "asc" }, { nom: "asc" }],
  });
  return NextResponse.json(autorites);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.roleInfo.estAdmin && !hasPermission(ctx.roleInfo, "parametres", "write")) {
    return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
  }
  try {
    const parsed = autoriteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const autorite = await ctx.prisma.demarcheAutorite.create({
      data: parsed.data as any,
    });
    return NextResponse.json(autorite, { status: 201 });
  } catch (error) {
    console.error("Create autorite error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
