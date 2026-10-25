import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { computePayroll, PayrollRubricInput } from "@/lib/payroll";

const bulkSchema = z.object({
  sourceYear: z.coerce.number().int().min(2000),
  sourceMonth: z.coerce.number().int().min(1).max(12),
  targetYear: z.coerce.number().int().min(2000),
  targetMonth: z.coerce.number().int().min(1).max(12),
  allowBackward: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { sourceYear, sourceMonth, targetYear, targetMonth } = parsed.data;

    const isSameMonth =
      targetYear === sourceYear && targetMonth === sourceMonth;
    const isBackward =
      targetYear < sourceYear ||
      (targetYear === sourceYear && targetMonth < sourceMonth);

    if (isSameMonth) {
      return NextResponse.json(
        { error: "Le mois cible doit être différent du mois source" },
        { status: 400 }
      );
    }

    // Rattrapage : le mois cible est antérieur au mois source (ex. payer un
    // mois impayé depuis un bulletin plus récent). Autorisé si confirmé.
    if (isBackward && !parsed.data.allowBackward) {
      return NextResponse.json(
        {
          error:
            "Le mois cible est antérieur au mois source. Confirmez la génération pour un mois passé (rattrapage).",
          backward: true,
        },
        { status: 400 }
      );
    }

    const [employees, rubrics] = await Promise.all([
      ctx.prisma.employee.findMany({ where: { isActive: true } }),
      ctx.prisma.payrollRubric.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      }),
    ]);

    if (employees.length === 0) {
      return NextResponse.json({ error: "Aucun employé actif" }, { status: 400 });
    }

    const sourcePayrolls = await ctx.prisma.payroll.findMany({
      where: {
        periodYear: sourceYear,
        periodMonth: sourceMonth,
        employeeId: { in: employees.map((e) => e.id) },
      },
      include: { lines: true },
    });

    const sourceByEmployee = new Map(sourcePayrolls.map((p) => [p.employeeId, p]));

    const created: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const employee of employees) {
      const existingTarget = await ctx.prisma.payroll.findUnique({
        where: {
          employeeId_periodYear_periodMonth: {
            employeeId: employee.id,
            periodYear: targetYear,
            periodMonth: targetMonth,
          },
        },
      });

      if (existingTarget) {
        skipped.push(`${employee.firstName} ${employee.lastName}`);
        continue;
      }

      const source = sourceByEmployee.get(employee.id);
      const cssRate = source?.cssRate ?? 5.6;
      const ipresRate = source?.ipresRate ?? 5.6;
      const ipresEmployerRate = source?.grossSalary
        ? Math.round((source.ipresEmployerAmount / source.grossSalary) * 100 * 100) / 100
        : 8.4;
      const parts = employee.taxShares ?? undefined;

      const selected: PayrollRubricInput[] = rubrics.map((r) => {
        const sourceLine = source?.lines.find((l) => l.rubricId === r.id);
        return {
          id: r.id,
          code: r.code,
          label: r.label,
          type: r.type as "gain" | "deduction" | "cotisation",
          calcType: r.calcType as "fixed" | "percent_base" | "percent_gross",
          rateOrAmount: sourceLine ? sourceLine.rateOrAmount : r.rateOrAmount,
          sortOrder: r.sortOrder,
        };
      });

      try {
        const computed = computePayroll(
          Number(employee.baseSalary),
          employee.maritalStatus,
          employee.nbChildren,
          cssRate,
          ipresRate,
          ipresEmployerRate,
          selected,
          parts
        );

        await ctx.prisma.payroll.create({
          data: {
            employeeId: employee.id,
            periodYear: targetYear,
            periodMonth: targetMonth,
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
            notes: source
              ? `Généré depuis le bulletin de ${sourceMonth}/${sourceYear}`
              : "",
            createdBy: ctx.userId,
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
        });

        created.push(`${employee.firstName} ${employee.lastName}`);
      } catch (err) {
        console.error(`Erreur génération bulletin pour ${employee.id}`, err);
        errors.push(`${employee.firstName} ${employee.lastName}`);
      }
    }

    await logAudit(
      ctx.prisma,
      ctx.userId,
      "payrolls_bulk_generated",
      "payroll",
      null,
      { sourceYear, sourceMonth, targetYear, targetMonth, count: created.length }
    );

    return NextResponse.json({ created, skipped, errors });
  } catch (error) {
    console.error("Bulk payroll generation error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
