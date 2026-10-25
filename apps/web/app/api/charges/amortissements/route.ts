import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { postDueAmortissements } from "@/lib/accounting";

/// Dotations aux amortissements échues et non encore comptabilisées
/// (toutes immobilisations confondues).
export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const dotations = await ctx.prisma.chargeAmortissement.findMany({
    where: {
      isPosted: false,
      dueDate: { lte: new Date() },
      charge: { actif: true, isImmobilisation: true },
    },
    include: {
      charge: {
        select: { id: true, description: true, category: { select: { label: true } } },
      },
    },
    orderBy: [{ dueDate: "asc" }, { numero: "asc" }],
  });

  return NextResponse.json({
    count: dotations.length,
    totalAmount:
      Math.round(dotations.reduce((s: number, d: any) => s + Number(d.amount || 0), 0) * 100) / 100,
    dotations,
  });
}

/// Comptabilise toutes les dotations échues (bouton comptable ou tâche planifiée).
export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const result = await postDueAmortissements(ctx.prisma, ctx.tenantId, ctx.userId);
    if (result.posted > 0) {
      await logAudit(ctx.prisma, ctx.userId, "amortissements_comptabilises", "charge", null);
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Run amortissements error", error);
    return NextResponse.json({ error: error?.message || "Erreur serveur" }, { status: 500 });
  }
}
