import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { transactionTypeSchema } from "@/lib/transactions-schemas";

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const famille = searchParams.get("famille") || "";
  const avecInactifs = searchParams.get("tous") === "1";

  const types = await ctx.prisma.transactionType.findMany({
    where: {
      ...(famille ? { famille } : {}),
      ...(avecInactifs ? {} : { actif: true }),
    },
    include: {
      pieces: { where: { actif: true }, orderBy: { ordre: "asc" } },
      _count: { select: { transactions: true, modeles: true } },
    },
    orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
  });
  return NextResponse.json(types);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;
  // La création de types est réservée à l'admin (paramétrage).
  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });
  }

  try {
    const parsed = transactionTypeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    const code = data.code || `TRX_${data.libelle.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 40)}`;
    const type = await ctx.prisma.transactionType.create({
      data: { ...data, code },
    });
    await logAudit(ctx.prisma, ctx.userId, "transaction_type_created", "transaction_type", type.id, {
      code: type.code,
    }, req);
    return NextResponse.json(type, { status: 201 });
  } catch (error) {
    console.error("Create transaction type error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
