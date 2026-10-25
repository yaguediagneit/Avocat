import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const payroll = await ctx.prisma.payroll.findUnique({
      where: { id: params.id },
      select: { status: true },
    });

    if (!payroll) return NextResponse.json({ error: "Bulletin introuvable" }, { status: 404 });
    if (payroll.status !== "cancelled") {
      return NextResponse.json({ error: "Seul un bulletin désactivé peut être activé" }, { status: 409 });
    }

    const updated = await ctx.prisma.payroll.update({
      where: { id: params.id },
      data: { status: "draft" },
    });

    await logAudit(ctx.prisma, ctx.userId, "payroll_activated", "payroll", params.id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Activate payroll error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
