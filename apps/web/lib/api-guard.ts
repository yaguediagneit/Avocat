import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "./session";
import { getTenantPrisma } from "./prisma";
import { checkRolePermission, getRoleByName, RoleInfo, canAccessDossier } from "./rbac";
import { PrismaClient } from "@prisma/client";

export interface GuardedContext {
  userId: string;
  email: string;
  role: string;
  roleInfo: RoleInfo;
  tenantId: string;
  isClient: boolean;
  clientId?: string;
  prisma: PrismaClient;
  res: NextResponse;
}

export async function guard(
  req: NextRequest,
  check?: { resource: string; action: string }
): Promise<GuardedContext | NextResponse> {
  const res = NextResponse.next();
  const session = await getSessionFromRequest(req);

  if (!session.userId || !session.mfaVerified) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const tenantId = session.tenantId || req.headers.get("x-tenant-id") || "";
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant non résolu" }, { status: 400 });
  }

  const prisma = await getTenantPrisma(tenantId);

  // Résolution du rôle pour l'isolation (estAdmin, niveauConfidentialiteMax, ...).
  const roleInfo = session.role ? await getRoleByName(prisma, session.role) : null;
  if (!roleInfo) {
    return NextResponse.json({ error: "Rôle inconnu" }, { status: 403 });
  }

  if (check && session.role) {
    const allowed = checkRolePermission(prisma, session.role, check.resource, check.action);
    const ok = await allowed;
    if (!ok) {
      return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
    }
  }

  return {
    userId: session.userId,
    email: session.email || "",
    role: session.role || "",
    roleInfo,
    tenantId,
    isClient: session.isClient || false,
    clientId: session.clientId,
    prisma,
    res,
  };
}

/// Vérifie qu'un utilisateur peut accéder à un dossier donné (read/write/validate)
/// et renvoie soit `true`, soit une NextResponse prête à renvoyer (403/404).
export async function ensureDossierAccess(
  ctx: GuardedContext,
  dossierId: string,
  required: "read" | "write" | "validate" = "read"
): Promise<true | NextResponse> {
  const exists = await ctx.prisma.dossier.findUnique({
    where: { id: dossierId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
  }
  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, dossierId, required);
  if (!ok) {
    return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
  }
  return true;
}
