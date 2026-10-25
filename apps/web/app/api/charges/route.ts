import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { canAccessDossier, getDossierScopedAccessFilter } from "@/lib/rbac";
import { createEntryFromCharge, createEntryFromAmortissement } from "@/lib/accounting";
import {
  buildAmortissementPlan,
  computeDotationMensuelle,
  type AmortissementRow,
} from "@/lib/immobilisation";

const chargeSchema = z.object({
  categoryId: z.string().uuid(),
  dossierId: z.string().uuid().optional().nullable(),
  tacheId: z.string().uuid().optional().nullable(),
  missionId: z.string().uuid().optional().nullable(),
  chargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().int().positive(),
  tvaEnabled: z.boolean().default(false),
  tvaRateId: z.string().uuid().nullable().optional(),
  paymentMethod: z.string().min(1),
  description: z.string().optional(),
  supplierName: z.string().optional(),
  supplierInvoiceRef: z.string().optional(),
  // Immobilisation amortie : le bien entre en classe 2 et la charge est étalée
  // sur `immobilisationMonths` mois par des dotations aux amortissements.
  isImmobilisation: z.boolean().default(false),
  immobilisationMode: z.enum(["montant", "taux"]).optional().nullable(),
  immobilisationRate: z.number().positive().max(100).optional().nullable(),
  immobilisationMonths: z.number().int().positive().max(600).optional().nullable(),
  immobilisationAccountCode: z.string().min(1).optional().nullable(),
  amortissementStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  monthlyPayment: z.number().int().positive().optional().nullable(),
  lines: z.array(
    z.object({
      description: z.string().min(1),
      quantite: z.number().int().positive().default(1),
      prixUnitaire: z.number().int().nonnegative().default(0),
      tauxTva: z.number().nonnegative().default(0),
      totalHt: z.number().int().nonnegative().default(0),
      totalTva: z.number().int().nonnegative().default(0),
      totalTtc: z.number().int().nonnegative().default(0),
      ordre: z.number().int().default(0),
    })
  ).optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");

  const accessFilter = await getDossierScopedAccessFilter(ctx.prisma, ctx.userId, ctx.roleInfo, "comptabilite");
  const dossierIds = (accessFilter as any).dossierId?.in as string[] | undefined;

  const where = !dossierIds || dossierIds.length === 0
    ? { ...(categoryId ? { categoryId } : {}) }
    : {
        ...(categoryId ? { categoryId } : {}),
        OR: [
          { dossierId: null },
          { dossierId: { in: dossierIds } },
          { tache: { dossierId: { in: dossierIds } } },
          { missionHuissier: { dossierId: { in: dossierIds } } },
        ],
      };

  const charges = await ctx.prisma.charge.findMany({
    where,
    include: {
      category: true,
      tvaRate: { select: { code: true, rate: true, label: true } },
      dossier: { select: { referenceInterne: true } },
      tache: { select: { titre: true } },
      missionHuissier: { select: { typeActe: true } },
      lines: { orderBy: { ordre: "asc" } },
      amortissements: { orderBy: { numero: "asc" } },
    },
    orderBy: { chargeDate: "desc" },
    take: 100,
  });

  return NextResponse.json(charges);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = chargeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const {
      categoryId, dossierId, tacheId, missionId, chargeDate, amount, tvaEnabled, tvaRateId,
      paymentMethod, description, supplierName, supplierInvoiceRef, lines,
      isImmobilisation, immobilisationMode, immobilisationRate, immobilisationMonths,
      immobilisationAccountCode, amortissementStartDate, monthlyPayment,
    } = parsed.data;

    const category = await ctx.prisma.chargeCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      return NextResponse.json({ error: "Catégorie inconnue" }, { status: 400 });
    }

    // Résolution du dossier lié et vérification d'accès.
    let resolvedDossierId = dossierId;
    if (!resolvedDossierId && tacheId) {
      const tache = await ctx.prisma.tache.findUnique({
        where: { id: tacheId },
        select: { dossierId: true },
      });
      if (!tache) {
        return NextResponse.json({ error: "Tâche non trouvée" }, { status: 404 });
      }
      resolvedDossierId = tache.dossierId;
    } else if (!resolvedDossierId && missionId) {
      const mission = await ctx.prisma.missionHuissier.findUnique({
        where: { id: missionId },
        select: { dossierId: true },
      });
      if (!mission) {
        return NextResponse.json({ error: "Mission non trouvée" }, { status: 404 });
      }
      resolvedDossierId = mission.dossierId;
    }

    if (resolvedDossierId) {
      const dossierOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, resolvedDossierId, "write");
      if (!dossierOk) {
        return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
      }
    }

    let totalHt: number | null = null;
    let taxAmount: number | null = null;
    let rate = 0;

    if (tvaEnabled && tvaRateId) {
      const tvaRate = await ctx.prisma.tvaRate.findUnique({ where: { id: tvaRateId } });
      rate = tvaRate?.rate || 0;
      totalHt = Math.round((amount / (1 + rate / 100)) * 100) / 100;
      taxAmount = Math.round((amount - totalHt) * 100) / 100;
    }

    // Si des lignes sont fournies, on recalcule les totaux à partir des lignes
    let linesTotalHt = totalHt;
    let linesTotalTva = taxAmount;
    if (lines && lines.length > 0) {
      linesTotalHt = Math.round(lines.reduce((s, l) => s + l.totalHt, 0) * 100) / 100;
      linesTotalTva = Math.round(lines.reduce((s, l) => s + l.totalTva, 0) * 100) / 100;
    }

    // --- Immobilisation amortie : contrôles et plan d'amortissement ---
    let plan: AmortissementRow[] = [];
    let dotation = 0;
    let dureeMois = 0;
    let immoAccountCode: string | null = null;

    if (isImmobilisation) {
      if (!immobilisationAccountCode) {
        return NextResponse.json(
          { error: "Compte d'immobilisation (classe 2) requis" },
          { status: 400 }
        );
      }
      const immoAccount = await ctx.prisma.accountingAccount.findUnique({
        where: { accountCode: immobilisationAccountCode },
        select: { accountCode: true, class: true },
      });
      if (!immoAccount || immoAccount.class !== 2) {
        return NextResponse.json(
          { error: "Le compte d'immobilisation doit être un compte de classe 2" },
          { status: 400 }
        );
      }
      immoAccountCode = immoAccount.accountCode;

      const mode = immobilisationMode || "montant";
      if (mode === "taux" && !immobilisationRate) {
        return NextResponse.json({ error: "Taux d'amortissement requis" }, { status: 400 });
      }
      if (mode === "montant" && !monthlyPayment) {
        return NextResponse.json({ error: "Dotation mensuelle requise" }, { status: 400 });
      }

      // Base amortissable = valeur HT du bien.
      const base = linesTotalHt ?? amount;
      const computed = computeDotationMensuelle({
        base,
        mode,
        rate: immobilisationRate,
        monthlyAmount: monthlyPayment,
        months: immobilisationMonths,
      });
      dotation = computed.monthly;
      dureeMois = computed.months;

      plan = buildAmortissementPlan({
        base,
        monthly: dotation,
        months: dureeMois,
        startDate: new Date(`${amortissementStartDate || chargeDate}T12:00:00Z`),
      });
      if (plan.length === 0) {
        return NextResponse.json(
          { error: "Plan d'amortissement vide : vérifiez la dotation et la durée" },
          { status: 400 }
        );
      }
    }

    const charge = await ctx.prisma.$transaction(async (tx) => {
      const c = await tx.charge.create({
        data: {
          categoryId,
          dossierId: resolvedDossierId || null,
          tacheId: tacheId || null,
          missionHuissierId: missionId || null,
          chargeDate: new Date(chargeDate),
          amount,
          totalHt: linesTotalHt,
          taxAmount: linesTotalTva,
          tvaEnabled,
          tvaRateId: tvaEnabled ? tvaRateId : null,
          paymentMethod,
          description,
          supplierName,
          supplierInvoiceRef,
          status: "a_payer",
          isPaid: false,
          paidAt: null,
          isImmobilisation,
          immobilisationMode: isImmobilisation ? immobilisationMode || "montant" : null,
          immobilisationRate: isImmobilisation ? immobilisationRate ?? null : null,
          immobilisationMonths: isImmobilisation ? dureeMois : null,
          immobilisationAccountCode: immoAccountCode,
          amortissementStartDate: isImmobilisation
            ? new Date(`${amortissementStartDate || chargeDate}T12:00:00Z`)
            : null,
          monthlyPayment: isImmobilisation ? dotation : null,
          createdBy: ctx.userId,
          ...(lines && lines.length > 0
            ? { lines: { create: lines.map((l, i) => ({ ...l, ordre: l.ordre ?? i })) } }
            : {}),
          ...(plan.length > 0 ? { amortissements: { create: plan } } : {}),
        },
        include: {
          category: true,
          dossier: { select: { referenceInterne: true } },
          tache: { select: { titre: true } },
          missionHuissier: { select: { typeActe: true } },
          lines: { orderBy: { ordre: "asc" } },
          amortissements: { orderBy: { numero: "asc" } },
        },
      });

      // L'écriture comptable (SYSCOHADA) est générée au moment du paiement
      // de la charge (passage de isPaid=false à isPaid=true via PATCH).
      return c;
    });

    await logAudit(ctx.prisma, ctx.userId, "charge_created", "charge", charge.id);
    return NextResponse.json(charge, { status: 201 });
  } catch (error) {
    console.error("Create charge error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
