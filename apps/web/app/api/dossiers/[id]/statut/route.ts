import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard, ensureDossierAccess } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const statutSchema = z.object({
  statut: z.string().min(1),
  motif: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  try {
    const body = await req.json();
    const parsed = statutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await ctx.prisma.dossier.findUnique({
      where: { id: params.id },
      select: { statut: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
    }

    const isTerminal = (s: string) => s === "Clôturé" || s === "Archivé";
    if (!ctx.roleInfo.estAdmin && (isTerminal(existing.statut) || isTerminal(parsed.data.statut))) {
      return NextResponse.json(
        { error: "Seul un administrateur peut modifier le statut d'un dossier clôturé ou archivé" },
        { status: 403 }
      );
    }

    const updated = await ctx.prisma.dossier.update({
      where: { id: params.id },
      data: { statut: parsed.data.statut },
    });

    await logAudit(ctx.prisma, ctx.userId, "dossier_statut_changed", "dossier", params.id, {
      ancienStatut: existing.statut,
      nouveauStatut: parsed.data.statut,
      motif: parsed.data.motif,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update statut error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
