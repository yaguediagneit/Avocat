import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { ensureTiersAccount } from "@/lib/tiers";
import { computeTaxShares } from "@/lib/payroll";

const spouseSchema = z.object({
  prenom: z.string().min(1),
  nom: z.string().optional(),
});

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
  sexe: z.enum(["M", "F"]).optional(),
  dateNaissance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]),
  nbChildren: z.coerce.number().int().min(0).default(0),
  nbSpouses: z.coerce.number().int().min(0).max(4).default(0),
  spouses: z.array(spouseSchema).max(4).optional(),
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

    const { taxShares, employeeCode, spouses, nbSpouses, dateNaissance, ...data } = parsed.data;
    // Femme mariée ⇒ 1 époux ; homme marié ⇒ jusqu'à 4 épouses.
    const maxSpouses = data.sexe === "F" ? 1 : 4;
    const effectiveSpouses =
      data.maritalStatus === "married" ? Math.min(maxSpouses, Math.max(1, nbSpouses)) : 0;
    const computedShares =
      taxShares ?? computeTaxShares(data.maritalStatus, data.nbChildren, effectiveSpouses);

    const nextCode = employeeCode ?? await generateEmployeeCode(ctx.prisma);

    const employee = await ctx.prisma.employee.create({
      data: {
        ...data,
        nbSpouses: effectiveSpouses,
        employeeCode: nextCode,
        hireDate: new Date(data.hireDate),
        dateNaissance: dateNaissance ? new Date(dateNaissance) : null,
        taxShares: computedShares,
      },
    });

    // Chaque conjoint (époux d'une employée, épouses d'un employé) est
    // rattaché comme ayant droit de l'employé.
    if (effectiveSpouses > 0) {
      await ctx.prisma.employeeDependent.createMany({
        data: Array.from({ length: effectiveSpouses }, (_, i) => ({
          employeeId: employee.id,
          prenom:
            spouses?.[i]?.prenom?.trim() ||
            (employee.sexe === "F" ? "Époux" : `Épouse ${i + 1}`),
          nom: spouses?.[i]?.nom?.trim() || employee.lastName,
          sexe: employee.sexe === "F" ? "M" : "F",
          lienFamilial: "conjoint",
        })),
      });
    }

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
