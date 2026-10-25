/**
 * Protection CSRF « double-submit cookie ».
 *
 * - Le middleware pose un cookie lisible `csrf_token` (non httpOnly) s'il est absent.
 * - Le client (`components/csrf-provider.tsx`) recopie sa valeur dans l'en-tête
 *   `x-csrf-token` de toute requête `fetch` same-origin non idempotente.
 * - Le middleware refuse (403) les requêtes mutantes sur `/api/*` porteuses d'une
 *   session dont l'en-tête ne correspond pas au cookie.
 *
 * Ce module n'a aucune dépendance Node afin d'être importable depuis le middleware
 * (runtime edge) et le bundle client.
 */

export const CSRF_COOKIE = "csrf_token";
export const CSRF_HEADER = "x-csrf-token";

export const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparaison à temps constant (valeurs hexadécimales de même longueur). */
export function tokensMatch(a: string | undefined | null, b: string | undefined | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
