import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { auditSearchWhere } from "@/lib/search";

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "audit", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const take = parseInt(searchParams.get("take") || "10", 10);
  const skip = parseInt(searchParams.get("skip") || "0", 10);
  const entite = searchParams.get("entite");
  const q = searchParams.get("q")?.trim();
  const sort = searchParams.get("sort");
  const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";

  const SORTABLE = new Set(["createdAt", "action", "entite", "entiteId", "adresseIp"]);
  const orderBy = sort && SORTABLE.has(sort) ? { [sort]: dir } : { createdAt: "desc" as const };

  const where: Record<string, unknown> = {};
  if (entite) where.entite = entite;
  if (q) {
    // Multi-mots : chaque mot doit matcher action / entité / ID / IP / utilisateur.
    Object.assign(where, await auditSearchWhere(ctx.prisma, q));
  }

  const [logs, total] = await Promise.all([
    ctx.prisma.auditLog.findMany({
      where,
      take,
      skip,
      orderBy,
    }),
    ctx.prisma.auditLog.count({ where }),
  ]);

  // Join manuel avec les users pour récupérer les noms
  const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean) as string[])];
  const users = userIds.length > 0
    ? await ctx.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, prenom: true, nom: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, `${u.prenom} ${u.nom}`]));

  const logsWithName = logs.map((l) => ({
    ...l,
    userNom: l.userId ? userMap.get(l.userId) || "Utilisateur supprimé" : null,
  }));

  return NextResponse.json({ logs: logsWithName, total });
}
