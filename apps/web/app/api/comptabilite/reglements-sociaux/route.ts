import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { createEntryFromSocialSettlement } from "@/lib/accounting";

const schema = z.object({
  periodYear: z.coerce.number().int().min(2000),
  periodMonth: z.coerce.number().int().min(1).max(12),
  cnssAmount: z.coerce.number().min(0).default(0),
  ipresAmount: z.coerce.number().min(0).default(0),
  irppAmount: z.coerce.number().min(0).default(0),
  settlementDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { periodYear, periodMonth, cnssAmount, ipresAmount, irppAmount, settlementDate } = parsed.data;

  if (cnssAmount + ipresAmount + irppAmount <= 0) {
    return NextResponse.json({ error: "Au moins un montant CNSS, IPRES ou IRPP doit être positif" }, { status: 400 });
  }

  try {
    const entry = await createEntryFromSocialSettlement(ctx.prisma, ctx.tenantId, {
      periodYear,
      periodMonth,
      cnssAmount,
      ipresAmount,
      irppAmount,
      settlementDate: new Date(settlementDate),
    }, ctx.userId);
    return NextResponse.json(entry, { status: 201 });
  } catch (error: any) {
    console.error("Social settlement error", error);
    return NextResponse.json({ error: error?.message || "Erreur lors du règlement" }, { status: 500 });
  }
}
