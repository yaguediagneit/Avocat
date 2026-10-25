import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.roleInfo?.estAdmin) {
    return NextResponse.json({ error: "Seul un administrateur peut approuver" }, { status: 403 });
  }

  const { id } = params;

  const existing = await ctx.prisma.socialPayment.findUnique({
    where: { id },
    include: { employee: { select: { firstName: true, lastName: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Versement introuvable" }, { status: 404 });
  }
  if (existing.status !== "draft") {
    return NextResponse.json({ error: "Ce versement a déjà été traité" }, { status: 409 });
  }

  const updated = await ctx.prisma.socialPayment.update({
    where: { id },
    data: {
      status: "approved",
      approvedBy: ctx.userId,
      approvedAt: new Date(),
    },
    include: { employee: { select: { firstName: true, lastName: true } } },
  });

  return NextResponse.json(updated);
}
