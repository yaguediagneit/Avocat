import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const schema = z.object({ isValidated: z.boolean() });

// Validation / suspension d'une écriture : une écriture « brouillon »
// (isValidated=false) est exclue de tous les états sans être supprimée.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const entry = await ctx.prisma.accountingEntry.findFirst({
    where: { id: params.id, tenantId: ctx.tenantId },
    select: { id: true, reference: true },
  });
  if (!entry) {
    return NextResponse.json({ error: "Écriture introuvable" }, { status: 404 });
  }

  await ctx.prisma.accountingEntry.update({
    where: { id: entry.id },
    data: {
      isValidated: parsed.data.isValidated,
      validatedAt: parsed.data.isValidated ? new Date() : null,
    },
  });
  await logAudit(
    ctx.prisma, ctx.userId,
    parsed.data.isValidated ? "accounting_entry_validated" : "accounting_entry_suspended",
    "accountingEntry", entry.id, { reference: entry.reference }
  );
  return NextResponse.json({ ok: true, isValidated: parsed.data.isValidated });
}
