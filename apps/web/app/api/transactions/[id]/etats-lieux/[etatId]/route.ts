import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { etatLieuxPatchSchema, etatLieuxData } from "@/lib/transactions-schemas";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; etatId: string } }) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const transaction = await ctx.prisma.transaction.findUnique({
    where: { id: params.id },
    select: { id: true, dossierId: true },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, transaction.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  const etat = await ctx.prisma.etatLieux.findFirst({
    where: { id: params.etatId, transactionId: params.id },
  });
  if (!etat) return NextResponse.json({ error: "État des lieux non trouvé" }, { status: 404 });

  try {
    const parsed = etatLieuxPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { lignes, ...rest } = parsed.data;
    const data = etatLieuxData(rest);

    // Une fiche clôturée n'est plus modifiable : en créer une nouvelle.
    if (etat.statut === "CLOTURE" && (data.statut === undefined || data.statut === "CLOTURE")) {
      return NextResponse.json(
        { error: "Cet état des lieux est clôturé : créez une nouvelle fiche pour le modifier." },
        { status: 409 }
      );
    }

    const updated = await ctx.prisma.$transaction(async (tx) => {
      const e = await tx.etatLieux.update({ where: { id: etat.id }, data });
      if (lignes) {
        await tx.etatLieuxLigne.deleteMany({ where: { etatLieuxId: etat.id } });
        if (lignes.length) {
          await tx.etatLieuxLigne.createMany({
            data: lignes.map((l, i) => ({
              etatLieuxId: etat.id,
              objet: l.objet,
              emplacement: l.emplacement || null,
              typeElement: l.typeElement || null,
              ordre: l.ordre ?? i,
              quantiteEntree: l.quantiteEntree ?? null,
              etatEntree: l.etatEntree || null,
              obsEntree: l.obsEntree || null,
              quantiteSortie: l.quantiteSortie ?? null,
              etatSortie: l.etatSortie || null,
              obsSortie: l.obsSortie || null,
            })),
          });
        }
      }
      // Drapeaux métier sur la transaction (gardes du workflow bail).
      const maj: Record<string, boolean> = {};
      if (e.statut === "FINALISE_ENTREE" || e.statut === "CLOTURE") maj.etatLieuxEntreeFait = true;
      if (e.statut === "FINALISE_SORTIE" || e.statut === "CLOTURE") maj.etatLieuxSortieFait = true;
      if (Object.keys(maj).length) {
        await tx.transaction.update({ where: { id: transaction.id }, data: maj });
      }
      return tx.etatLieux.findUnique({
        where: { id: etat.id },
        include: { lignes: { orderBy: { ordre: "asc" } } },
      });
    });

    if (parsed.data.statut && parsed.data.statut !== etat.statut) {
      await ctx.prisma.transactionEvenement.create({
        data: {
          transactionId: transaction.id,
          type: "NOTE",
          description: `État des lieux : ${etat.statut} → ${parsed.data.statut}.`,
          details: { etatLieuxId: etat.id, de: etat.statut, vers: parsed.data.statut },
          creePar: ctx.userId,
        },
      });
    }
    await logAudit(ctx.prisma, ctx.userId, "etat_lieux_updated", "transaction", transaction.id, {
      etatLieuxId: etat.id,
      statut: parsed.data.statut,
    }, req);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Patch etat des lieux error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; etatId: string } }) {
  const ctx = await guard(req, { resource: "transactions", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  const transaction = await ctx.prisma.transaction.findUnique({
    where: { id: params.id },
    select: { id: true, dossierId: true },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, transaction.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  const etat = await ctx.prisma.etatLieux.findFirst({
    where: { id: params.etatId, transactionId: params.id },
    select: { id: true, statut: true },
  });
  if (!etat) return NextResponse.json({ error: "État des lieux non trouvé" }, { status: 404 });

  // Une fiche finalisée est une preuve : on l'archive (CLOTURE), on ne la
  // supprime pas. Seul un brouillon est retirable.
  if (etat.statut !== "BROUILLON") {
    const archived = await ctx.prisma.etatLieux.update({
      where: { id: etat.id },
      data: { statut: "CLOTURE" },
    });
    return NextResponse.json(archived);
  }
  await ctx.prisma.etatLieux.delete({ where: { id: etat.id } });
  await logAudit(ctx.prisma, ctx.userId, "etat_lieux_removed", "transaction", transaction.id, {
    etatLieuxId: etat.id,
  }, req);
  return NextResponse.json({ ok: true });
}
