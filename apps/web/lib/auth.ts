import argon2 from "argon2";
import * as speakeasy from "speakeasy";
import { publicPrisma, getTenantPrisma } from "./prisma";
import { isPasswordCompliant } from "./password-policy";

export interface VerifyResult {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
  isClient: boolean;
  clientId?: string;
  requiresMfa: boolean;
  mfaSecret?: string;
  passwordChangeRequired: boolean;
  /** Vrai si aucun secret TOTP n'est configuré (2FA à activer). */
  totpRequired: boolean;
}

export async function resolveTenant(identifier?: string): Promise<{ id: string } | null> {
  if (identifier) {
    const normalized = identifier.toLowerCase().trim();
    const tenant = await publicPrisma.tenant.findFirst({
      where: {
        actif: true,
        OR: [
          { slug: { equals: normalized, mode: "insensitive" } },
          { domaine: { equals: normalized, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (tenant) return tenant;
  }

  if (process.env.DEFAULT_TENANT_ID) {
    const tenant = await publicPrisma.tenant.findUnique({
      where: { id: process.env.DEFAULT_TENANT_ID, actif: true },
      select: { id: true },
    });
    if (tenant) return tenant;
  }

  const tenant = await publicPrisma.tenant.findFirst({
    where: { actif: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return tenant || null;
}

export async function verifyUser(
  email: string,
  password: string,
  tenantIdentifier?: string
): Promise<VerifyResult | null> {
  const resolved = await resolveTenant(tenantIdentifier);
  if (!resolved) {
    return null;
  }

  const tenantPrisma = await getTenantPrisma(resolved.id);

  const user = await tenantPrisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user || !user.actif) {
    return null;
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    return null;
  }

  // Le mot de passe saisi est vérifié contre la politique en clair : s'il est
  // non conforme (ancien mot de passe faible) ou marqué en base, le changement
  // est exigé avant l'accès à l'application.
  const passwordChangeRequired =
    user.passwordChangeRequired || !isPasswordCompliant(password);

  return {
    userId: user.id,
    email: user.email,
    role: user.role.nom,
    tenantId: resolved.id,
    isClient: user.role.estClient,
    clientId: user.clientId || undefined,
    requiresMfa: user.mfaEnabled,
    mfaSecret: user.mfaSecret || undefined,
    passwordChangeRequired,
    totpRequired: !user.mfaSecret,
  };
}

export function verifyTotp(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 2,
  });
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export function generateMfaSecret(): string {
  return speakeasy.generateSecret({ length: 32 }).base32;
}
