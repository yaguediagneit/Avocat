export function getTenantUrl(slug: string, domaine?: string | null) {
  if (domaine) {
    return domaine.startsWith("http") ? domaine : `https://${domaine}`;
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = new URL(base);
  return `${url.protocol}//${slug}.${url.host}`;
}
