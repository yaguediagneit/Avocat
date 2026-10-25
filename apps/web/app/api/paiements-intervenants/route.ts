import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { canAccessDossier } from "@/lib/rbac";

const lineSchema = z.object({
  description: z.string().min(1),
  quantite: z.number().int().nonnegative().default(1),
  prixUnitaire: z.number().int().nonnegative().default(0),
  tauxTva: z.number().nonnegative().default(0),
  totalHt: z.number().int().nonnegative().default(0),
  totalTva: z.number().int().nonnegative().default(0),
  totalTtc: z.number().int().nonnegative().default(0),
  ordre: z.number().int().default(0),
});

const schema = z.object({
  intervenantType: z.string().min(1),
  intervenantName: z.string().min(1),
  referenceType: z.enum(["dossier", "tache", "mission"]),
  dossierId: z.string().uuid().nullable().optional(),
  tacheId: z.string().uuid().nullable().optional(),
  missionId: z.string().uuid().nullable().optional(),
  missionType: z.string().nullable().optional(),
  taxMode: z.enum(["exonere", "tva", "prelevement_impots"]),
  tvaRateId: z.string().uuid().nullable().optional(),
  withholdingRate: z.number().nonnegative().nullable().optional(),
  chargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.string().min(1),
  libelle: z.string().min(1),
  designation: z.string().optional(),
  amount: z.number().int().positive(),
  totalHt: z.number().int().nonnegative(),
  taxAmount: z.number().int().nonnegative(),
  netAmount: z.number().int().nonnegative(),
  tvaEnabled: z.boolean().default(false),
  lines: z.array(lineSchema).min(1),
});

async function ensureCategory(prisma: any) {
  let category = await prisma.chargeCategory.findUnique({
    where: { code: "PAIEMENT_INTERVENANT" },
  });
  if (!category) {
    category = await prisma.chargeCategory.create({
      data: {
        code: "PAIEMENT_INTERVENANT",
        label: "Paiement intervenant externe",
        accountCode: "622",
      },
    });
  }
  return category;
}

async function resolveDossierId(prisma: any, data: z.infer<typeof schema>) {
  if (data.dossierId) return data.dossierId;
  if (data.tacheId) {
    const tache = await prisma.tache.findUnique({
      where: { id: data.tacheId },
      select: { dossierId: true },
    });
    return tache?.dossierId || null;
  }
  if (data.missionId && data.missionType) {
    if (data.missionType === "huissier") {
      const m = await prisma.missionHuissier.findUnique({
        where: { id: data.missionId },
        select: { dossierId: true },
      });
      return m?.dossierId || null;
    }
    if (data.missionType === "architecte") {
      const m = await prisma.missionArchitecte.findUnique({
        where: { id: data.missionId },
        select: { dossierId: true },
      });
      return m?.dossierId || null;
    }
    if (data.missionType === "conseiller_juridique") {
      const m = await prisma.missionConseillerJuridique.findUnique({
        where: { id: data.missionId },
        select: { dossierId: true },
      });
      return m?.dossierId || null;
    }
    if (data.missionType === "clerc") {
      const m = await prisma.missionClerc.findUnique({
        where: { id: data.missionId },
        select: { dossierId: true },
      });
      return m?.dossierId || null;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    if (data.taxMode === "tva" && !data.tvaRateId) {
      return NextResponse.json({ error: "Taux de TVA requis" }, { status: 400 });
    }

    const resolvedDossierId = await resolveDossierId(ctx.prisma, data);
    if (!resolvedDossierId) {
      return NextResponse.json({ error: "Référence invalide" }, { status: 400 });
    }

    const dossierOk = await canAccessDossier(
      ctx.prisma,
      ctx.userId,
      ctx.roleInfo,
      resolvedDossierId,
      "write"
    );
    if (!dossierOk) {
      return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
    }

    const totalHt = data.lines.reduce((s, l) => s + l.totalHt, 0);
    const totalTva = data.lines.reduce((s, l) => s + l.totalTva, 0);
    const totalTtc = data.lines.reduce((s, l) => s + l.totalTtc, 0);
    const amount = totalTtc;
    let taxAmount = 0;
    let netAmount = amount;

    if (data.taxMode === "tva") {
      taxAmount = totalTva;
      netAmount = amount;
    } else if (data.taxMode === "prelevement_impots" && data.withholdingRate) {
      taxAmount = Math.max(0, Math.round(totalHt * (data.withholdingRate / 100)));
      netAmount = Math.max(0, amount - taxAmount);
    }

    const category = await ensureCategory(ctx.prisma);

    const metadata: Record<string, unknown> = {
      intervenantType: data.intervenantType,
      intervenantName: data.intervenantName,
      taxMode: data.taxMode,
      referenceType: data.referenceType,
      referenceMissionType: data.missionType,
      referenceMissionId: data.missionId,
      netAmount,
    };
    if (data.taxMode === "tva") metadata.tvaRateId = data.tvaRateId;
    if (data.taxMode === "prelevement_impots") metadata.withholdingRate = data.withholdingRate;

    const isHuissier = data.missionType === "huissier";

    const charge = await ctx.prisma.$transaction(async (tx: any) => {
      const c = await tx.charge.create({
        data: {
          categoryId: category.id,
          dossierId: resolvedDossierId,
          tacheId: data.referenceType === "tache" ? data.tacheId : null,
          missionHuissierId: isHuissier && data.missionId ? data.missionId : null,
          chargeDate: new Date(data.chargeDate),
          amount,
          totalHt,
          taxAmount,
          tvaEnabled: data.taxMode === "tva",
          tvaRateId: data.taxMode === "tva" ? data.tvaRateId : null,
          paymentMethod: data.paymentMethod,
          description: data.libelle,
          supplierName: data.intervenantName,
          supplierInvoiceRef: data.designation,
          status: "draft",
          isPaid: false,
          createdBy: ctx.userId,
          metadata,
          lines: { create: data.lines.map((l, i) => ({ ...l, ordre: l.ordre ?? i })) },
        },
        include: {
          category: true,
          tvaRate: { select: { code: true, rate: true } },
          lines: { orderBy: { ordre: "asc" } },
        },
      });

      return c;
    });

    await logAudit(ctx.prisma, ctx.userId, "paiement_intervenant_created", "charge", charge.id);
    return NextResponse.json(charge, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Create paiement intervenant error", error);
    return NextResponse.json({ error: "Erreur serveur", details: message }, { status: 500 });
  }
}
