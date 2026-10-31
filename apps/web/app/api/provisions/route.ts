import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { createEntryFromClientProvision, getClientAdvanceBalance } from "@/lib/accounting";

const provisionSchema = z.object({
  clientId: z.string().uuid(),
  montant: z.coerce.number().int().positive("Le montant doit être positif"),
  mode: z.enum(["virement", "especes", "cheque", "carte", "autre"]),
  reference: z.string().optional(),
  dateEncaissement: z.coerce.date().optional(),
});

// Liste des provisions clients : solde restant par client (grand livre 419)
// + écritures de provision enregistrées.
export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "factures", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (clientId) {
    const solde = await getClientAdvanceBalance(ctx.prisma, ctx.tenantId, clientId);
    return NextResponse.json({ clientId, solde });
  }
  const entries = await ctx.prisma.accountingEntry.findMany({
    where: { tenantId: ctx.tenantId, reference: { startsWith: "PROV-" } },
    orderBy: { entryDate: "desc" },
    take: 200,
    include: { lines: { select: { debit: true, credit: true, thirdPartyId: true } } },
  });
  return NextResponse.json(entries);
}

// Encaissement d'une provision : Débit trésorerie / Crédit 419 (pas de produit).
export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "factures", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const parsed = provisionSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const client = await ctx.prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  try {
    const provision = { id: randomUUID(), ...parsed.data, dateEncaissement: parsed.data.dateEncaissement ?? new Date() };
    const entry = await ctx.prisma.$transaction((tx: any) =>
      createEntryFromClientProvision(tx, ctx.tenantId, provision, ctx.userId)
    );
    await logAudit(ctx.prisma, ctx.userId, "provision_created", "accountingEntry", entry.id);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Create provision error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
