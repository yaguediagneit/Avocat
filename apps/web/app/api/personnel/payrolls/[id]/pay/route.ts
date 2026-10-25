import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import {
  createEntryFromPayroll,
  createEntryFromPayrollSettlement,
} from "@/lib/accounting";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const payroll = await ctx.prisma.payroll.findUnique({
      where: { id: params.id },
      include: { employee: true, lines: true },
    });

    if (!payroll) return NextResponse.json({ error: "Bulletin introuvable" }, { status: 404 });
    if (payroll.status !== "validated") return NextResponse.json({ error: "Le bulletin doit être validé avant paiement" }, { status: 409 });

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "virement";

    const updated = await ctx.prisma.$transaction(async (tx) => {
      const paidAt = new Date();
      const p = await tx.payroll.update({
        where: { id: params.id },
        data: { status: "paid", paidAt },
      });

      // 1. Écriture de paie (D 661, D 664, C 4311, C 4313, C 447, C 427, C 422)
      const entry = await createEntryFromPayroll(tx, ctx.tenantId, p, mode, ctx.userId);

      // 2. Écriture de règlement du net (D 422, C 52/57)
      const settlementEntry = await createEntryFromPayrollSettlement(
        tx,
        ctx.tenantId,
        {
          id: p.id,
          periodYear: p.periodYear,
          periodMonth: p.periodMonth,
          netSalary: p.netSalary,
          paidAt,
          employeeId: p.employeeId,
        },
        mode,
        ctx.userId
      );

      return { p, entry, settlementEntry };
    });

    await logAudit(ctx.prisma, ctx.userId, "payroll_paid", "payroll", payroll.id);
    return NextResponse.json(updated.p);
  } catch (error) {
    console.error("Pay payroll error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
