import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { ensureTiersAccount } from "@/lib/tiers";

const employeeSchema = z.object({
  employeeCode: z.string().min(1).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  position: z.string().optional(),
  department: z.string().optional(),
  regime: z.enum(["general", "cadre"]).default("general"),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contractType: z.string().min(1),
  baseSalary: z.coerce.number().int().nonnegative(),
  cnssNumber: z.string().optional(),
  ipresNumber: z.string().optional(),
  bankAccount: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]),
  nbChildren: z.coerce.number().int().min(0).default(0),
  taxShares: z.coerce.number().min(0.5).optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const employees = await ctx.prisma.employee.findMany({
    where: { isActive: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = employeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { taxShares, employeeCode, ...data } = parsed.data;
    const computedShares = taxShares ?? computeTaxShares(data.maritalStatus, data.nbChildren);

    const nextCode = employeeCode ?? await generateEmployeeCode(ctx.prisma);

    const employee = await ctx.prisma.employee.create({
      data: {
        ...data,
        employeeCode: nextCode,
        hireDate: new Date(data.hireDate),
        taxShares: computedShares,
      },
    });

    // Création automatique du compte auxiliaire tiers (SYSCOHADA révisé).
    try {
      await ensureTiersAccount(
        ctx.prisma,
        "employe",
        `${employee.firstName} ${employee.lastName}`
      );
    } catch (tiersError) {
      console.error("Compte tiers employé:", tiersError);
    }

    await logAudit(ctx.prisma, ctx.userId, "employee_created", "employee", employee.id);
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("Create employee error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

async function generateEmployeeCode(prisma: any) {
  const count = await prisma.employee.count();
  return `EMP${(count + 1).toString().padStart(4, "0")}`;
}

function computeTaxShares(maritalStatus: string, nbChildren: number) {
  let shares = 1.0;
  if (maritalStatus === "married") shares += 0.5;
  shares += nbChildren / 2;
  return Math.min(shares, 5.0);
}
