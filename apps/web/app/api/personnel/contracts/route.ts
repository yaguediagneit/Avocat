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

export async function GET() {
  await getServerAuth();
  const contracts = await prisma.employmentContract.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
    },
  });
  return NextResponse.json(contracts);
}

export async function POST(req: NextRequest) {
  const auth = await getServerAuth();
  const body = await req.json();
  const parsed = contractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const contract = await prisma.employmentContract.create({
    data: {
      ...data,
      dateDebut: new Date(data.dateDebut),
      dateFin: data.dateFin ? new Date(data.dateFin) : null,
      createdBy: auth.userId,
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
    },
  });

  return NextResponse.json(contract, { status: 201 });
}
