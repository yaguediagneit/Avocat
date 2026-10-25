import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const roleSchema = z.object({
  nom: z.string().min(1),
  estAdmin: z.boolean().default(false),
  estClient: z.boolean().default(false),
  permissions: z.record(z.array(z.string())).default({}),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "roles", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const roles = await ctx.prisma.role.findMany({
    orderBy: { nom: "asc" },
  });

  return NextResponse.json(
    roles.map((r) => ({
      id: r.id,
      nom: r.nom,
      estAdmin: r.estAdmin,
      estClient: r.estClient,
      permissions: (r.permissions as Record<string, string[]>) || {},
      _count: undefined as any,
    }))
  );
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "roles", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = roleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const role = await ctx.prisma.role.create({
      data: {
        nom: parsed.data.nom,
        estAdmin: parsed.data.estAdmin,
        estClient: parsed.data.estClient,
        permissions: parsed.data.permissions,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "role_created", "role", role.id);
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error("Create role error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
