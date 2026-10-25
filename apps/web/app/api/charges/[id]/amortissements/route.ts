import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { createEntryFromAmortissement, postDueAmortissements } from "@/lib/accounting";

const postSchema = z.object({
  /// Comptabiliser une dotation précise (sinon toutes les dotations échues).
  dotationId: z.string().uuid().optional(),
});

/// Plan d'amortissement d'une charge immobilisée.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const dotations = await ctx.prisma.chargeAmortissement.findMany({
    where: { chargeId: params.id },
    orderBy: { numero: "asc" },
  });
  return NextResponse.json(dotations);
}

/// Comptabilise une dotation (D 681x / C 28x) ou toutes celles échues.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const charge = await ctx.prisma.charge.findUnique({
      where: { id: params.id },
      include: { category: { select: { label: true } } },
    });
    if (!charge) {
      return NextResponse.json({ error: "Charge non trouvée" }, { status: 404 });
    }
    if (!charge.isImmobilisation) {
      return NextResponse.json(
        { error: "Cette charge n'est pas une immobilisation amortie" },
        { status: 400 }
      );
    }

    if (parsed.data.dotationId) {
      const dotation = await ctx.prisma.chargeAmortissement.findUnique({
        where: { id: parsed.data.dotationId },
      });
      if (!dotation || dotation.chargeId !== charge.id) {
        return NextResponse.json({ error: "Dotation non trouvée" }, { status: 404 });
      }
      if (dotation.isPosted) {
        return NextResponse.json({ error: "Dotation déjà comptabilisée" }, { status: 400 });
      }
      await createEntryFromAmortissement(ctx.prisma, ctx.tenantId, charge, dotation, ctx.userId);
      await logAudit(ctx.prisma, ctx.userId, "amortissement_comptabilise", "charge", charge.id);
      return NextResponse.json({ posted: 1, totalAmount: dotation.amount, errors: [] });
    }

    const result = await postDueAmortissements(ctx.prisma, ctx.tenantId, ctx.userId, { chargeId: charge.id });
    if (result.posted > 0) {
      await logAudit(ctx.prisma, ctx.userId, "amortissement_comptabilise", "charge", charge.id);
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Post amortissement error", error);
    return NextResponse.json(
      { error: error?.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
