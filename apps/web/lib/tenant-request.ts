import { NextRequest } from "next/server";
import { getTenantPrisma } from "./prisma";
import { requireAuthFromRequest } from "./session";

export async function getTenantFromRequest(req: NextRequest): Promise<string> {
  const tenantId = req.headers.get("x-tenant-id");
  if (!tenantId) {
    throw new Error("Tenant non résolu");
  }
  return tenantId;
}

export async function getTenantPrismaFromRequest(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  return getTenantPrisma(tenantId);
}

export async function requireTenantAndAuth(req: NextRequest) {
  const [session, tenantId] = await Promise.all([
    requireAuthFromRequest(req),
    getTenantFromRequest(req),
  ]);
  const prisma = await getTenantPrisma(tenantId);
  return { session, tenantId, prisma };
}
