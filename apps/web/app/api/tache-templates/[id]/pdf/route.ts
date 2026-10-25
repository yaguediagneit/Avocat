import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { publicPrisma } from "@/lib/prisma";
import { uploadDocument, getDocumentBuffer } from "@/lib/s3";
import { logAudit } from "@/lib/audit";
import { generateLegalPdf, type PdfThemeConfig, type CabinetInfo } from "@/lib/pdf-generator";
import { renderDocumentTemplate } from "@/lib/document-template";
import { encryptDocumentServerSide } from "@/lib/pdf-encrypt";
import crypto from "crypto";

const DEFAULT_PDF_THEME: PdfThemeConfig = {
  primaryColor: "#2c4c7c",
  secondaryColor: "#c78124",
  fontFamily: "Helvetica",
  fontSize: 11,
  headerText: "",
  footerText: "",
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = params;

  const template = await ctx.prisma.tacheTemplate.findUnique({
    where: { id },
    include: {
      specialite: { select: { id: true, code: true, libelle: true } },
      workflowEtape: { select: { id: true, code: true, libelle: true } },
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Modèle non trouvé" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    title,
    reference,
    date,
    recipient,
    subject,
    body: docBody,
    signature,
    dossierId,
    tacheId,
    missionId,
    publieClient,
    variables,
  } = body as Record<string, string | boolean | Record<string, string>>;

  if (!dossierId || typeof dossierId !== "string") {
    return NextResponse.json({ error: "L'identifiant du dossier est requis" }, { status: 400 });
  }

  // Vérifier l'accès au dossier
  const dossierOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, dossierId, "write");
  if (!dossierOk) {
    return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
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

  // Construire le contenu du document
  const docTitle = (title as string)?.trim() || template.titre;
  const useContenuDocument = !!template.contenuDocument?.trim();
  // Quand le modèle définit un contenu document complet, il constitue
  // l'intégralité de la lettre : les blocs fixes (référence/date, destinataire,
  // objet, signature) ne sont pas dessinés en plus pour éviter les doublons.
  const docReference = useContenuDocument ? "" : (reference as string)?.trim() || "";
  const docDate = useContenuDocument
    ? ""
    : (date as string)?.trim() || new Date().toLocaleDateString("fr-FR");
  const docRecipient = useContenuDocument ? "" : (recipient as string)?.trim() || "";
  const docSubject = useContenuDocument
    ? ""
    : (subject as string)?.trim() || template.specialite?.libelle || "";
  let docSignature = useContenuDocument ? "" : (signature as string)?.trim() || "";

  // Le corps est reconstruit côté serveur par substitution : le texte fixe
  // n'est pas modifiable par le client, seules les variables sont injectées.
  // Les champs structurés alimentent aussi les variables canoniques
  // (reference, date, destinataire, objet, signature) si le modèle les contient.
  const variablesMap =
    variables && typeof variables === "object" ? (variables as Record<string, string>) : {};
  const canoniques: Record<string, string> = {
    reference: (reference as string)?.trim() || "",
    date: (date as string)?.trim() || new Date().toLocaleDateString("fr-FR"),
    ville: "",
    destinataire: (recipient as string)?.trim() || "",
    objet: (subject as string)?.trim() || template.specialite?.libelle || "",
    signature: (signature as string)?.trim() || "",
  };
  for (const [cle, valeur] of Object.entries(canoniques)) {
    if (valeur && !variablesMap[cle]?.trim()) variablesMap[cle] = valeur;
  }
  const docContent = useContenuDocument
    ? renderDocumentTemplate(template.contenuDocument as string, variablesMap)
    : (docBody as string)?.trim() ||
      template.description ||
    `Tâche: ${template.titre}\n\nSpécialité: ${template.specialite?.libelle || ""}\nÉtape: ${template.workflowEtape?.libelle || ""}\nDélai: ${template.delaiJours} jours\nRôle attendu: ${template.roleAttendu}\nPriorité: ${template.priorite}`;
  const isPublieClient = publieClient === true;

  // Charger la signature image de l'utilisateur connecté
  let signatureImage: Uint8Array | undefined;
  try {
    const currentUser = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { signatureKey: true },
    });
    if (currentUser?.signatureKey) {
      const buffer = await getDocumentBuffer(currentUser.signatureKey);
      signatureImage = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
  } catch (err) {
    console.error("Erreur chargement de la signature utilisateur", err);
  }

  // En mode « modèle complet », le texte de signature fait partie du modèle ;
  // on appose quand même l'image de signature scannée en fin de lettre.
  if (useContenuDocument && signatureImage && !docSignature) {
    docSignature = " ";
  }

  try {
    // 1. Générer le PDF
    const pdfBytes = await generateLegalPdf(
      {
        title: docTitle,
        reference: docReference,
        date: docDate,
        recipient: docRecipient,
        subject: docSubject,
        body: docContent,
        signature: docSignature,
        signatureImage,
      },
      cabinetInfo,
      theme
    );

    const pdfBuffer = Buffer.from(pdfBytes);
    const fileName = `${docTitle}.pdf`;

    // 2. Récupérer la clé publique du tenant pour chiffrer
    const tenantKey = await publicPrisma.tenantKey.findFirst({
      where: { tenantId: ctx.tenantId },
    });

    if (!tenantKey) {
      return NextResponse.json({ error: "Clé du cabinet manquante" }, { status: 500 });
    }

    const publicKeyJwk = JSON.parse(tenantKey.publicKey) as JsonWebKey;

    // 3. Chiffrer le PDF côté serveur
    const { encryptedFile, encryptedDek, iv } = await encryptDocumentServerSide(
      pdfBuffer,
      publicKeyJwk
    );

    // 4. Calculer le hash et téléverser vers S3
    const hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    const s3Key = `tenants/${ctx.tenantId}/dossiers/${dossierId}/${hash}`;
    await uploadDocument(s3Key, encryptedFile, "application/pdf");

    // 5. Créer l'enregistrement Document
    const metadata: Record<string, unknown> = {
      description: (subject as string)?.trim() || docTitle,
      originalType: "application/pdf",
      iv: iv.toString("base64"),
      encryptedDek: encryptedDek.toString("base64"),
      chiffre: true,
      source: "pdf-genere",
      templateId: template.id,
      templateTitre: template.titre,
      reference: (reference as string)?.trim() || docReference,
    };
    if (tacheId && typeof tacheId === "string") {
      metadata.tacheId = tacheId;
    }
    if (missionId && typeof missionId === "string") {
      metadata.missionId = missionId;
    }

    const document = await ctx.prisma.document.create({
      data: {
        dossierId,
        nom: fileName,
        categorie: "note_interne",
        s3KeyChiffre: s3Key,
        hashSha256: hash,
        taille: pdfBuffer.length,
        publieClient: isPublieClient,
        datePublication: isPublieClient ? new Date() : null,
        creePar: ctx.userId,
        metadata: metadata as any,
      },
    });

    // 6. Lier le document à la tâche si fournie (via metadata de la tâche)
    if (tacheId && typeof tacheId === "string") {
      const tache = await ctx.prisma.tache.findUnique({
        where: { id: tacheId },
        select: { id: true, checklist: true },
      });
      if (tache) {
        const checklist = (tache.checklist as Record<string, unknown> | null) || {};
        const documents = Array.isArray(checklist.documents) ? checklist.documents : [];
        documents.push({ documentId: document.id, nom: fileName, genereLe: new Date().toISOString() });
        await ctx.prisma.tache.update({
          where: { id: tacheId },
          data: { checklist: { ...checklist, documents } as any },
        });
      }
    }

    await logAudit(ctx.prisma, ctx.userId, "document_pdf_generated", "document", document.id, {
      templateId: template.id,
      dossierId,
      tacheId: tacheId || null,
      missionId: missionId || null,
    });

    // 7. Retourner le PDF en prévisualisation + les infos du document créé
    const safeFileName = encodeURIComponent(fileName).replace(/%20/g, " ");
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeFileName}"`,
        "Cache-Control": "no-store",
        "X-Document-Id": document.id,
        "X-Document-Saved": "true",
      },
    });
  } catch (error) {
    console.error("PDF generation error", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
