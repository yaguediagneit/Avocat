import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

async function ensureFactureDossierAccess(
  ctx: Awaited<ReturnType<typeof guard>>,
  factureId: string,
  required: "read" | "write" = "read"
): Promise<true | NextResponse> {
  if (ctx instanceof NextResponse) return ctx;
  const facture = await ctx.prisma.facture.findUnique({
    where: { id: factureId },
    select: { dossierId: true },
  });
  if (!facture) {
    return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
  }
  if (!facture.dossierId) {
    return NextResponse.json({ error: "Facture non liée à un dossier" }, { status: 400 });
  }
  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, facture.dossierId, required);
  if (!ok) {
    return NextResponse.json({ error: "Accès interdit à cette facture" }, { status: 403 });
  }
  return true;
}

const factureUpdateSchema = z.object({
  libelle: z.string().optional(),
  designation: z.string().optional(),
  dateEcheance: z.string().datetime().nullable().optional(),
  statut: z.string().optional(),
  actif: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "factures", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureFactureDossierAccess(ctx, params.id, "read");
  if (access !== true) return access;

  try {
    const facture = await ctx.prisma.facture.findUnique({
      where: { id: params.id },
      include: {
        dossier: { select: { referenceInterne: true, clientId: true } },
        client: { select: { raisonSociale: true } },
        lines: { orderBy: { ordre: "asc" } },
        paiements: true,
      },
    });
    if (!facture) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }
    return NextResponse.json(facture);
  } catch (error) {
    console.error("Get facture error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "factures", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureFactureDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  try {
    const body = await req.json();
    const parsed = factureUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { dateEcheance, ...data } = parsed.data;
    const facture = await ctx.prisma.facture.update({
      where: { id: params.id },
      data: {
        ...data,
        dateEcheance: dateEcheance === null ? null : dateEcheance ? new Date(dateEcheance) : undefined,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "facture_updated", "facture", params.id);
    return NextResponse.json(facture);
  } catch (error) {
    console.error("Update facture error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "factures", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Seul un administrateur peut désactiver une facture" }, { status: 403 });
  }

  const access = await ensureFactureDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  try {
    await ctx.prisma.facture.update({ where: { id: params.id }, data: { actif: false } });
    await logAudit(ctx.prisma, ctx.userId, "facture_deactivated", "facture", params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete facture error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
