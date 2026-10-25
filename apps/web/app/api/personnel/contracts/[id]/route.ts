import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerAuth } from "@/lib/server-auth";
import { z } from "zod";

const contractSchema = z.object({
  employeeId: z.string().min(1),
  typeContrat: z.string().min(1),
  dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  dureeMois: z.coerce.number().int().optional(),
  fonction: z.string().optional(),
  service: z.string().optional(),
  lieuTravail: z.string().optional(),
  horaires: z.string().optional(),
  salaireBase: z.coerce.number().int().nonnegative(),
  periodeEssaiJours: z.coerce.number().int().nonnegative().optional(),
  congesPayesAnnuel: z.coerce.number().int().nonnegative().default(0),
  conventionCollective: z.string().optional(),
  clauseConfidentialite: z.coerce.boolean().default(false),
  clauseNonConcurrence: z.coerce.boolean().default(false),
  objet: z.string().optional(),
  approbateurId: z.string().optional(),
  statut: z.string().default("brouillon"),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  await getServerAuth();
  const { id } = params;
  const body = await req.json();
  const parsed = contractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const contract = await prisma.employmentContract.update({
    where: { id },
    data: {
      ...data,
      dateDebut: new Date(data.dateDebut),
      dateFin: data.dateFin ? new Date(data.dateFin) : null,
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
    },
  });

  return NextResponse.json(contract);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getServerAuth();
  const role = auth.role.nom.toLowerCase();
  const canValidate =
    auth.role.estAdmin ||
    role.includes("directeur") ||
    role.includes("associé") ||
    role.includes("associe");
  if (!canValidate) {
    return NextResponse.json({ error: "Action réservée" }, { status: 403 });
  }

  const { id } = params;
  const body = await req.json();
  const statut = body.statut;
  if (!statut || typeof statut !== "string") {
    return NextResponse.json({ error: "Statut manquant" }, { status: 400 });
  }

  const contract = await prisma.employmentContract.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!contract) return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });

  const isActive = statut === "actif";
  const isInactive = statut === "inactif";

  const updated = await prisma.employmentContract.update({
    where: { id },
    data: { statut },
  });

  if (isActive || isInactive) {
    await prisma.employee.update({
      where: { id: contract.employeeId },
      data: { isActive },
    });

    if (contract.employee.email) {
      await prisma.user.updateMany({
        where: { email: contract.employee.email },
        data: { actif: isActive },
      });
    }

    await prisma.insuredEmployee.updateMany({
      where: {
        employeeId: contract.employeeId,
        statut: isActive ? { not: "actif" } : "actif",
      },
      data: { statut: isActive ? "actif" : "suspendu" },
    });
  }

  return NextResponse.json(updated);
}
