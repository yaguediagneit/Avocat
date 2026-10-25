import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard, GuardedContext } from "@/lib/api-guard";
import { getClientAccessFilter } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

/// Vérifie que le client `id` est accessible à l'utilisateur courant.
/// Renvoie `true` ou une NextResponse (403/404).
async function ensureClientAccess(
  ctx: GuardedContext,
  clientId: string
): Promise<true | NextResponse> {
  const accessFilter = await getClientAccessFilter(ctx.prisma, ctx.userId, ctx.roleInfo);
  const client = await ctx.prisma.client.findFirst({
    where: { id: clientId, ...accessFilter },
    select: { id: true },
  });
  if (!client) {
    // On distingue 404 (inexistant) de 403 (accessible mais non autorisé)
    const exists = await ctx.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Client non trouvé" }, { status: 404 });
    }
    return NextResponse.json({ error: "Accès interdit à ce client" }, { status: 403 });
  }
  return true;
}

const clientUpdateSchema = z.object({
  type: z.enum(["physique", "entreprise", "administration"]).optional(),
  raisonSociale: z.string().min(1).optional(),
  identifiant: z.string().optional(),
  adresse: z.string().optional(),
  coordonnees: z.record(z.string()).optional(),
  representants: z.array(z.record(z.string())).optional(),
  actif: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "clients", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureClientAccess(ctx, params.id);
  if (access !== true) return access;

  try {
    const client = await ctx.prisma.client.findUnique({
      where: { id: params.id },
      include: { dossiers: { take: 10, orderBy: { createdAt: "desc" } } },
    });

    if (!client) {
      return NextResponse.json({ error: "Client non trouvé" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Get client error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "clients", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureClientAccess(ctx, params.id);
  if (access !== true) return access;

  try {
    const body = await req.json();
    const parsed = clientUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const client = await ctx.prisma.client.update({
      where: { id: params.id },
      data: parsed.data,
    });

    await logAudit(ctx.prisma, ctx.userId, "client_updated", "client", client.id);
    return NextResponse.json(client);
  } catch (error) {
    console.error("Update client error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "clients", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Seul un administrateur peut désactiver un client" }, { status: 403 });
  }

  const access = await ensureClientAccess(ctx, params.id);
  if (access !== true) return access;

  try {
    await ctx.prisma.client.update({ where: { id: params.id }, data: { actif: false } });
    await logAudit(ctx.prisma, ctx.userId, "client_deactivated", "client", params.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Deactivate client error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
