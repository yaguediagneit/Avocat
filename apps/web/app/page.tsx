import { cache } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { publicPrisma, getTenantPrisma } from "@/lib/prisma";
import type { LandingTheme } from "@/lib/theme";
import { PlatformLanding, type PlanData } from "@/components/landing/platform-landing";
import { CabinetLanding } from "@/components/landing/cabinet-landing";

// Le landing page lit tenant.configuration (témoignages, valeurs, hero…) qui peut
// changer à tout moment via Paramétrage. On force le rendu dynamique pour ne
// jamais servir une version cachée obsolète.
export const dynamic = "force-dynamic";

const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin", "mail", "ftp", "staging", "demo"]);

interface CabinetData {
  raisonSociale: string;
  description: string;
  slogan: string;
  presentationImage: string;
  presentationTexte: string;
  adresse: string | null;
  identifiantFiscal: string | null;
  identificationLegale: string;
  logoUrl: string | null;
  telephonePrincipal: string;
  telephoneSecondaire: string;
  email: string;
  siteWeb: string;
  landingImages: string[];
  valeurs: { titre: string; description: string }[];
  temoignages: { auteur: string; role: string; texte: string }[];
  hero?: { titre: string; detail: string; couleur?: string; police?: string; tailleTitre?: string; tailleDetail?: string; cta?: string }[];
  theme?: LandingTheme;
  specialites: { id: string; code: string; libelle: string; description: string | null }[];
}

function normalizeHost(host: string | null): string {
  return host?.split(":")[0]?.toLowerCase() ?? "";
}

function normalizeConfig(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function isLocalhost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1";
}

function getSubdomain(host: string): string | null {
  const parts = host.split(".");
  if (parts.length < 2) return null;
  const candidate = parts[0];
  if (RESERVED_SUBDOMAINS.has(candidate)) return null;
  return candidate;
}

function buildCabinetData(
  tenant: {
    raisonSociale: string;
    adresse: string | null;
    identifiantFiscal: string | null;
    logoUrl: string | null;
    configuration: unknown;
  },
  specialites: { id: string; code: string; libelle: string; description: string | null }[]
): CabinetData {
  const config = normalizeConfig(tenant.configuration);
  return {
    raisonSociale: tenant.raisonSociale,
    description: String(config.description || "Cabinet Juridique Multidisciplinaire"),
    slogan: String(config.slogan || "Un accompagnement juridique rigoureux et confidentiel."),
    presentationImage: String(config.presentationImage || ""),
    presentationTexte: String(config.presentationTexte || ""),
    adresse: tenant.adresse ?? null,
    identifiantFiscal: tenant.identifiantFiscal ?? null,
    logoUrl: tenant.logoUrl ?? null,
    identificationLegale: String(config.identificationLegale ?? ""),
    telephonePrincipal: String(config.telephonePrincipal ?? ""),
    telephoneSecondaire: String(config.telephoneSecondaire ?? ""),
    email: String(config.email ?? ""),
    siteWeb: String(config.siteWeb ?? ""),
    landingImages: Array.isArray(config.landingImages) ? (config.landingImages as string[]) : [],
    valeurs: Array.isArray(config.valeurs) ? (config.valeurs as { titre: string; description: string }[]) : [],
    temoignages: Array.isArray(config.temoignages) ? (config.temoignages as { auteur: string; role: string; texte: string }[]) : [],
    hero: Array.isArray(config.hero)
      ? (config.hero as { titre: string; detail: string; couleur?: string; police?: string; tailleTitre?: string; tailleDetail?: string; cta?: string }[])
      : undefined,
    theme: (config.theme as LandingTheme | undefined) ?? undefined,
    specialites,
  };
}

// Mémoïsé par requête : generateMetadata et HomePage partagent la même résolution.
const resolveTenant = cache(async (host: string): Promise<CabinetData | null> => {
  const rootDomain = process.env.ROOT_DOMAIN?.toLowerCase();
  if (rootDomain && host === rootDomain) {
    return null;
  }

  let tenant: {
    id: string;
    raisonSociale: string;
    adresse: string | null;
    identifiantFiscal: string | null;
    logoUrl: string | null;
    configuration: unknown;
  } | null = null;

  const tenantSelect = { id: true, raisonSociale: true, adresse: true, identifiantFiscal: true, logoUrl: true, configuration: true } as const;

  if (host) {
    tenant = await publicPrisma.tenant.findUnique({ where: { domaine: host }, select: tenantSelect });
    // Tolère l'autre forme du même domaine : le tenant stocke « cabinet.sn »
    // et le visiteur tape « www.cabinet.sn », ou l'inverse.
    if (!tenant) {
      const altHost = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
      tenant = await publicPrisma.tenant.findUnique({ where: { domaine: altHost }, select: tenantSelect });
    }
  }

  if (!tenant) {
    const subdomain = getSubdomain(host);
    if (subdomain) {
      tenant = await publicPrisma.tenant.findUnique({
        where: { slug: subdomain },
        select: { id: true, raisonSociale: true, adresse: true, identifiantFiscal: true, logoUrl: true, configuration: true },
      });
    }
  }

  if (!tenant && isLocalhost(host) && process.env.DEFAULT_TENANT_ID) {
    tenant = await publicPrisma.tenant.findUnique({
      where: { id: process.env.DEFAULT_TENANT_ID },
      select: { id: true, raisonSociale: true, adresse: true, identifiantFiscal: true, logoUrl: true, configuration: true },
    });
  }

  if (!tenant) return null;

  const tenantPrisma = await getTenantPrisma(tenant.id);
  const specialites = await tenantPrisma.specialite.findMany({
    where: { actif: true, selectionnee: true },
    orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
    select: { id: true, code: true, libelle: true, description: true },
  });

  return buildCabinetData(tenant, specialites);
});

export async function generateMetadata(): Promise<Metadata> {
  const host = normalizeHost(headers().get("host"));
  const cabinet = await resolveTenant(host);

  if (cabinet) {
    return {
      title: `${cabinet.raisonSociale}`,
      description: `${cabinet.raisonSociale} — Cabinet juridique au Sénégal.`,
    };
  }

  return {
    title: "cabinet-avocat.sn — Gestion juridique moderne",
    description: "Plateforme collaborative et sécurisée pour avocats, huissiers et assistants juridiques au Sénégal.",
  };
}

export default async function HomePage() {
  const host = normalizeHost(headers().get("host"));
  const cabinet = await resolveTenant(host);

  if (cabinet) {
    return <CabinetLanding cabinet={cabinet} />;
  }

  const plans = await publicPrisma.plan.findMany({
    where: { actif: true },
    orderBy: { ordre: "asc" },
    select: { id: true, nom: true, joursEssai: true, modules: true, nbUtilisateurs: true, support: true, prixMensuel: true, prixAnnuel: true },
  });

  return <PlatformLanding plans={plans.map((p) => ({
    ...p,
    modules: Array.isArray(p.modules) ? (p.modules as string[]) : [],
    support: (p.support && typeof p.support === "object" && !Array.isArray(p.support)) ? (p.support as PlanData["support"]) : {},
  }))} />;
}
