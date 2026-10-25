import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { createEntryFromInsuranceAdvance } from "@/lib/accounting";

const insurerSchema = z.object({
  nom: z.string().min(1),
  adresse: z.string().optional(),
  telephone: z.string().optional(),
  telephoneSecondaire: z.string().optional(),
  siteWeb: z.string().optional(),
  referenceInterne: z.string().optional(),
  statut: z.enum(["actif", "inactif"]).default("actif"),
  observations: z.string().optional(),
  managerNom: z.string().optional(),
  managerFonction: z.string().optional(),
  managerTelephone: z.string().optional(),
  managerEmail: z.string().optional().or(z.literal("")),
  email: z.string().optional().or(z.literal("")),
});

const contractSchema = z.object({
  insurerId: z.string().uuid(),
  reference: z.string().min(1),
  dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  typeCouverture: z.enum(["individuel", "familial", "entreprise"]),
  devise: z.string().default("XOF"),
  tauxGeneral: z.coerce.number().min(0).max(100),
  montantAvance: z.coerce.number().int().nonnegative().default(0),
  datePaiementAvance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  modePaiementAvance: z.string().optional(),
  referencePaiementAvance: z.string().optional(),
  statut: z.enum(["brouillon", "actif", "inactif", "expire", "resilie", "cloture"]).default("brouillon"),
  conditions: z.string().optional(),
  factureAssureurPath: z.string().optional().or(z.literal("")),
  chequePath: z.string().optional().or(z.literal("")),
});

const insuredEmployeeSchema = z.object({
  employeeId: z.string().uuid(),
  contractId: z.string().uuid(),
  numeroAdherent: z.string().optional(),
  dateAdhesion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateFinCouverture: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  formule: z.string().optional(),
  tauxParticulier: z.coerce.number().min(0).max(100).optional(),
  plafondIndividuel: z.coerce.number().int().nonnegative().optional(),
  statut: z.enum(["actif", "suspendu", "sorti"]).default("actif"),
});

const optionalUuid = z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : val), z.string().uuid().optional());

const dependentSchema = z.object({
  employeeId: z.string().uuid(),
  insuredEmployeeId: optionalUuid,
  nom: z.string().min(1),
  prenom: z.string().min(1),
  sexe: z.enum(["M", "F", "autre"]).optional(),
  dateNaissance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  lienFamilial: z.enum(["conjoint", "enfant", "pere", "mere", "autre"]),
  numeroAdherent: z.string().optional(),
  dateDebutCouverture: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  dateFinCouverture: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  tauxParticulier: z.coerce.number().min(0).max(100).optional(),
  plafondParticulier: z.coerce.number().int().nonnegative().optional(),
  observations: z.string().optional(),
});

const providerSchema = z.object({
  nom: z.string().min(1),
  adresse: z.string().optional(),
  telephone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  typePrestataire: z.string().optional(),
});

const invoiceSchema = z.object({
  numeroFacture: z.string().optional().or(z.literal("")),
  insuredEmployeeId: z.string().uuid(),
  dependentId: optionalUuid,
  contractId: z.string().uuid(),
  coverageRequestId: optionalUuid,
  providerId: z.string().uuid(),
  dateSoins: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateFacture: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  typeSoin: z.string().min(1),
  montantTotal: z.coerce.number().int().positive(),
  tauxApplique: z.coerce.number().min(0).max(100).optional(),
  justificatifPath: z.string().optional(),
  factureAssureurPath: z.string().optional().or(z.literal("")),
  chequePath: z.string().optional().or(z.literal("")),
  commentaire: z.string().optional(),
});

const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  montant: z.coerce.number().int().positive(),
  datePaiement: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  modePaiement: z.enum(["especes", "cheque", "virement", "mobile_money", "autre"]).default("especes"),
  referencePaiement: z.string().optional(),
  observations: z.string().optional(),
});

const advanceSchema = z.object({
  contractId: z.string().uuid(),
  montant: z.coerce.number().int().positive(),
  datePaiement: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  modePaiement: z.enum(["especes", "cheque", "virement", "mobile_money", "autre"]).default("virement"),
  referencePaiement: z.string().optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const [insurers, contracts, employees, dependents, providers, invoices] = await Promise.all([
      ctx.prisma.insurer.findMany({ where: { statut: "actif" }, orderBy: { nom: "asc" } }),
      ctx.prisma.insuranceContract.findMany({
        include: {
          insurer: true,
          payments: {
            select: {
              id: true,
              typePaiement: true,
              statut: true,
              montant: true,
              datePaiement: true,
              paidBy: true,
              paidAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { dateDebut: "desc" },
      }),
      ctx.prisma.insuredEmployee.findMany({
        where: { statut: "actif" },
        include: { employee: true, contract: { include: { insurer: true } } },
        orderBy: { employee: { lastName: "asc" } },
      }),
      ctx.prisma.employeeDependent.findMany({
        where: { statut: "actif" },
        include: { employee: true, insuredEmployee: true },
        orderBy: { nom: "asc" },
      }),
      ctx.prisma.medicalProvider.findMany({
        where: { statut: "actif" },
        orderBy: { nom: "asc" },
      }),
      ctx.prisma.medicalInvoice.findMany({
        where: { statut: { not: "annulee" } },
        include: {
          insuredEmployee: { include: { employee: true } },
          dependent: true,
          provider: true,
          contract: { include: { insurer: true } },
          payments: true,
        },
        orderBy: { dateSoins: "desc" },
      }),
    ]);

    const totals = invoices.reduce(
      (acc, inv) => {
        acc.totalFactures += inv.montantTotal;
        acc.totalPartEmploye += inv.partEmploye;
        acc.totalPayeEmploye += inv.montantPayeEmploye;
        acc.totalResteEmploye += inv.resteAPayerEmploye;
        acc.totalPartCabinet += inv.partCabinet;
        return acc;
      },
      { totalFactures: 0, totalPartEmploye: 0, totalPayeEmploye: 0, totalResteEmploye: 0, totalPartCabinet: 0 }
    );

    const totalsByEmployee: Record<string, { id: string; nom: string; count: number; total: number; partEmploye: number; paye: number; reste: number; partCabinet: number }> = {};
    for (const inv of invoices) {
      const key = inv.insuredEmployee.employee.id;
      const nom = `${inv.insuredEmployee.employee.firstName} ${inv.insuredEmployee.employee.lastName}`;
      if (!totalsByEmployee[key]) {
        totalsByEmployee[key] = { id: key, nom, count: 0, total: 0, partEmploye: 0, paye: 0, reste: 0, partCabinet: 0 };
      }
      const t = totalsByEmployee[key];
      t.count += 1;
      t.total += inv.montantTotal;
      t.partEmploye += inv.partEmploye;
      t.paye += inv.montantPayeEmploye;
      t.reste += inv.resteAPayerEmploye;
      t.partCabinet += inv.partCabinet;
    }

    const activeContractIds = contracts.filter((c) => c.statut === "actif" || c.statut === "brouillon").map((c) => c.id);
    const advances = await ctx.prisma.insurerPayment.aggregate({
      _sum: { montant: true },
      where: { contractId: { in: activeContractIds }, typePaiement: "avance", statut: { in: ["paye", "valide"] } },
    });
    const totalAvances = advances._sum.montant || 0;

    return NextResponse.json({
      insurers,
      contracts,
      employees,
      dependents,
      providers,
      invoices,
      totals,
      totalsByEmployee: Object.values(totalsByEmployee),
      totalAvances,
      soldeAPayer: Math.max(0, totals.totalPartCabinet - totalAvances),
    });
  } catch (error) {
    console.error("GET assurances error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const { action, ...data } = body;

    if (action === "insurer") {
      const parsed = insurerSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const insurer = await ctx.prisma.insurer.create({ data: parsed.data });
      return NextResponse.json(insurer, { status: 201 });
    }

    if (action === "contract") {
      const parsed = contractSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const contract = await ctx.prisma.insuranceContract.create({
        data: {
          ...parsed.data,
          dateDebut: new Date(parsed.data.dateDebut),
          dateFin: new Date(parsed.data.dateFin),
          datePaiementAvance: parsed.data.datePaiementAvance ? new Date(parsed.data.datePaiementAvance) : undefined,
        },
      });
      if (parsed.data.montantAvance > 0) {
        await ctx.prisma.insurerPayment.create({
          data: {
            contractId: contract.id,
            typePaiement: "avance",
            montant: parsed.data.montantAvance,
            datePaiement: parsed.data.datePaiementAvance ? new Date(parsed.data.datePaiementAvance) : new Date(parsed.data.dateDebut),
            modePaiement: parsed.data.modePaiementAvance || "virement",
            referencePaiement: parsed.data.referencePaiementAvance,
            statut: "valide",
            createdBy: ctx.userId,
          },
        });
      }
      return NextResponse.json(contract, { status: 201 });
    }

    if (action === "insuredEmployee") {
      const parsed = insuredEmployeeSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const ie = await ctx.prisma.insuredEmployee.create({
        data: {
          ...parsed.data,
          dateAdhesion: new Date(parsed.data.dateAdhesion),
          dateFinCouverture: parsed.data.dateFinCouverture ? new Date(parsed.data.dateFinCouverture) : undefined,
        },
      });
      return NextResponse.json(ie, { status: 201 });
    }

    if (action === "dependent") {
      const parsed = dependentSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const dep = await ctx.prisma.employeeDependent.create({
        data: {
          ...parsed.data,
          dateNaissance: parsed.data.dateNaissance ? new Date(parsed.data.dateNaissance) : undefined,
          dateDebutCouverture: parsed.data.dateDebutCouverture ? new Date(parsed.data.dateDebutCouverture) : undefined,
          dateFinCouverture: parsed.data.dateFinCouverture ? new Date(parsed.data.dateFinCouverture) : undefined,
        },
      });
      return NextResponse.json(dep, { status: 201 });
    }

    if (action === "provider") {
      const parsed = providerSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const provider = await ctx.prisma.medicalProvider.create({ data: parsed.data });
      return NextResponse.json(provider, { status: 201 });
    }

    if (action === "invoice") {
      const parsed = invoiceSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

      const contract = await ctx.prisma.insuranceContract.findUnique({
        where: { id: parsed.data.contractId },
      });
      if (!contract) return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });

      const insured = await ctx.prisma.insuredEmployee.findUnique({
        where: { id: parsed.data.insuredEmployeeId },
        include: { employee: true },
      });
      if (!insured) return NextResponse.json({ error: "Employé assuré introuvable" }, { status: 404 });

      let taux = parsed.data.tauxApplique ?? contract.tauxGeneral;
      if (insured.tauxParticulier != null) taux = insured.tauxParticulier;
      const dependent = parsed.data.dependentId
        ? await ctx.prisma.employeeDependent.findUnique({ where: { id: parsed.data.dependentId } })
        : null;
      if (dependent?.tauxParticulier != null) taux = dependent.tauxParticulier;

      const partCabinet = Math.round((parsed.data.montantTotal * taux) / 100);
      const partEmploye = parsed.data.montantTotal - partCabinet;
      const statutPaiementEmploye = partEmploye === 0 ? "exonere" : "paye";

      const referenceInterne = `FAC-ASS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const invoice = await ctx.prisma.$transaction(async (prisma) => {
        const inv = await prisma.medicalInvoice.create({
          data: {
            ...parsed.data,
            referenceInterne,
            dateSoins: new Date(parsed.data.dateSoins),
            dateFacture: new Date(parsed.data.dateFacture),
            tauxApplique: taux,
            partCabinet,
            partEmploye,
            montantPayeEmploye: partEmploye,
            resteAPayerEmploye: 0,
            statutPaiementEmploye,
            createdBy: ctx.userId,
          },
        });
        if (partEmploye > 0) {
          await prisma.employeeInsurancePayment.create({
            data: {
              invoiceId: inv.id,
              montant: partEmploye,
              datePaiement: new Date(parsed.data.dateFacture),
              modePaiement: "especes",
              receivedBy: ctx.userId,
            },
          });
        }
        return inv;
      });
      return NextResponse.json(invoice, { status: 201 });
    }

    if (action === "payment") {
      const parsed = paymentSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const invoice = await ctx.prisma.medicalInvoice.findUnique({ where: { id: parsed.data.invoiceId } });
      if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
      if (parsed.data.montant > invoice.resteAPayerEmploye) {
        return NextResponse.json({ error: "Paiement supérieur au reste à payer" }, { status: 400 });
      }
      const [payment] = await ctx.prisma.$transaction([
        ctx.prisma.employeeInsurancePayment.create({
          data: { ...parsed.data, datePaiement: new Date(parsed.data.datePaiement), receivedBy: ctx.userId },
        }),
        ctx.prisma.medicalInvoice.update({
          where: { id: parsed.data.invoiceId },
          data: {
            montantPayeEmploye: { increment: parsed.data.montant },
            resteAPayerEmploye: { decrement: parsed.data.montant },
            statutPaiementEmploye: invoice.resteAPayerEmploye - parsed.data.montant === 0 ? "paye" : "partiel",
          },
        }),
      ]);
      return NextResponse.json(payment, { status: 201 });
    }

    if (action === "advance") {
      const parsed = advanceSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const payment = await ctx.prisma.insurerPayment.create({
        data: { ...parsed.data, datePaiement: new Date(parsed.data.datePaiement), typePaiement: "avance", statut: "brouillon", createdBy: ctx.userId },
      });
      return NextResponse.json(payment, { status: 201 });
    }

    if (action === "toggle_contract") {
      const parsed = z.object({ id: z.string().uuid(), statut: z.enum(["actif", "inactif"]) }).safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const { id, statut } = parsed.data;
      const isManager =
        ctx.roleInfo.estAdmin ||
        ctx.roleInfo.nom.toLowerCase().includes("comptable") ||
        ctx.roleInfo.nom.toLowerCase().includes("directeur") ||
        ctx.roleInfo.nom.toLowerCase().includes("associé") ||
        ctx.roleInfo.nom.toLowerCase().includes("associe");
      if (!isManager) return NextResponse.json({ error: "Action réservée" }, { status: 403 });
      const contract = await ctx.prisma.insuranceContract.update({ where: { id }, data: { statut } });
      return NextResponse.json(contract);
    }

    if (action === "validate_contract") {
      const parsed = idSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const { id } = parsed.data;
      const isManager =
        ctx.roleInfo.estAdmin ||
        ctx.roleInfo.nom.toLowerCase().includes("comptable") ||
        ctx.roleInfo.nom.toLowerCase().includes("directeur") ||
        ctx.roleInfo.nom.toLowerCase().includes("associé") ||
        ctx.roleInfo.nom.toLowerCase().includes("associe");
      if (!isManager) return NextResponse.json({ error: "Action réservée" }, { status: 403 });
      const contract = await ctx.prisma.insuranceContract.update({ where: { id }, data: { statut: "actif" } });
      return NextResponse.json(contract);
    }

    if (action === "request_advance_contract") {
      const parsed = idSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const { id } = parsed.data;
      const contract = await ctx.prisma.insuranceContract.findUnique({ where: { id } });
      if (!contract) return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
      if (contract.statut !== "actif") return NextResponse.json({ error: "Le contrat doit être actif" }, { status: 400 });
      if (contract.montantAvance <= 0) return NextResponse.json({ error: "Aucune avance à payer" }, { status: 400 });
      const existing = await ctx.prisma.insurerPayment.findFirst({
        where: { contractId: id, typePaiement: "avance", statut: { not: "annule" } },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        return NextResponse.json({ error: "Une avance est déjà enregistrée pour ce contrat" }, { status: 409 });
      }
      const now = new Date();
      const payment = await ctx.prisma.insurerPayment.create({
        data: {
          contractId: id,
          typePaiement: "avance",
          montant: contract.montantAvance,
          datePaiement: contract.datePaiementAvance ? new Date(contract.datePaiementAvance) : now,
          modePaiement: contract.modePaiementAvance || "virement",
          referencePaiement: contract.referencePaiementAvance,
          statut: "brouillon",
          createdBy: ctx.userId,
        },
      });
      return NextResponse.json(payment, { status: 201 });
    }

    if (action === "approve_advance") {
      const parsed = idSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const { id } = parsed.data;
      const isManager =
        ctx.roleInfo.estAdmin ||
        ctx.roleInfo.nom.toLowerCase().includes("directeur") ||
        ctx.roleInfo.nom.toLowerCase().includes("associé") ||
        ctx.roleInfo.nom.toLowerCase().includes("associe");
      if (!isManager) return NextResponse.json({ error: "Action réservée" }, { status: 403 });
      const payment = await ctx.prisma.insurerPayment.findUnique({ where: { id } });
      if (!payment) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
      if (payment.statut !== "brouillon") return NextResponse.json({ error: "Ce paiement n'est pas en attente d'approbation" }, { status: 409 });
      const updated = await ctx.prisma.insurerPayment.update({
        where: { id },
        data: { statut: "approuve", approvedBy: ctx.userId, approvedAt: new Date() },
      });
      return NextResponse.json(updated);
    }

    if (action === "pay_advance") {
      const parsed = idSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const { id } = parsed.data;
      if (!ctx.roleInfo.nom.toLowerCase().includes("comptable")) {
        return NextResponse.json({ error: "Action réservée aux comptables" }, { status: 403 });
      }
      const payment = await ctx.prisma.insurerPayment.findUnique({
        where: { id },
        include: { contract: { include: { insurer: true } } },
      });
      if (!payment) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
      if (payment.statut !== "approuve") return NextResponse.json({ error: "Le paiement doit être approuvé avant règlement" }, { status: 409 });

      const updated = await ctx.prisma.$transaction(async (tx) => {
        const p = await tx.insurerPayment.update({
          where: { id },
          data: { statut: "paye", paidBy: ctx.userId, paidAt: new Date() },
        });
        const entry = await createEntryFromInsuranceAdvance(tx, ctx.tenantId, payment, ctx.userId);
        await tx.insurerPayment.update({
          where: { id: p.id },
          data: { accountingEntryId: entry.id },
        });
        return p;
      });
      return NextResponse.json(updated);
    }

    if (action === "update_insurer") {
      const parsed = z.object({ id: z.string().uuid() }).merge(insurerSchema.partial().required({ nom: true })).safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const { id, ...rest } = parsed.data;
      const insurer = await ctx.prisma.insurer.update({ where: { id }, data: rest });
      return NextResponse.json(insurer);
    }

    if (action === "update_contract") {
      const parsed = z.object({ id: z.string().uuid() }).merge(contractSchema).safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const { id, ...rest } = parsed.data;
      const contract = await ctx.prisma.insuranceContract.update({
        where: { id },
        data: {
          ...rest,
          dateDebut: new Date(rest.dateDebut),
          dateFin: new Date(rest.dateFin),
          datePaiementAvance: rest.datePaiementAvance ? new Date(rest.datePaiementAvance) : undefined,
        },
      });
      return NextResponse.json(contract);
    }

    if (action === "update_insuredEmployee") {
      const parsed = z.object({ id: z.string().uuid() }).merge(insuredEmployeeSchema).safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const { id, ...rest } = parsed.data;
      const ie = await ctx.prisma.insuredEmployee.update({
        where: { id },
        data: {
          ...rest,
          dateAdhesion: new Date(rest.dateAdhesion),
          dateFinCouverture: rest.dateFinCouverture ? new Date(rest.dateFinCouverture) : undefined,
        },
      });
      return NextResponse.json(ie);
    }

    if (action === "update_dependent") {
      const parsed = z.object({ id: z.string().uuid() }).merge(dependentSchema).safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const { id, ...rest } = parsed.data;
      const dep = await ctx.prisma.employeeDependent.update({
        where: { id },
        data: {
          ...rest,
          dateNaissance: rest.dateNaissance ? new Date(rest.dateNaissance) : undefined,
          dateDebutCouverture: rest.dateDebutCouverture ? new Date(rest.dateDebutCouverture) : undefined,
          dateFinCouverture: rest.dateFinCouverture ? new Date(rest.dateFinCouverture) : undefined,
        },
      });
      return NextResponse.json(dep);
    }

    if (action === "update_provider") {
      const parsed = z.object({ id: z.string().uuid() }).merge(providerSchema).safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const { id, ...rest } = parsed.data;
      const provider = await ctx.prisma.medicalProvider.update({ where: { id }, data: rest });
      return NextResponse.json(provider);
    }

    if (action === "approve_invoice") {
      const parsed = idSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const { id } = parsed.data;

      const isManager =
        ctx.roleInfo.estAdmin ||
        ctx.roleInfo.nom.toLowerCase().includes("comptable") ||
        ctx.roleInfo.nom.toLowerCase().includes("directeur") ||
        ctx.roleInfo.nom.toLowerCase().includes("associé") ||
        ctx.roleInfo.nom.toLowerCase().includes("associe");
      if (!isManager) {
        return NextResponse.json({ error: "Action réservée" }, { status: 403 });
      }

      const updated = await ctx.prisma.medicalInvoice.update({
        where: { id },
        data: { statut: "validee" },
      });
      return NextResponse.json(updated);
    }

    if (action === "pay_invoice") {
      const parsed = idSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const { id } = parsed.data;

      if (!ctx.roleInfo.nom.toLowerCase().includes("comptable")) {
        return NextResponse.json({ error: "Action réservée aux comptables" }, { status: 403 });
      }

      const invoice = await ctx.prisma.medicalInvoice.findUnique({
        where: { id },
        include: {
          insuredEmployee: { include: { employee: true } },
          dependent: true,
          provider: true,
          contract: { include: { insurer: true } },
        },
      });
      if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
      if (invoice.statut !== "validee") return NextResponse.json({ error: "La facture doit être validée avant paiement" }, { status: 400 });

      const category =
        (await ctx.prisma.chargeCategory.findUnique({ where: { code: "sante" } })) ||
        (await ctx.prisma.chargeCategory.findUnique({ where: { code: "divers" } }));
      if (!category) return NextResponse.json({ error: "Aucune catégorie de charge disponible" }, { status: 400 });

      const beneficiaire = invoice.dependent
        ? `${invoice.dependent.prenom} ${invoice.dependent.nom}`
        : `${invoice.insuredEmployee.employee.firstName} ${invoice.insuredEmployee.employee.lastName}`;

      const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.medicalInvoice.update({
          where: { id },
          data: { statut: "payee_cabinet" },
        }),
        ctx.prisma.charge.create({
          data: {
            categoryId: category.id,
            chargeDate: invoice.dateFacture,
            amount: invoice.montantTotal,
            totalHt: invoice.montantTotal,
            taxAmount: 0,
            tvaEnabled: false,
            paymentMethod: "virement",
            description: `Soins ${invoice.typeSoin} - ${beneficiaire}`,
            supplierName: invoice.provider.nom,
            supplierInvoiceRef: invoice.numeroFacture || invoice.referenceInterne,
            status: "a_payer",
            isPaid: false,
            metadata: {
              source: "medical_invoice",
              medicalInvoiceId: invoice.id,
              reference: invoice.referenceInterne,
            },
            createdBy: ctx.userId,
          },
        }),
      ]);

      return NextResponse.json(updated);
    }

    if (action === "update_invoice") {
      const updateInvoiceSchema = z.object({ id: z.string().uuid() }).merge(invoiceSchema.partial());
      const parsed = updateInvoiceSchema.safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const { id, ...rest } = parsed.data;

      const invoice = await ctx.prisma.medicalInvoice.findUnique({ where: { id } });
      if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

      const shouldRecalc =
        rest.montantTotal !== undefined ||
        rest.tauxApplique !== undefined ||
        rest.insuredEmployeeId !== undefined ||
        rest.contractId !== undefined ||
        rest.dependentId !== undefined;

      let taux = invoice.tauxApplique;
      let total = invoice.montantTotal;

      if (shouldRecalc) {
        const contract = await ctx.prisma.insuranceContract.findUnique({
          where: { id: rest.contractId ?? invoice.contractId },
        });
        if (!contract) return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });

        const insured = await ctx.prisma.insuredEmployee.findUnique({
          where: { id: rest.insuredEmployeeId ?? invoice.insuredEmployeeId },
          include: { employee: true },
        });
        if (!insured) return NextResponse.json({ error: "Employé assuré introuvable" }, { status: 404 });

        const depId = rest.dependentId !== undefined ? rest.dependentId : invoice.dependentId;
        const dependent = depId ? await ctx.prisma.employeeDependent.findUnique({ where: { id: depId } }) : null;

        if (rest.tauxApplique !== undefined) {
          taux = rest.tauxApplique;
        } else {
          taux = contract.tauxGeneral;
          if (insured.tauxParticulier != null) taux = insured.tauxParticulier;
          if (dependent?.tauxParticulier != null) taux = dependent.tauxParticulier;
        }

        if (rest.montantTotal !== undefined) total = rest.montantTotal;
      }

      const updateData: any = { ...rest };
      if (rest.dateSoins) updateData.dateSoins = new Date(rest.dateSoins);
      if (rest.dateFacture) updateData.dateFacture = new Date(rest.dateFacture);

      if (shouldRecalc) {
        const partCabinet = Math.round((total * taux) / 100);
        const partEmploye = total - partCabinet;
        updateData.tauxApplique = taux;
        updateData.montantTotal = total;
        updateData.partCabinet = partCabinet;
        updateData.partEmploye = partEmploye;
        updateData.montantPayeEmploye = partEmploye;
        updateData.resteAPayerEmploye = 0;
        updateData.statutPaiementEmploye = partEmploye === 0 ? "exonere" : "paye";
      }

      const updated = await ctx.prisma.medicalInvoice.update({ where: { id }, data: updateData });

      if (shouldRecalc && updated.partEmploye > 0) {
        await ctx.prisma.employeeInsurancePayment.deleteMany({ where: { invoiceId: id } });
        await ctx.prisma.employeeInsurancePayment.create({
          data: {
            invoiceId: id,
            montant: updated.partEmploye,
            datePaiement: updated.dateFacture,
            modePaiement: "especes",
            receivedBy: ctx.userId,
          },
        });
      }

      return NextResponse.json(updated);
    }

    if (action === "toggle_status") {
      const parsed = z.object({
        id: z.string().uuid(),
        model: z.enum(["insurer", "contract", "insuredEmployee", "dependent", "provider", "invoice"]),
        statut: z.string(),
      }).safeParse(data);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      const { id, model, statut } = parsed.data;

      // Statuts autorisés par modèle (désactivation/réactivation, jamais de suppression)
      const allowed: Record<string, string[]> = {
        insurer: ["actif", "inactif"],
        contract: ["actif", "inactif"],
        insuredEmployee: ["actif", "suspendu"],
        dependent: ["actif", "inactif"],
        provider: ["actif", "inactif"],
        invoice: ["brouillon", "annulee"],
      };
      if (!allowed[model].includes(statut)) {
        return NextResponse.json({ error: `Statut "${statut}" non autorisé pour ${model}` }, { status: 400 });
      }

      if (model === "insurer") return NextResponse.json(await ctx.prisma.insurer.update({ where: { id }, data: { statut } }));
      if (model === "contract") return NextResponse.json(await ctx.prisma.insuranceContract.update({ where: { id }, data: { statut } }));
      if (model === "insuredEmployee") return NextResponse.json(await ctx.prisma.insuredEmployee.update({ where: { id }, data: { statut } }));
      if (model === "dependent") return NextResponse.json(await ctx.prisma.employeeDependent.update({ where: { id }, data: { statut } }));
      if (model === "provider") return NextResponse.json(await ctx.prisma.medicalProvider.update({ where: { id }, data: { statut } }));
      if (model === "invoice") return NextResponse.json(await ctx.prisma.medicalInvoice.update({ where: { id }, data: { statut } }));
      return NextResponse.json({ error: "Modèle inconnu" }, { status: 400 });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    console.error("POST assurances error", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : String(error.meta?.target || "champ");
        return NextResponse.json({ error: `Conflit : ${target} existe déjà.` }, { status: 409 });
      }
      if (error.code === "P2003") {
        return NextResponse.json({ error: "Référence introuvable (clé étrangère)." }, { status: 400 });
      }
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
