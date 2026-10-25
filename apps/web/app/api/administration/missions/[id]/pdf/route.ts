import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { publicPrisma } from "@/lib/prisma";
import { generateLegalPdf, type PdfThemeConfig, type CabinetInfo } from "@/lib/pdf-generator";
import { getMissionTitle } from "@/lib/mission-templates";
import { buildMissionSections, type MissionFormData } from "@/lib/mission-form";

const DEFAULT_PDF_THEME: PdfThemeConfig = {
  primaryColor: "#2c4c7c",
  secondaryColor: "#c78124",
  fontFamily: "Helvetica",
  fontSize: 11,
  headerText: "",
  footerText: "",
};

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = params;

  const mission = await ctx.prisma.providerMission.findUnique({
    where: { id },
  });

  if (!mission) {
    return NextResponse.json({ error: "Mission non trouvée" }, { status: 404 });
  }

  // Infos cabinet + thème PDF
  const tenant = await publicPrisma.tenant.findUnique({
    where: { id: ctx.tenantId },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Cabinet non trouvé" }, { status: 404 });
  }

  const config = (tenant.configuration as Record<string, unknown>) || {};
  const pdfTheme = (config.pdfTheme as Partial<PdfThemeConfig>) || {};

  const cabinet: CabinetInfo = {
    raisonSociale: tenant.raisonSociale,
    slogan: String(config.slogan ?? ""),
    adresse: tenant.adresse ?? undefined,
    telephone: String(config.telephonePrincipal ?? ""),
    telephoneSecondaire: String(config.telephoneSecondaire ?? ""),
    email: String(config.email ?? ""),
    siteWeb: String(config.siteWeb ?? ""),
    identifiantFiscal: tenant.identifiantFiscal ?? undefined,
    identificationLegale: String(config.identificationLegale ?? ""),
    logoUrl: tenant.logoUrl,
  };

  const theme: PdfThemeConfig = {
    ...DEFAULT_PDF_THEME,
    ...pdfTheme,
    fontFamily: (pdfTheme.fontFamily as PdfThemeConfig["fontFamily"]) || "Helvetica",
    fontSize: Math.min(Number(pdfTheme.fontSize) || 11, 9),
  };

  // Dossier lié
  let dossierLabel = "—";
  if (mission.dossierId) {
    const dossier = await ctx.prisma.dossier.findUnique({
      where: { id: mission.dossierId },
      include: {
        client: { select: { raisonSociale: true } },
      },
    });
    if (dossier) {
      dossierLabel = `${dossier.referenceInterne}${dossier.client ? ` — ${dossier.client.raisonSociale}` : ""}`;
    }
  }

  const reference = mission.reference || `ORD-${id.slice(0, 8).toUpperCase()}`;
  const title = getMissionTitle(mission.profession);

  let formData: MissionFormData = {};
  if (mission.notes) {
    try {
      formData = JSON.parse(mission.notes) as MissionFormData;
    } catch {
      // compatibilité anciennes notes texte libre
    }
  }

  const sections = buildMissionSections(mission.profession, formData);

  const pdfBytes = await generateLegalPdf(
    {
      title,
      reference,
      date: fmtDate(new Date()),
      subject: mission.description || title,
      dossier: dossierLabel === "—" ? undefined : dossierLabel,
      columns: { left: sections.cabinet, right: sections.professionnel },
      body: sections.body,
      signature: sections.signatureCabinet,
      signature2: sections.signatureProfessionnel,
    },
    cabinet,
    theme
  );

  const fileName = `Mission-${reference}.pdf`;
  const safeFileName = encodeURIComponent(fileName).replace(/%20/g, " ");

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeFileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
