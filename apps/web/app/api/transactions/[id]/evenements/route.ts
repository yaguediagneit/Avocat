import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { transactionEvenementSchema } from "@/lib/transactions-schemas";
import { TRX_EVENEMENT_TYPES } from "@/lib/transactions";

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
    const parsed = transactionEvenementSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    if (!TRX_EVENEMENT_TYPES.some((t) => t.code === data.type)) {
      return NextResponse.json({ error: "Type d'événement inconnu" }, { status: 400 });
    }

    const evenement = await ctx.prisma.transactionEvenement.create({
      data: {
        transactionId: transaction.id,
        type: data.type,
        date: data.date ? new Date(data.date) : new Date(),
        description: data.description || null,
        details: data.details ?? undefined,
        creePar: ctx.userId,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "transaction_evenement_added", "transaction", transaction.id, {
      type: evenement.type,
    }, req);

    return NextResponse.json(evenement, { status: 201 });
  } catch (error) {
    console.error("Add transaction evenement error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
