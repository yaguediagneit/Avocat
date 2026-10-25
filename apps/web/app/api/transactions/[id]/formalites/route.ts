import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { transactionFormaliteSchema, formaliteData } from "@/lib/transactions-schemas";
import { FORMALITE_ENTITES } from "@/lib/transactions";

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
    const parsed = transactionFormaliteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    if (!FORMALITE_ENTITES.some((e) => e.code === data.entite)) {
      return NextResponse.json({ error: "Entité inconnue" }, { status: 400 });
    }

    // Si une démarche porte la formalité, elle doit exister et appartenir
    // au même dossier.
    if (data.demarcheId) {
      const demarche = await ctx.prisma.demarche.findUnique({
        where: { id: data.demarcheId },
        select: { dossierId: true },
      });
      if (!demarche || demarche.dossierId !== transaction.dossierId) {
        return NextResponse.json(
          { error: "La démarche liée doit appartenir au même dossier." },
          { status: 400 }
        );
      }
    }

    const formalite = await ctx.prisma.transactionFormalite.create({
      data: {
        ...(formaliteData(data) as any),
        transactionId: transaction.id,
        creePar: ctx.userId,
      },
      include: {
        demarche: { select: { id: true, reference: true, statut: true } },
      },
    });

    await ctx.prisma.transactionEvenement.create({
      data: {
        transactionId: transaction.id,
        type: "NOTE",
        description: `Formalité créée : ${FORMALITE_ENTITES.find((e) => e.code === formalite.entite)?.label || formalite.entite} — ${formalite.objet}`,
        details: { formaliteId: formalite.id, entite: formalite.entite },
        creePar: ctx.userId,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "transaction_formalite_added", "transaction", transaction.id, {
      entite: formalite.entite,
      objet: formalite.objet,
    }, req);

    return NextResponse.json(formalite, { status: 201 });
  } catch (error) {
    console.error("Add transaction formalite error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
