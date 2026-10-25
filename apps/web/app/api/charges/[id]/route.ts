import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { createEntryFromCharge, createEntryFromAmortissement } from "@/lib/accounting";

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

const chargeUpdateSchema = z.object({
  categoryId: z.string().uuid().optional(),
  chargeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.number().int().positive().optional(),
  tvaEnabled: z.boolean().optional(),
  tvaRateId: z.string().uuid().nullable().optional(),
  paymentMethod: z.string().min(1).optional(),
  description: z.string().optional(),
  supplierName: z.string().optional(),
  supplierInvoiceRef: z.string().optional(),
  actif: z.boolean().optional(),
  isPaid: z.boolean().optional(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  lines: z.array(lineSchema).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const charge = await ctx.prisma.charge.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        tvaRate: { select: { code: true, rate: true } },
        lines: { orderBy: { ordre: "asc" } },
      },
    });
    if (!charge) {
      return NextResponse.json({ error: "Charge non trouvée" }, { status: 404 });
    }
    return NextResponse.json(charge);
  } catch (error) {
    console.error("Get charge error", error);
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
    const parsed = chargeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { chargeDate, lines, amount, paidAt, ...data } = parsed.data;

    // Une immobilisation dont des dotations sont déjà comptabilisées ne peut plus
    // voir son montant modifié : le plan d'amortissement et les écritures seraient
    // désynchronisés.
    if (amount !== undefined) {
      const existing = await ctx.prisma.charge.findUnique({
        where: { id: params.id },
        select: {
          amount: true,
          isImmobilisation: true,
          _count: { select: { amortissements: { where: { isPosted: true } } } },
        },
      });
      if (
        existing?.isImmobilisation &&
        existing._count.amortissements > 0 &&
        amount !== existing.amount
      ) {
        return NextResponse.json(
          {
            error:
              "Montant non modifiable : des dotations aux amortissements sont déjà comptabilisées.",
          },
          { status: 400 }
        );
      }
    }

    const updateData: any = {
      ...data,
      chargeDate: chargeDate ? new Date(chargeDate) : undefined,
      amount,
      paidAt: paidAt ? new Date(paidAt) : paidAt === null ? null : undefined,
    };

    if (lines && lines.length > 0) {
      await ctx.prisma.chargeLine.deleteMany({ where: { chargeId: params.id } });
      updateData.lines = {
        create: lines.map((l, i) => ({ ...l, ordre: l.ordre ?? i })),
      };
      updateData.totalHt = lines.reduce((s, l) => s + l.totalHt, 0);
      updateData.taxAmount = lines.reduce((s, l) => s + l.totalTva, 0);
    } else if (amount !== undefined && !lines) {
      if (data.tvaEnabled && data.tvaRateId) {
        const tvaRate = await ctx.prisma.tvaRate.findUnique({ where: { id: data.tvaRateId } });
        const rate = tvaRate?.rate || 0;
        updateData.totalHt = Math.round((amount / (1 + rate / 100)) * 100) / 100;
        updateData.taxAmount = Math.round((amount - updateData.totalHt) * 100) / 100;
      } else if (data.tvaEnabled === false) {
        updateData.totalHt = amount;
        updateData.taxAmount = 0;
      }
    }

    const charge = await ctx.prisma.charge.update({
      where: { id: params.id },
      data: updateData,
      include: {
        lines: { orderBy: { ordre: "asc" } },
        category: true,
        amortissements: { orderBy: { numero: "asc" } },
      },
    });

    // Lors du passage à "payée", générer l'écriture comptable SYSCOHADA
    // (D charge/TVA — C trésorerie) et les dotations échues si immobilisation.
    // Seul un comptable (ou un administrateur) peut valider le paiement.
    if (data.isPaid === true) {
      const isComptable =
        ctx.roleInfo.nom.toLowerCase().includes("comptable") || ctx.roleInfo.estAdmin;
      if (!isComptable) {
        return NextResponse.json(
          { error: "Seul un comptable peut valider le paiement" },
          { status: 403 }
        );
      }
      updateData.status = "payee";
      await ctx.prisma.$transaction(async (tx) => {
        await createEntryFromCharge(tx, ctx.tenantId, charge, charge.category, ctx.userId);

        const now = new Date();
        for (const d of charge.amortissements ?? []) {
          if (new Date(d.dueDate) <= now) {
            await createEntryFromAmortissement(tx, ctx.tenantId, charge, d, ctx.userId);
          }
        }
      });
    } else if (data.isPaid === false) {
      updateData.status = "draft";
    }

    await logAudit(ctx.prisma, ctx.userId, "charge_updated", "charge", params.id);
    return NextResponse.json(charge);
  } catch (error) {
    console.error("Update charge error", error);
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
    return NextResponse.json({ error: "Seul un administrateur peut désactiver une charge" }, { status: 403 });
  }

  try {
    await ctx.prisma.charge.update({ where: { id: params.id }, data: { actif: false } });
    await logAudit(ctx.prisma, ctx.userId, "charge_deactivated", "charge", params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete charge error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
