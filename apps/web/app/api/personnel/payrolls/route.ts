import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { computePayroll } from "@/lib/payroll";
import { listActiveContributionRules } from "@/lib/payroll-rules";

const lineSchema = z.object({
  rubricId: z.string().uuid(),
  rateOrAmount: z.coerce.number().default(0),
});

const payrollSchema = z.object({
  employeeId: z.string().uuid(),
  periodYear: z.coerce.number().int().min(2000),
  periodMonth: z.coerce.number().int().min(1).max(12),
  cssRate: z.coerce.number().min(0).max(100).default(5.6),
  ipresRate: z.coerce.number().min(0).max(100).default(5.6),
  ipresEmployerRate: z.coerce.number().min(0).max(100).default(8.4),
  regime: z.enum(["general", "cadre"]).default("general"),
  parts: z.coerce.number().min(0.5).max(5).default(1),
  notes: z.string().optional(),
  lines: z.array(lineSchema).default([]),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const employeeId = searchParams.get("employeeId");
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit ? Number(rawLimit) : 100;

  if (rawLimit && (!Number.isInteger(limit) || limit <= 0)) {
    return NextResponse.json({ error: "Paramètre limit invalide" }, { status: 400 });
  }

  const payrolls = await ctx.prisma.payroll.findMany({
    where: {
      ...(employeeId ? { employeeId } : {}),
      ...(year ? { periodYear: Number(year) } : {}),
      ...(month ? { periodMonth: Number(month) } : {}),
    },
    include: { employee: true, lines: true },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    take: limit,
  });

  return NextResponse.json(payrolls);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = payrollSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { employeeId, periodYear, periodMonth, cssRate, ipresRate, ipresEmployerRate, regime, parts, notes, lines } =
      parsed.data;

    const existing = await ctx.prisma.payroll.findUnique({
      where: { employeeId_periodYear_periodMonth: { employeeId, periodYear, periodMonth } },
    });
    if (existing) {
      return NextResponse.json({ error: "Un bulletin existe déjà pour cette période." }, { status: 409 });
    }

    const employee = await ctx.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });

    const rubrics = await ctx.prisma.payrollRubric.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });

    const selected = rubrics.map((r) => {
      const input = lines.find((l) => l.rubricId === r.id);
      return {
        id: r.id,
        code: r.code,
        label: r.label,
        type: r.type as "gain" | "deduction" | "cotisation",
        calcType: r.calcType as "fixed" | "percent_base" | "percent_gross",
        rateOrAmount: input?.rateOrAmount ?? r.rateOrAmount,
        sortOrder: r.sortOrder,
      };
    });

    const contributionRules = await listActiveContributionRules(ctx.prisma, {
      regime,
      at: new Date(periodYear, periodMonth - 1, 15),
    });

    const computed = computePayroll(
      Number(employee.baseSalary),
      employee.maritalStatus,
      employee.nbChildren,
      cssRate,
      ipresRate,
      ipresEmployerRate,
      selected,
      parts,
      contributionRules
    );

    const payroll = await ctx.prisma.$transaction(async (tx) => {
      const p = await tx.payroll.create({
        data: {
          employeeId,
          periodYear,
          periodMonth,
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
        include: { lines: true },
      });
      return p;
    });

    await logAudit(ctx.prisma, ctx.userId, "payroll_created", "payroll", payroll.id);
    return NextResponse.json(payroll, { status: 201 });
  } catch (error) {
    console.error("Create payroll error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
