import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { listTiers, TIERS_TYPES } from "@/lib/tiers";

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const tiers = await listTiers(ctx.prisma);
  return NextResponse.json({ types: TIERS_TYPES, tiers });
}
