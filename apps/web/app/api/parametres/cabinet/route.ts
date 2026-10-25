import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { guard } from "@/lib/api-guard";
import { publicPrisma } from "@/lib/prisma";

const cabinetSchema = z.object({
  raisonSociale: z.string().min(1).optional(),
  description: z.string().optional(),
  slogan: z.string().optional(),
  adresse: z.string().optional(),
  identifiantFiscal: z.string().optional(),
  telephonePrincipal: z.string().optional(),
  telephoneSecondaire: z.string().optional(),
  identificationLegale: z.string().optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  siteWeb: z.string().optional(),
  logoUrl: z.string().optional(),
  cachetUrl: z.string().optional(),
  presentationImage: z.string().optional(),
  presentationTexte: z.string().optional(),
  specialites: z.array(z.string()).optional(),
  landingImages: z.array(z.string()).max(10).optional(),
  valeurs: z.array(z.object({ titre: z.string(), description: z.string() })).optional(),
  temoignages: z.array(z.object({ auteur: z.string(), role: z.string(), texte: z.string() })).optional(),
  hero: z.array(
    z.object({
      titre: z.string(),
      detail: z.string(),
      couleur: z.string().optional(),
      police: z.string().optional(),
      tailleTitre: z.string().optional(),
      tailleDetail: z.string().optional(),
      cta: z.string().optional(),
    })
  ).optional(),
  theme: z.object({
    primary: z.string(),
    accent: z.string(),
    headingFont: z.string(),
    bodyFont: z.string(),
  }).optional(),
  pdfTheme: z.object({
    primaryColor: z.string().default("#2c4c7c"),
    secondaryColor: z.string().default("#c78124"),
    fontFamily: z.enum(["Helvetica", "Times-Roman", "Courier"]).default("Helvetica"),
    fontSize: z.number().min(8).max(16).default(11),
    headerText: z.string().default(""),
    footerText: z.string().default(""),
  }).optional(),
});

function normalizeConfig(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "parametres", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const tenant = await publicPrisma.tenant.findUnique({
    where: { id: ctx.tenantId },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant non trouvé" }, { status: 404 });
  }

  const config = normalizeConfig(tenant.configuration);

  return NextResponse.json({
    id: tenant.id,
    raisonSociale: tenant.raisonSociale,
    adresse: tenant.adresse ?? "",
    identifiantFiscal: tenant.identifiantFiscal ?? "",
    telephonePrincipal: String(config.telephonePrincipal ?? ""),
    telephoneSecondaire: String(config.telephoneSecondaire ?? ""),
    identificationLegale: String(config.identificationLegale ?? ""),
    description: String(config.description ?? ""),
    slogan: String(config.slogan ?? ""),
    email: String(config.email ?? ""),
    siteWeb: String(config.siteWeb ?? ""),
    logoUrl: tenant.logoUrl ?? "",
    cachetUrl: String(config.cachetUrl ?? ""),
    presentationImage: String(config.presentationImage ?? ""),
    presentationTexte: String(config.presentationTexte ?? ""),
    specialites: Array.isArray(config.specialites) ? config.specialites : [],
    landingImages: Array.isArray(config.landingImages) ? config.landingImages : [],
    valeurs: Array.isArray(config.valeurs) ? config.valeurs : [],
    temoignages: Array.isArray(config.temoignages) ? config.temoignages : [],
    hero: Array.isArray(config.hero) ? config.hero : [],
    pdfTheme: config.pdfTheme ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const ctx = await guard(req, { resource: "parametres", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = cabinetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const tenant = await publicPrisma.tenant.findUnique({
      where: { id: ctx.tenantId },
    });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant non trouvé" }, { status: 404 });
    }

    const {
      raisonSociale,
      adresse,
      identifiantFiscal,
      logoUrl,
      ...configValues
    } = parsed.data;

    const currentConfig = normalizeConfig(tenant.configuration);
    const configuration = {
      ...currentConfig,
      ...Object.fromEntries(Object.entries(configValues).filter(([, v]) => v !== undefined)),
    } as any;

    const updated = await publicPrisma.tenant.update({
      where: { id: ctx.tenantId },
      data: {
        raisonSociale,
        adresse,
        identifiantFiscal,
        logoUrl,
        configuration,
      },
    });

    // Le landing page (/) lit tenant.configuration pour afficher les témoignages,
    // valeurs, hero, etc. On purge le cache pour que les visiteurs voient immédiatement
    // les changements après une sauvegarde dans Paramétrage.
    try {
      revalidatePath("/", "layout");
    } catch (e) {
      console.error("revalidatePath failed", e);
    }

    return NextResponse.json({
      id: updated.id,
      raisonSociale: updated.raisonSociale,
      adresse: updated.adresse ?? "",
      identifiantFiscal: updated.identifiantFiscal ?? "",
      logoUrl: updated.logoUrl ?? "",
      ...normalizeConfig(updated.configuration),
    });
  } catch (error) {
    console.error("Update cabinet settings error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
