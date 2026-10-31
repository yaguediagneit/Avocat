import { SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
  email?: string;
  tenantId?: string;
  role?: string;
  isClient?: boolean;
  clientId?: string;
  mfaVerified?: boolean;
  /** Changement de mot de passe obligatoire (politique non conforme). */
  passwordChangeRequired?: boolean;
  /** Configuration TOTP obligatoire (aucun secret d'authentification). */
  totpSetupRequired?: boolean;
  /** Secret TOTP en cours d'activation (avant vérification du premier code). */
  totpPendingSecret?: string;
  mfaPending?: {
    userId: string;
    email: string;
    role: string;
    tenantId: string;
    isClient: boolean;
    clientId?: string;
    mfaSecret?: string;
    passwordChangeRequired?: boolean;
    totpSetupRequired?: boolean;
  };
  mfaResetPending?: {
    userId: string;
    email: string;
    tenantId: string;
    isClient: boolean;
    mfaSecret?: string;
    verified?: boolean;
    expiresAt: number;
  };
}

function resolveSessionPassword(): string {
  const fromEnv = process.env.SESSION_PASSWORD;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_PASSWORD doit être défini (32 caractères minimum) en production.");
  }
  return fromEnv || "change-me-to-a-very-long-secret-min-32";
}

export const sessionOptions: SessionOptions = {
  password: resolveSessionPassword(),
  cookieName: "avocat_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 8,
  },
};
