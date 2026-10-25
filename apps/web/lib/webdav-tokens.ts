/**
 * Gestion des tokens WebDAV pour l'édition directe de fichiers Word.
 *
 * Un token est généré côté API (après authentification de l'utilisateur) et
 * associé à un contexte {templateId, dossierId, tacheId, userId, tenantId}.
 * Le token est embarqué dans l'URL WebDAV que Word utilise pour lire et
 * écrire le fichier. Les tokens expirent après 2 heures.
 *
 * Le store est en mémoire (par processus). En production multi-instance,
 * il faudrait basculer vers Redis.
 */

import crypto from "crypto";

export interface WebDAVTokenContext {
  templateId: string;
  templateTitre: string;
  wordTemplateKey: string;
  dossierId: string;
  tacheId?: string;
  userId: string;
  tenantId: string;
  fileName: string;
  createdAt: number;
  expiresAt: number;
  /// Indique si un PUT (sauvegarde depuis Word) a déjà été reçu.
  saved: boolean;
  /// Document ID créé après la première sauvegarde.
  documentId?: string;
}

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 heures
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Store partagé via globalThis pour que server.js et les API routes
// accèdent au même Map (même processus Node).
const globalForTokens = globalThis as unknown as { __webdavTokens?: Map<string, WebDAVTokenContext> };
const tokens = globalForTokens.__webdavTokens ?? (globalForTokens.__webdavTokens = new Map());

// Nettoyage périodique des tokens expirés
let cleanupStarted = false;
function startCleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [token, ctx] of tokens) {
      if (ctx.expiresAt < now) {
        tokens.delete(token);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref();
}

export function createWebDAVToken(ctx: Omit<WebDAVTokenContext, "createdAt" | "expiresAt" | "saved">): {
  token: string;
  context: WebDAVTokenContext;
} {
  startCleanup();
  const token = crypto.randomBytes(24).toString("hex");
  const now = Date.now();
  const context: WebDAVTokenContext = {
    ...ctx,
    createdAt: now,
    expiresAt: now + TOKEN_TTL_MS,
    saved: false,
  };
  tokens.set(token, context);
  return { token, context };
}

export function getWebDAVToken(token: string): WebDAVTokenContext | null {
  const ctx = tokens.get(token);
  if (!ctx) return null;
  if (ctx.expiresAt < Date.now()) {
    tokens.delete(token);
    return null;
  }
  return ctx;
}

export function markWebDAVTokenSaved(token: string, documentId: string) {
  const ctx = tokens.get(token);
  if (ctx) {
    ctx.saved = true;
    ctx.documentId = documentId;
  }
}

export function deleteWebDAVToken(token: string) {
  tokens.delete(token);
}
