import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { publicPrisma } from "@/lib/prisma";
import { getDocumentBuffer } from "@/lib/s3";
import { generateLegalPdf, type PdfThemeConfig, type CabinetInfo } from "@/lib/pdf-generator";

const DEFAULT_PDF_THEME: PdfThemeConfig = {
  primaryColor: "#2c4c7c",
  secondaryColor: "#c78124",
  fontFamily: "Helvetica",
  fontSize: 11,
  headerText: "",
  footerText: "",
};

export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json().catch(() => ({}));
    const {
      mailDate,
      reference,
      structure,
      contact,
      subject,
      body: letterBody,
      dossierId,
      dossier,
      signataireId,
    } = body as Record<string, string | undefined>;

    if (!letterBody?.trim()) {
      return NextResponse.json({ error: "Le corps de la lettre est requis" }, { status: 400 });
    }

    // Récupérer les infos du cabinet et le thème PDF
    const tenant = await publicPrisma.tenant.findUnique({
      where: { id: ctx.tenantId },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Cabinet non trouvé" }, { status: 404 });
    }

    const config = (tenant.configuration as Record<string, unknown>) || {};
    const pdfTheme = (config.pdfTheme as Partial<PdfThemeConfig>) || {};

    const cabinetInfo: CabinetInfo = {
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
      fontSize: Number(pdfTheme.fontSize) || 11,
    };

    // Signataire : si fourni, on utilise son nom et sa signature ; sinon le créateur.
    const signataire = signataireId
      ? await ctx.prisma.user.findUnique({
          where: { id: signataireId },
          select: { prenom: true, nom: true, signatureKey: true },
        })
      : null;
    const currentUser = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { prenom: true, nom: true, signatureKey: true },
    });

    const signer = signataire || currentUser;
    const userName = signer ? `${signer.prenom} ${signer.nom}`.trim() : "";
    const signatureText = userName
      ? `Le responsable du cabinet\n\n${userName}`
      : "Le responsable du cabinet";

    let signatureImage: Uint8Array | undefined;
    if (signer?.signatureKey) {
      try {
        const buffer = await getDocumentBuffer(signer.signatureKey);
        signatureImage = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      } catch (err) {
        console.error("Erreur chargement signature", err);
      }
    }

    const dateStr = mailDate
      ? new Date(mailDate).toLocaleDateString("fr-FR")
      : new Date().toLocaleDateString("fr-FR");

    const recipientParts = [structure, contact ? `Contact : ${contact}` : ""].filter(Boolean);
    const recipient = recipientParts.join("\n");

    const pdfBytes = await generateLegalPdf(
      {
        title: "",
        reference: reference?.trim() || "",
        date: dateStr,
        recipient,
        subject: subject?.trim() || "",
        dossier: dossier?.trim(),
        body: letterBody.trim(),
        signature: signatureText,
        signatureImage,
      },
      cabinetInfo,
      theme
    );

    const pdfBuffer = Buffer.from(pdfBytes);
    const safeFileName = encodeURIComponent(subject?.trim() || "Lettre").replace(/%20/g, " ");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeFileName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Erreur génération lettre PDF", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
