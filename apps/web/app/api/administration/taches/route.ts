import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const dossierId = searchParams.get("dossierId");

  if (!dossierId) {
    return NextResponse.json([]);
  }

  const accessOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, dossierId, "read");
  if (!accessOk) {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  const taches = await ctx.prisma.tache.findMany({
    where: { dossierId },
    orderBy: { echeance: "asc" },
    select: { titre: true, description: true },
    take: 200,
  });

  return NextResponse.json(taches);
}
