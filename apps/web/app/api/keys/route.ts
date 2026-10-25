import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { getOrCreateTenantKeys } from "@/lib/tenant-keys";

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const keys = await getOrCreateTenantKeys(ctx.tenantId);
  return NextResponse.json({ publicKey: keys.publicKey });
}
