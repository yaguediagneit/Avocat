import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { transactionPartieSchema } from "@/lib/transactions-schemas";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const transaction = await ctx.prisma.transaction.findUnique({
    where: { id: params.id },
    select: { id: true, dossierId: true },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, transaction.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  try {
    const parsed = transactionPartieSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    if (!data.demandeurId && !data.clientId && !data.nomLibre?.trim()) {
      return NextResponse.json(
        { error: "La partie doit être un demandeur, un client ou être nommée." },
        { status: 400 }
      );
    }

    const partie = await ctx.prisma.transactionPartie.create({
      data: {
        transactionId: transaction.id,
        role: data.role,
        demandeurId: data.demandeurId || null,
        clientId: data.clientId || null,
        nomLibre: data.nomLibre || null,
        coordonnees: data.coordonnees || null,
        qualite: data.qualite || null,
        representePar: data.representePar || null,
        ordre: data.ordre ?? 0,
      },
      include: {
        demandeur: { select: { id: true, nom: true, prenoms: true, raisonSociale: true } },
        client: { select: { id: true, raisonSociale: true } },
      },
    });

    await ctx.prisma.transactionEvenement.create({
      data: {
        transactionId: transaction.id,
        type: "NOTE",
        description: `Partie ajoutée : ${partie.demandeur?.raisonSociale || [partie.demandeur?.prenoms, partie.demandeur?.nom].filter(Boolean).join(" ") || partie.client?.raisonSociale || partie.nomLibre} (${partie.role})`,
        details: { role: partie.role, partieId: partie.id },
        creePar: ctx.userId,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "transaction_partie_added", "transaction", transaction.id, {
      role: partie.role,
    }, req);

    return NextResponse.json(partie, { status: 201 });
  } catch (error) {
    console.error("Add transaction partie error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
