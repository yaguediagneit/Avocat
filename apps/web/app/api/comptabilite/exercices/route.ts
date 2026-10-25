import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const exercises = await ctx.prisma.accountingExercise.findMany({
    where: { isClosed: false },
    orderBy: { year: "desc" },
  });

  return NextResponse.json(exercises);
}
