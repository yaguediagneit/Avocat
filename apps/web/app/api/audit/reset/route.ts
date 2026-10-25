import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "audit", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  let body: { mode?: "all" | "older"; days?: number; keep?: number } = {};
  try {
    body = await req.json();
  } catch {
    // pas de corps : mode par défaut
  }

  const mode = body.mode ?? "older";
  const days = typeof body.days === "number" && body.days > 0 ? body.days : 90;

  let where: Record<string, unknown> = {};
  if (mode === "older") {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    where = { createdAt: { lt: cutoff } };
  } else if (mode === "all") {
    where = {};
  } else {
    return NextResponse.json({ error: "Mode inconnu" }, { status: 400 });
  }

  const deleted = await ctx.prisma.auditLog.deleteMany({ where });

  const details: Record<string, unknown> = { mode };
  if (mode === "older") details.days = days;

  await logAudit(ctx.prisma, ctx.userId, "audit_log_reset", "audit", null, details, req);

  const total = await ctx.prisma.auditLog.count();
  return NextResponse.json({ ok: true, deleted: deleted.count, total, mode, days });
}
