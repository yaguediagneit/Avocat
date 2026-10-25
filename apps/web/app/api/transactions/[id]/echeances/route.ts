import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { transactionEcheanceSchema } from "@/lib/transactions-schemas";
import { genererEcheancierBail } from "@/lib/transactions";

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

  const echeances = await ctx.prisma.transactionEcheance.findMany({
    where: { transactionId: params.id },
    orderBy: [{ periode: "asc" }, { nature: "asc" }],
  });
  return NextResponse.json(echeances);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const transaction = await ctx.prisma.transaction.findUnique({
    where: { id: params.id },
    include: { parties: { select: { role: true, nomLibre: true, demandeur: { select: { nom: true, prenoms: true, raisonSociale: true } } } } },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, transaction.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  try {
    const parsed = transactionEcheanceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    // Mode génération : échéancier complet du bail (loyer + charges +
    // reversement bailleur net de commission), sans doublonner l'existant.
    if (data.generer) {
      const bailleur = transaction.parties.find((p) => p.role === "BAILLEUR" || p.role === "bailleur");
      const bailleurNom = bailleur
        ? bailleur.nomLibre || bailleur.demandeur?.raisonSociale || [bailleur.demandeur?.prenoms, bailleur.demandeur?.nom].filter(Boolean).join(" ")
        : null;
      const rows = genererEcheancierBail(transaction, bailleurNom);
      if (!rows.length) {
        return NextResponse.json(
          { error: "Impossible de générer l'échéancier : loyer manquant sur la transaction." },
          { status: 400 }
        );
      }
      const existantes = await ctx.prisma.transactionEcheance.findMany({
        where: { transactionId: transaction.id, nature: { in: ["LOYER", "CHARGES", "REVERSEMENT_BAILLEUR"] } },
        select: { nature: true, periode: true },
      });
      const cles = new Set(existantes.map((e) => `${e.nature}|${e.periode.toISOString().slice(0, 7)}`));
      const aCreer = rows.filter((r) => !cles.has(`${r.nature}|${r.periode.toISOString().slice(0, 7)}`));
      if (!aCreer.length) {
        return NextResponse.json({ error: "L'échéancier est déjà entièrement généré." }, { status: 409 });
      }
      await ctx.prisma.transactionEcheance.createMany({
        data: aCreer.map((r) => ({
          transactionId: transaction.id,
          nature: r.nature,
          periode: r.periode,
          jourEcheance: r.jourEcheance,
          montantDu: r.montantDu,
          beneficiaire: r.beneficiaire,
          creePar: ctx.userId,
        })),
      });
      await ctx.prisma.transactionEvenement.create({
        data: {
          transactionId: transaction.id,
          type: "NOTE",
          description: `Échéancier généré : ${aCreer.length} échéance(s) sur ${transaction.dureeMois ?? 12} mois.`,
          creePar: ctx.userId,
        },
      });
      await logAudit(ctx.prisma, ctx.userId, "transaction_echeancier_genere", "transaction", transaction.id, {
        nb: aCreer.length,
      }, req);
      const echeances = await ctx.prisma.transactionEcheance.findMany({
        where: { transactionId: transaction.id },
        orderBy: [{ periode: "asc" }, { nature: "asc" }],
      });
      return NextResponse.json(echeances, { status: 201 });
    }

    const echeance = await ctx.prisma.transactionEcheance.create({
      data: {
        transactionId: transaction.id,
        nature: data.nature,
        periode: new Date(data.periode),
        jourEcheance: data.jourEcheance ?? null,
        montantDu: data.montantDu,
        montantPaye: data.montantPaye ?? 0,
        beneficiaire: data.beneficiaire || null,
        note: data.note || null,
        creePar: ctx.userId,
      },
    });
    await logAudit(ctx.prisma, ctx.userId, "transaction_echeance_added", "transaction", transaction.id, {
      nature: echeance.nature,
      montantDu: echeance.montantDu,
    }, req);
    return NextResponse.json(echeance, { status: 201 });
  } catch (error) {
    console.error("Add transaction echeance error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
