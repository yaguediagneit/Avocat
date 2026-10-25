import "server-only";
import { getSession } from "./session";
import { getTenantPrisma } from "./prisma";
import { getRoleByName, RoleInfo, getDossierAccessFilter, getClientAccessFilter, getDossierScopedAccessFilter, getAccessibleDossierIds, canAccessDossier, hasPermission } from "./rbac";
import { Prisma, PrismaClient } from "@prisma/client";

export interface ServerAuthContext {
  userId: string;
  role: RoleInfo;
  prisma: PrismaClient;
  estAdmin: boolean;
}

/// Résout le contexte d'authentification côté Server Component :
/// session + rôle + client Prisma du tenant. Lève si non authentifié.
export async function getServerAuth(): Promise<ServerAuthContext> {
  const session = await getSession();
  if (!session.userId || !session.mfaVerified || !session.role) {
    throw new Error("Non authentifié");
  }
  const tenantId =
    session.tenantId ||
    (process.env.NODE_ENV !== "production" ? process.env.DEFAULT_TENANT_ID : undefined) ||
    "";
  if (!tenantId) {
    throw new Error("Tenant non résolu");
  }
  const prisma = await getTenantPrisma(tenantId);
  const role = await getRoleByName(prisma, session.role);
  if (!role) {
    throw new Error("Rôle inconnu");
  }
  return {
    userId: session.userId,
    role,
    prisma,
    estAdmin: role.estAdmin,
  };
}

/// Vérifie que le rôle courant possède une permission donnée.
/// À utiliser côté Server Component pour gate les pages réservées
/// (comptabilite, charges, personnel, parametrage...).
export async function serverHasPermission(
  resource: string,
  action: "read" | "write" | "validate" | "delete" = "read"
): Promise<boolean> {
  try {
    const auth = await getServerAuth();
    return hasPermission(auth.role, resource, action);
  } catch {
    return false;
  }
}

/// Filtre Prisma `where` pour `Dossier.findMany` côté Server Component.
export async function getServerDossierFilter(): Promise<Prisma.DossierWhereInput> {
  const auth = await getServerAuth();
  return getDossierAccessFilter(auth.prisma, auth.userId, auth.role);
}

/// Filtre Prisma `where` pour `Client.findMany` côté Server Component.
export async function getServerClientFilter(): Promise<Prisma.ClientWhereInput> {
  const auth = await getServerAuth();
  return getClientAccessFilter(auth.prisma, auth.userId, auth.role);
}

/// Filtre Prisma `where` pour une ressource liée à un dossier
/// (Document, Tache, Evenement, MissionHuissier, Facture).
export async function getServerDossierScopedFilter(
  resource: string
): Promise<{ dossierId: { in: string[] } } | {}> {
  const auth = await getServerAuth();
  return getDossierScopedAccessFilter(auth.prisma, auth.userId, auth.role, resource);
}

/// Vérifie l'accès à un dossier précis côté Server Component.
export async function serverCanAccessDossier(
  dossierId: string,
  required: "read" | "write" | "validate" = "read"
): Promise<boolean> {
  const auth = await getServerAuth();
  return canAccessDossier(auth.prisma, auth.userId, auth.role, dossierId, required);
}

/// Renvoie la liste des IDs de dossiers accessibles (ou `all: true` pour admin).
export async function getServerAccessibleDossierIds(): Promise<{ ids: string[]; all: boolean }> {
  const auth = await getServerAuth();
  return getAccessibleDossierIds(auth.prisma, auth.userId, auth.role);
}
