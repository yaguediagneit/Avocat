import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { computePayroll } from "@/lib/payroll";

const lineSchema = z.object({
  rubricId: z.string().uuid(),
  rateOrAmount: z.coerce.number().default(0),
});

const payrollUpdateSchema = z.object({
  cssRate: z.coerce.number().min(0).max(100).default(5.6),
  ipresRate: z.coerce.number().min(0).max(100).default(5.6),
  ipresEmployerRate: z.coerce.number().min(0).max(100).default(8.4),
  parts: z.coerce.number().min(0.5).max(5).default(1),
  notes: z.string().optional(),
  lines: z.array(lineSchema).default([]),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const payroll = await ctx.prisma.payroll.findUnique({
      where: { id: params.id },
      include: { employee: true, lines: true },
    });
    if (!payroll) return NextResponse.json({ error: "Bulletin introuvable" }, { status: 404 });
    return NextResponse.json(payroll);
  } catch (error) {
    console.error("Get payroll error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = payrollUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { cssRate, ipresRate, ipresEmployerRate, parts, notes, lines } = parsed.data;

    const payroll = await ctx.prisma.payroll.findUnique({
      where: { id: params.id },
      include: { employee: true, lines: true },
    });
    if (!payroll) return NextResponse.json({ error: "Bulletin introuvable" }, { status: 404 });
    if (payroll.status === "paid" || payroll.status === "cancelled") {
      return NextResponse.json({ error: "Impossible de modifier un bulletin payé ou annulé" }, { status: 409 });
    }

    const rubrics = await ctx.prisma.payrollRubric.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });

    const selected = rubrics.map((r) => {
      const input = lines.find((l) => l.rubricId === r.id);
      const existing = payroll.lines.find((l) => l.rubricId === r.id);
      return {
        id: r.id,
        code: r.code,
        label: r.label,
        type: r.type as "gain" | "deduction" | "cotisation",
        calcType: r.calcType as "fixed" | "percent_base" | "percent_gross",
        rateOrAmount: input?.rateOrAmount ?? existing?.rateOrAmount ?? r.rateOrAmount,
        sortOrder: r.sortOrder,
      };
    });

    const computed = computePayroll(
      Number(payroll.baseSalary),
      payroll.employee.maritalStatus,
      payroll.employee.nbChildren,
      cssRate,
      ipresRate,
      ipresEmployerRate,
      selected,
      parts
    );

    const updated = await ctx.prisma.$transaction(async (tx) => {
      await tx.payrollLine.deleteMany({ where: { payrollId: params.id } });
      const p = await tx.payroll.update({
        where: { id: params.id },
        data: {
          baseSalary: computed.baseSalary,
          grossSalary: computed.grossSalary,
          totalGains: computed.totalGains,
          totalDeductions: computed.totalDeductions,
          totalCotisations: computed.totalCotisations,
          cssBase: computed.cssBase,
          cssRate: computed.cssRate,
          cssAmount: computed.cssAmount,
          cssEmployerAmount: computed.cssEmployerAmount,
          ipresBase: computed.ipresBase,
          ipresRate: computed.ipresRate,
          ipresAmount: computed.ipresAmount,
          ipresEmployerAmount: computed.ipresEmployerAmount,
          irppTaxableBase: computed.irppTaxableBase,
          irppShares: computed.irppShares,
          irppAmount: computed.irppAmount,
          netSalary: computed.netSalary,
          totalEmployerCost: computed.totalEmployerCost,
          status: "draft",
          notes,
          lines: {
            create: computed.lines.map((l) => ({
              rubricId: l.rubricId,
              rubricCode: l.rubricCode,
              rubricLabel: l.rubricLabel,
              rubricType: l.rubricType,
              calcType: l.calcType,
              rateOrAmount: l.rateOrAmount,
              baseAmount: l.baseAmount,
              computedAmount: l.computedAmount,
              sortOrder: l.sortOrder,
            })),
          },
        },
        include: { employee: true, lines: true },
      });
      return p;
    });

    await logAudit(ctx.prisma, ctx.userId, "payroll_updated", "payroll", params.id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update payroll error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
