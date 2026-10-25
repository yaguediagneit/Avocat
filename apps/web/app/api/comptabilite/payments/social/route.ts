import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";

const PAYMENT_TYPES = ["IRPP", "IPRES", "CNSS_CSS", "ASSURANCE"] as const;

const postSchema = z.object({
  type: z.enum(PAYMENT_TYPES),
  employeeId: z.string().uuid(),
  periodYear: z.coerce.number().int().min(2000),
  periodMonth: z.coerce.number().int().min(1).max(12).optional(),
  periodStart: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  periodEnd: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  amount: z.coerce.number().int().min(1),
});

function employeeNumberOf(employee: any, type: string): string | null {
  switch (type) {
    case "IRPP":
      return employee?.irppNumber ?? null;
    case "IPRES":
      return employee?.ipresNumber ?? null;
    case "CNSS_CSS":
      return employee?.cnssNumber ?? null;
    case "ASSURANCE":
      return employee?.insurancePolicyNumber ?? null;
    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;
  const month = searchParams.get("month") ? Number(searchParams.get("month")) : undefined;
  const status = searchParams.get("status") ?? undefined;

  const payments = await ctx.prisma.socialPayment.findMany({
    where: {
      ...(year ? { periodYear: year } : {}),
      ...(month ? { periodMonth: month } : {}),
      ...(status ? { status } : {}),
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true, cnssNumber: true, ipresNumber: true, irppNumber: true, insurancePolicyNumber: true } } },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, employeeId, periodYear, periodMonth, periodStart, periodEnd, amount } = parsed.data;

  const employee = await ctx.prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });
  }

  const payment = await ctx.prisma.socialPayment.create({
    data: {
      type,
      periodYear,
      periodMonth,
      periodStart: periodStart ? new Date(periodStart) : null,
      periodEnd: periodEnd ? new Date(periodEnd) : null,
      employeeId,
      employeeNumber: employeeNumberOf(employee, type),
      amount,
      preparedBy: ctx.userId,
      status: "draft",
    },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
  });

  return NextResponse.json(payment, { status: 201 });
}
