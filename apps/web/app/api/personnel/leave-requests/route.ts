import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuth } from "@/lib/server-auth";
import { getEmployeeLeaveBalance, countWorkingDays, getActivePolicy, getDeductibleForNewRequest } from "@/lib/leave";

export async function GET() {
  const auth = await getServerAuth();
  const requests = await prisma.leaveRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, hireDate: true } },
      leaveType: { select: { id: true, code: true, libelle: true } },
      approvals: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const withBalance = await Promise.all(
    requests.map(async (r) => {
      const balance = await getEmployeeLeaveBalance(prisma, r.employee);
      return { ...r, balance };
    })
  );

  return NextResponse.json({ requests: withBalance, user: { id: auth.userId, role: auth.role } });
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  const body = await req.json();

  const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } });
  if (!employee) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });

  const leaveType = await prisma.leaveType.findUnique({ where: { id: body.leaveTypeId } });
  if (!leaveType) return NextResponse.json({ error: "Type d'absence introuvable" }, { status: 404 });

  const start = new Date(body.dateDebut);
  const end = new Date(body.dateFin);
  if (start > end) return NextResponse.json({ error: "La date de fin doit être postérieure à la date de début" }, { status: 400 });

  const policy = await getActivePolicy(prisma, employee.id);
  const nombreJours = await countWorkingDays(prisma, start, end, policy);
  if (nombreJours <= 0) return NextResponse.json({ error: "La période ne contient aucun jour ouvrable" }, { status: 400 });

  if (leaveType.code !== "maladie") {
    const balance = await getEmployeeLeaveBalance(prisma, employee, new Date());
    const deductible = await getDeductibleForNewRequest(prisma, employee.id, {
      dateDebut: start,
      nombreJours,
      statut: "soumise",
      leaveType,
    });
    if (deductible > balance.restants) {
      return NextResponse.json(
        { error: `Solde insuffisant : ${balance.restants} jours restants, demande déductible de ${deductible} jours` },
        { status: 400 }
      );
    }
  }

  const approverId = body.approverId ?? employee.managerId ?? null;

  const request = await prisma.leaveRequest.create({
    data: {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      approverId,
      dateDebut: start,
      dateFin: end,
      nombreJours,
      motif: body.motif ?? null,
      statut: "soumise",
      submittedAt: body.submittedAt ? new Date(body.submittedAt) : new Date(),
      createdBy: auth.userId,
    },
    include: {
      employee: true,
      leaveType: true,
    },
  });

  return NextResponse.json({ request });
}
