import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const dossierId = searchParams.get("dossierId");
  const profession = searchParams.get("profession") || "";

  if (!dossierId) {
    return NextResponse.json(null);
  }

  const accessOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, dossierId, "read");
  if (!accessOk) {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  const taches = await ctx.prisma.tache.findMany({
    where: { dossierId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (taches.length === 0) {
    return NextResponse.json(null);
  }

  if (!profession) {
    return NextResponse.json(taches[0].titre);
  }

  const responsableIds = Array.from(new Set(taches.map((t) => t.responsableId)));
  const users = await ctx.prisma.user.findMany({
    where: { id: { in: responsableIds } },
    include: { role: { select: { nom: true } } },
  });

  const userById = new Map(users.map((u) => [u.id, u]));

  const matched = taches.find((t) => {
    const u = userById.get(t.responsableId);
    if (!u) return false;
    return u.role?.nom?.toLowerCase().includes(profession.toLowerCase());
  });

  return NextResponse.json(matched ? matched.titre : null);
}
