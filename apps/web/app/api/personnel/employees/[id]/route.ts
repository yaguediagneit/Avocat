import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const employeeUpdateSchema = z.object({
  employeeCode: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  regime: z.enum(["general", "cadre"]).optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  contractType: z.string().min(1).optional(),
  contractEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")
    .transform(() => null)
    ),
  baseSalary: z.coerce.number().int().nonnegative().optional(),
  cnssNumber: z.string().optional(),
  ipresNumber: z.string().optional(),
  bankAccount: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
  nbChildren: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

function computeTaxShares(maritalStatus: string, nbChildren: number) {
  let shares = 1.0;
  if (maritalStatus === "married") shares += 0.5;
  shares += nbChildren / 2;
  return Math.min(shares, 5.0);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const employee = await ctx.prisma.employee.findUnique({
      where: { id: params.id },
      include: {
        payrolls: { orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }], take: 20 },
        histories: { orderBy: { changedAt: "desc" } },
      },
    });
    if (!employee) {
      return NextResponse.json({ error: "Employé non trouvé" }, { status: 404 });
    }
    return NextResponse.json(employee);
  } catch (error) {
    console.error("Get employee error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    // Alias utilisé par le composant générique RowActions.
    if (typeof body.actif === "boolean" && body.isActive === undefined) {
      body.isActive = body.actif;
    }
    const parsed = employeeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { hireDate, nbChildren, contractEndDate, ...data } = parsed.data;

    const existing = await ctx.prisma.employee.findUnique({
      where: { id: params.id },
      select: { maritalStatus: true, nbChildren: true, position: true, regime: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Employé non trouvé" }, { status: 404 });
    }

    const marital = data.maritalStatus ?? existing.maritalStatus;
    const children = nbChildren ?? existing.nbChildren;

    const newPosition = data.position === "" ? null : data.position ?? existing.position;
    const newRegime = data.regime ?? existing.regime;

    const employee = await ctx.prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: params.id },
        data: {
          ...data,
          position: newPosition,
          regime: newRegime,
          hireDate: hireDate ? new Date(hireDate) : undefined,
          contractEndDate:
            contractEndDate === null
              ? null
              : contractEndDate
                ? new Date(contractEndDate)
                : undefined,
          nbChildren: children,
          taxShares: computeTaxShares(marital, children),
        },
      });

      const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
      if (newPosition !== existing.position) {
        changes.push({ field: "position", oldValue: existing.position, newValue: newPosition });
      }
      if (newRegime !== existing.regime) {
        changes.push({ field: "regime", oldValue: existing.regime, newValue: newRegime });
      }

      if (changes.length > 0) {
        await tx.employeeHistory.createMany({
          data: changes.map((c) => ({
            employeeId: params.id,
            field: c.field,
            oldValue: c.oldValue,
            newValue: c.newValue,
            changedBy: ctx.userId,
          })),
        });
      }

      return updated;
    });

    await logAudit(ctx.prisma, ctx.userId, "employee_updated", "employee", params.id);
    return NextResponse.json(employee);
  } catch (error) {
    console.error("Update employee error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "comptabilite", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Seul un administrateur peut désactiver un employé" }, { status: 403 });
  }

  try {
    await ctx.prisma.employee.update({ where: { id: params.id }, data: { isActive: false } });
    await logAudit(ctx.prisma, ctx.userId, "employee_deactivated", "employee", params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete employee error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
