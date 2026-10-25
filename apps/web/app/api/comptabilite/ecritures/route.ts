import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { createAccountingEntry } from "@/lib/accounting";

const lineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.number().int().min(0).default(0),
  credit: z.number().int().min(0).default(0),
  libelle: z.string().optional(),
  thirdPartyType: z.string().optional(),
  thirdPartyId: z.string().optional(),
});

const entrySchema = z.object({
  journalId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().optional(),
  libelle: z.string().min(1),
  lines: z.array(lineSchema).min(2),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const entries = await ctx.prisma.accountingEntry.findMany({
    where: { tenantId: ctx.tenantId },
    take: 100,
    orderBy: { entryDate: "desc" },
    include: {
      journal: true,
      lines: { include: { account: true } },
    },
  });

  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = entrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { journalId, exerciseId, entryDate, reference, libelle, lines } = parsed.data;

    const exercise = await ctx.prisma.accountingExercise.findUnique({
      where: { id: exerciseId },
    });
    if (!exercise || exercise.isClosed) {
      return NextResponse.json({ error: "Exercice invalide ou clôturé" }, { status: 400 });
    }

    const accountIds = lines.map((l) => l.accountId);
    const accounts = await ctx.prisma.accountingAccount.findMany({
      where: { id: { in: accountIds } },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    for (const l of lines) {
      if (!accountMap.has(l.accountId)) {
        return NextResponse.json({ error: `Compte inconnu : ${l.accountId}` }, { status: 400 });
      }
    }

    const created = await ctx.prisma.$transaction((tx: any) =>
      createAccountingEntry(tx, {
        tenantId: ctx.tenantId,
        journalId,
        exerciseId,
        entryDate: new Date(entryDate),
        reference,
        libelle,
        createdBy: ctx.userId,
        lines,
      })
    );

    await logAudit(ctx.prisma, ctx.userId, "accounting_entry_created", "accountingEntry", created.id);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create accounting entry error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
