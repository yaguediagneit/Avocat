export function getTenantUrl(slug: string, domaine?: string | null, lien?: string | null) {
  if (lien) return lien;
  if (domaine) {
    return domaine.startsWith("http") ? domaine : `https://${domaine}`;
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = new URL(base);
  return `${url.protocol}//${slug}.${url.host}`;
}

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

/**
 * Ramène une saisie (« https://www.Cabinet.sn/accueil », « cabinet.sn:443 »…) au nom d'hôte
 * nu comparé au header `Host` par `app/page.tsx`. Retourne `null` si vide, lève si invalide.
 */
export function normalizeDomain(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return null;
  const host = raw
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  if (!HOSTNAME_RE.test(host)) throw new Error(`Domaine invalide : « ${value} »`);
  return host;
}
