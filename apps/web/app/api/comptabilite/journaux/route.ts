import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const journals = await ctx.prisma.accountingJournal.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });

  return NextResponse.json(journals);
}
