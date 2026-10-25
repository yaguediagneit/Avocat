import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { auditSearchWhere } from "@/lib/search";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes('"') || s.includes(";") || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "audit", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const entite = searchParams.get("entite");
  const q = searchParams.get("q")?.trim();
  const format = searchParams.get("format") ?? "csv";

  const where: Record<string, unknown> = {};
  if (entite) where.entite = entite;
  if (q) {
    // Même recherche multi-mots que GET /api/audit.
    Object.assign(where, await auditSearchWhere(ctx.prisma, q));
  }

  const rows: any[] = [];
  const batchSize = 5000;
  let skip = 0;

  while (true) {
    const page = await ctx.prisma.auditLog.findMany({
      where,
      take: batchSize,
      skip,
      orderBy: { createdAt: "desc" },
    });
    if (page.length === 0) break;
    rows.push(...page);
    skip += batchSize;
    if (page.length < batchSize) break;
  }

  const now = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `audit-${now}`;

  if (format === "json") {
    const body = JSON.stringify(rows, null, 2);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.json"`,
      },
    });
  }

  const header = "Date;Utilisateur;Action;Entite;EntiteId;Details;IP;UserAgent\n";
  const csv =
    header +
    rows
      .map((l) =>
        [
          csvEscape(new Date(l.createdAt).toISOString()),
          csvEscape(l.userId || ""),
          csvEscape(l.action),
          csvEscape(l.entite),
          csvEscape(l.entiteId || ""),
          csvEscape(JSON.stringify(l.details ?? {})),
          csvEscape(l.adresseIp || ""),
          csvEscape(l.userAgent || ""),
        ].join(";")
      )
      .join("\n");

  const bom = "\uFEFF";
  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
