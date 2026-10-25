import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { transactionPieceSchema } from "@/lib/transactions-schemas";

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
    const parsed = transactionPieceSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const piece = await ctx.prisma.transactionPiece.create({
      data: {
        transactionId: transaction.id,
        code: parsed.data.code,
        libelle: parsed.data.libelle,
        categorie: parsed.data.categorie,
        niveau: parsed.data.niveau,
        condition: parsed.data.condition || null,
        partieConcernee: parsed.data.partieConcernee || "TOUTES",
        sourceAttendue: parsed.data.sourceAttendue || "CLIENT",
        ordre: parsed.data.ordre ?? 0,
      },
    });
    await logAudit(ctx.prisma, ctx.userId, "transaction_piece_added", "transaction", transaction.id, {
      code: piece.code,
    }, req);
    return NextResponse.json(piece, { status: 201 });
  } catch (error) {
    console.error("Add transaction piece error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
