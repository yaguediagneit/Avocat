import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { getServerAuth } from "@/lib/server-auth";
import { getEmployeeLeaveBalance, getDeductibleForRequest, getDeductibleForNewRequest, getActivePolicy, countWorkingDays } from "@/lib/leave";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;
  const { id } = params;
  const body = await req.json();

  const request = await ctx.prisma.leaveRequest.findUnique({
    where: { id },
    include: { employee: true, leaveType: true },
  });
  if (!request) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

  const statut = body.statut;
  if (!statut) return NextResponse.json({ error: "Statut manquant" }, { status: 400 });

  const ancienStatut = request.statut;
  const commentaire = body.commentaire ?? null;

  if (statut === "approuvee") {
    if (ctx.userId === request.employeeId) {
      return NextResponse.json({ error: "Un employé ne peut pas valider sa propre demande" }, { status: 403 });
    }
    const deductible = await getDeductibleForRequest(ctx.prisma, request.employeeId, request.id);
    if (deductible > 0) {
      const balance = await getEmployeeLeaveBalance(ctx.prisma, request.employee, new Date());
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const start = new Date(request.dateDebut);
      start.setUTCHours(0, 0, 0, 0);
      const additional = start > today ? 0 : deductible;
      if (balance.restants - additional < 0) {
        return NextResponse.json({ error: "Solde insuffisant pour approuver" }, { status: 400 });
      }
    }

    await ctx.prisma.$transaction(async (tx) => {
      await tx.leaveRequest.update({
        where: { id },
        data: {
          statut: "approuvee",
          decidedAt: new Date(),
          commentaireValidation: commentaire,
          updatedBy: ctx.userId,
        },
      });

      if (deductible > 0) {
        await tx.leaveTransaction.create({
          data: {
            employeeId: request.employeeId,
            leaveRequestId: id,
            periodeDebut: request.dateDebut,
            periodeFin: request.dateFin,
            typeTransaction: "consommation",
            nombreJours: -deductible,
            libelle: `Congé ${request.leaveType.libelle} approuvé du ${request.dateDebut.toISOString().split("T")[0]} au ${request.dateFin.toISOString().split("T")[0]}`,
            createdBy: ctx.userId,
          },
        });
      }
    });

    await ctx.prisma.leaveApproval.create({
      data: {
        leaveRequestId: id,
        actorId: ctx.userId,
        ancienStatut,
        nouveauStatut: "approuvee",
        commentaire,
      },
    });

    return NextResponse.json({ statut: "approuvee" });
  }

  if (statut === "rejetee") {
    await ctx.prisma.$transaction(async (tx) => {
      await tx.leaveRequest.update({
        where: { id },
        data: {
          statut: "rejetee",
          decidedAt: new Date(),
          commentaireValidation: commentaire,
          updatedBy: ctx.userId,
        },
      });
      await tx.leaveApproval.create({
        data: {
          leaveRequestId: id,
          actorId: ctx.userId,
          ancienStatut,
          nouveauStatut: "rejetee",
          commentaire,
        },
      });
    });
    return NextResponse.json({ statut: "rejetee" });
  }

  if (statut === "annulee") {
    await ctx.prisma.$transaction(async (tx) => {
      await tx.leaveRequest.update({
        where: { id },
        data: {
          statut: "annulee",
          cancelledAt: new Date(),
          updatedBy: ctx.userId,
        },
      });

      const existing = await tx.leaveTransaction.findFirst({
        where: { leaveRequestId: id, typeTransaction: "consommation" },
      });

      if (existing) {
        await tx.leaveTransaction.create({
          data: {
            employeeId: request.employeeId,
            leaveRequestId: id,
            periodeDebut: request.dateDebut,
            periodeFin: request.dateFin,
            typeTransaction: "annulation",
            nombreJours: Math.abs(existing.nombreJours),
            libelle: `Annulation du congé du ${request.dateDebut.toISOString().split("T")[0]} au ${request.dateFin.toISOString().split("T")[0]}`,
            createdBy: ctx.userId,
          },
        });
      }
    });
    return NextResponse.json({ statut: "annulee" });
  }

  return NextResponse.json({ error: "Statut non géré" }, { status: 400 });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  const { id } = params;
  const body = await req.json();

  const request = await auth.prisma.leaveRequest.findUnique({
    where: { id },
    include: { employee: true, leaveType: true },
  });
  if (!request) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

  const isApprover = request.approverId === auth.userId;
  const isCreator = request.createdBy === auth.userId;
  const currentUser = await auth.prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true } });
  const isEmployee = currentUser?.email ? currentUser.email === request.employee.email : false;
  const canEdit = isApprover || ((isCreator || isEmployee) && (request.statut === "rejetee" || request.statut === "annulee"));
  if (!canEdit) {
    return NextResponse.json({ error: "Vous n'avez pas le droit de modifier cette demande" }, { status: 403 });
  }

  const start = new Date(body.dateDebut);
  const end = new Date(body.dateFin);
  if (start > end) {
    return NextResponse.json({ error: "La date de fin doit être postérieure à la date de début" }, { status: 400 });
  }

  const leaveType = body.leaveTypeId
    ? await auth.prisma.leaveType.findUnique({ where: { id: body.leaveTypeId } })
    : request.leaveType;
  if (!leaveType) return NextResponse.json({ error: "Type d'absence introuvable" }, { status: 404 });

  const policy = await getActivePolicy(auth.prisma, request.employeeId);
  const nombreJours = await countWorkingDays(auth.prisma, start, end, policy);

  if (leaveType.code !== "maladie") {
    const balance = await getEmployeeLeaveBalance(auth.prisma, request.employee, new Date());
    const currentDeductible = await getDeductibleForRequest(auth.prisma, request.employeeId, id);
    const newDeductible = await getDeductibleForNewRequest(
      auth.prisma,
      request.employeeId,
      { dateDebut: start, nombreJours, statut: "soumise", leaveType },
      id
    );
    if (newDeductible > balance.restants + currentDeductible + 1e-9) {
      return NextResponse.json({ error: `Solde insuffisant : ${newDeductible} jours déductibles requis` }, { status: 400 });
    }
  }

  const newDeductible =
    leaveType.code !== "maladie"
      ? await getDeductibleForNewRequest(
          auth.prisma,
          request.employeeId,
          { dateDebut: start, nombreJours, statut: "soumise", leaveType },
          id
        )
      : 0;

  await auth.prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id },
      data: {
        leaveTypeId: leaveType.id,
        approverId: body.approverId ?? request.approverId,
        dateDebut: start,
        dateFin: end,
        nombreJours,
        motif: body.motif ?? null,
        updatedBy: auth.userId,
      },
    });

    const existingTx = await tx.leaveTransaction.findFirst({
      where: { leaveRequestId: id, typeTransaction: "consommation" },
    });

    if (existingTx) {
      if (newDeductible > 0) {
        await tx.leaveTransaction.update({
          where: { id: existingTx.id },
          data: {
            periodeDebut: start,
            periodeFin: end,
            nombreJours: -newDeductible,
            libelle: `Congé ${leaveType.libelle} modifié du ${start.toISOString().split("T")[0]} au ${end.toISOString().split("T")[0]}`,
          },
        });
      } else {
        await tx.leaveTransaction.delete({ where: { id: existingTx.id } });
      }
    }
  });

  return NextResponse.json({ request });
}
