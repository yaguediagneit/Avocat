import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { etatLieuxSchema, etatLieuxData } from "@/lib/transactions-schemas";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const transaction = await ctx.prisma.transaction.findUnique({
    where: { id: params.id },
    select: { dossierId: true },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, transaction.dossierId, "read");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  const etats = await ctx.prisma.etatLieux.findMany({
    where: { transactionId: params.id },
    include: { lignes: { orderBy: { ordre: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(etats);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const transaction = await ctx.prisma.transaction.findUnique({
    where: { id: params.id },
    select: { id: true, dossierId: true, reference: true },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, transaction.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  try {
    const parsed = etatLieuxSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { lignes, ...rest } = parsed.data;
    const data = etatLieuxData(rest);

    const etat = await ctx.prisma.etatLieux.create({
      data: {
        ...data,
        transactionId: transaction.id,
        creePar: ctx.userId,
        lignes: lignes?.length
          ? {
              create: lignes.map((l, i) => ({
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
            }
          : undefined,
      },
      include: { lignes: { orderBy: { ordre: "asc" } } },
    });

    // Finalisation → drapeaux métier sur la transaction (gardes du workflow).
    if (etat.statut === "FINALISE_ENTREE" || etat.statut === "CLOTURE") {
      await ctx.prisma.transaction.update({
        where: { id: transaction.id },
        data: { etatLieuxEntreeFait: true },
      });
    }
    if (etat.statut === "FINALISE_SORTIE" || etat.statut === "CLOTURE") {
      await ctx.prisma.transaction.update({
        where: { id: transaction.id },
        data: { etatLieuxSortieFait: true },
      });
    }

    await ctx.prisma.transactionEvenement.create({
      data: {
        transactionId: transaction.id,
        type: "NOTE",
        description: `État des lieux créé (${etat.typeLocation === "MEUBLEE" ? "meublé" : "vide"}, ${etat.lignes.length} ligne(s)) — statut ${etat.statut}.`,
        details: { etatLieuxId: etat.id },
        creePar: ctx.userId,
      },
    });
    await logAudit(ctx.prisma, ctx.userId, "etat_lieux_created", "transaction", transaction.id, {
      etatLieuxId: etat.id,
      statut: etat.statut,
    }, req);
    return NextResponse.json(etat, { status: 201 });
  } catch (error) {
    console.error("Create etat des lieux error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
