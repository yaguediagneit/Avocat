import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { publicPrisma } from "@/lib/prisma";
import { uploadDocument, getDocumentBuffer } from "@/lib/s3";
import { logAudit } from "@/lib/audit";
import { generateLegalPdf, type PdfThemeConfig, type CabinetInfo } from "@/lib/pdf-generator";
import { renderDocumentTemplate, suggestVariableValues, extractTemplateVariables } from "@/lib/document-template";
import { encryptDocumentServerSide } from "@/lib/pdf-encrypt";
import { PIECE_STATUTS } from "@/lib/demarches";
import crypto from "crypto";

const DEFAULT_PDF_THEME: PdfThemeConfig = {
  primaryColor: "#2c4c7c",
  secondaryColor: "#c78124",
  fontFamily: "Helvetica",
  fontSize: 11,
  headerText: "",
  footerText: "",
};

function demandeurLabel(d: any): string {
  if (!d) return "";
  if (d.typePersonne === "MORALE") return d.raisonSociale || d.nom;
  return [d.civilite, d.prenoms, d.nom].filter(Boolean).join(" ") || d.nom;
}

function parcelleLabel(p: any): string {
  if (!p) return "";
  return [
    p.adresse,
    [p.quartier, p.commune].filter(Boolean).join(", "),
    p.departement,
    p.region,
  ]
    .filter(Boolean)
    .join(" — ");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "demarches", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const demarche = await ctx.prisma.demarche.findUnique({
    where: { id: params.id },
    include: {
      type: true,
      dossier: { include: { client: true } },
      demandeur: true,
      mandataire: true,
      parcelle: true,
      autorite: true,
      pieces: { orderBy: { ordre: "asc" } },
    },
  });
  if (!demarche) return NextResponse.json({ error: "Démarche non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, demarche.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { modeleId, variables, publieClient } = body as {
    modeleId?: string;
    variables?: Record<string, string>;
    publieClient?: boolean;
  };

  const modele = modeleId
    ? await ctx.prisma.demarcheModele.findUnique({ where: { id: modeleId } })
    : null;
  if (modeleId && !modele) {
    return NextResponse.json({ error: "Modèle non trouvé" }, { status: 404 });
  }

  const tenant = await publicPrisma.tenant.findUnique({ where: { id: ctx.tenantId } });
  if (!tenant) return NextResponse.json({ error: "Cabinet non trouvé" }, { status: 404 });
  const config = (tenant.configuration as Record<string, unknown>) || {};
  const pdfTheme = (config.pdfTheme as Partial<PdfThemeConfig>) || {};
  const theme: PdfThemeConfig = { ...DEFAULT_PDF_THEME, ...pdfTheme };
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

  const d = demarche as any;
  const piecesLabels = demarche.pieces
    .map((p, i) => {
      const s = PIECE_STATUTS.find((x) => x.code === p.statut)?.label || p.statut;
      return `${i + 1}. ${p.libelle} (${s})`;
    })
    .join("\n");

  // Variables canoniques pré-remplies depuis la démarche : elles alimentent
  // les champs du modèle si la variable correspondante existe.
  const auto: Record<string, string> = {
    reference_demarche: demarche.reference,
    reference: demarche.reference,
    date_courrier: new Date().toLocaleDateString("fr-FR"),
    date: new Date().toLocaleDateString("fr-FR"),
    type_demarche: demarche.type.libelle,
    objet: demarche.objet || demarche.type.libelle,
    autorite: demarche.autorite?.nom || demarche.autoriteLibre || "",
    bureau_cadastre: demarche.autorite?.nom || demarche.autoriteLibre || "",
    adresse_depot: demarche.adresseDepot || demarche.autorite?.adresse || "",
    demandeur_nom_complet: demandeurLabel(demarche.demandeur),
    demandeur: demandeurLabel(demarche.demandeur),
    qualite_demandeur:
      demarche.demandeur?.typePersonne === "MORALE"
        ? demarche.demandeur?.qualiteSignataire || "représentant légal"
        : "propriétaire / demandeur",
    adresse_demandeur:
      demarche.demandeur?.adresse ||
      [demarche.demandeur?.commune, demarche.demandeur?.region].filter(Boolean).join(", "),
    mandataire: demandeurLabel(demarche.mandataire),
    localisation_parcelle: parcelleLabel(demarche.parcelle),
    nicad: demarche.parcelle?.nicad || "",
    titre_foncier: demarche.parcelle?.titreFoncier || "",
    references_foncieres:
      [demarche.parcelle?.titreFoncier, demarche.parcelle?.referenceDroit, demarche.referenceActes]
        .filter(Boolean)
        .join(", "),
    liste_pieces: piecesLabels,
    nb_exemplaires: String(demarche.type.nbExemplaires || 2),
    dossier: demarche.dossier.referenceInterne,
    client: demarche.dossier.client.raisonSociale,
    fondement: demarche.fondement || "",
    sous_type: demarche.sousType || "",
    numero_recepisse: demarche.numeroRecepisse || "",
    signataire_nom: "",
    signataire_qualite: "",
  };

  const variablesMap: Record<string, string> = { ...auto, ...(variables || {}) };

  // Suggestions depuis le contexte cabinet/utilisateur/dossier/client.
  if (modele?.contenu) {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { prenom: true, nom: true, titre: true },
    });
    const suggestions = suggestVariableValues(extractTemplateVariables(modele.contenu), {
      cabinet: {
        raisonSociale: tenant.raisonSociale,
        adresse: tenant.adresse ?? undefined,
        telephone: String(config.telephonePrincipal ?? ""),
        email: String(config.email ?? ""),
      },
      user: user
        ? { prenom: user.prenom, nom: user.nom, titre: user.titre ?? undefined }
        : undefined,
      dossier: demarche.dossier,
      client: {
        raisonSociale: demarche.dossier.client.raisonSociale,
        adresse: demarche.dossier.client.adresse ?? undefined,
        coordonnees: demarche.dossier.client.coordonnees,
        representants: demarche.dossier.client.representants,
      },
    });
    for (const [k, v] of Object.entries(suggestions)) {
      if (!variablesMap[k]?.trim()) variablesMap[k] = v;
    }
    if (!variablesMap.signataire_nom) {
      variablesMap.signataire_nom = [user?.prenom, user?.nom].filter(Boolean).join(" ");
    }
    if (!variablesMap.signataire_qualite) {
      variablesMap.signataire_qualite = user?.titre || "";
    }
  }

  const docTitle = modele?.titre || `Demande — ${demarche.type.libelle}`;
  const docContent = modele?.contenu
    ? renderDocumentTemplate(modele.contenu, variablesMap)
    : `Objet : ${demarche.type.libelle}\n\n${demarche.objet || ""}\n\n${demarche.fondement || ""}`;

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
    console.error("Signature utilisateur illisible", err);
  }

  try {
    const pdfBytes = await generateLegalPdf(
      {
        title: docTitle,
        reference: demarche.reference,
        date: new Date().toLocaleDateString("fr-FR"),
        recipient: demarche.autorite?.nom || demarche.autoriteLibre || "",
        body: docContent,
        signature: signatureImage ? " " : "",
        signatureImage,
      },
      cabinetInfo,
      theme
    );

    const pdfBuffer = Buffer.from(pdfBytes);
    const fileName = `${docTitle} - ${demarche.reference}.pdf`;

    const tenantKey = await publicPrisma.tenantKey.findFirst({
      where: { tenantId: ctx.tenantId },
    });
    if (!tenantKey) {
      return NextResponse.json({ error: "Clé du cabinet manquante" }, { status: 500 });
    }
    const publicKeyJwk = JSON.parse(tenantKey.publicKey) as JsonWebKey;
    const { encryptedFile, encryptedDek, iv } = await encryptDocumentServerSide(
      pdfBuffer,
      publicKeyJwk
    );

    const hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    const s3Key = `tenants/${ctx.tenantId}/dossiers/${demarche.dossierId}/${hash}`;
    await uploadDocument(s3Key, encryptedFile, "application/pdf");

    const document = await ctx.prisma.document.create({
      data: {
        dossierId: demarche.dossierId,
        nom: fileName,
        categorie: "courrier",
        s3KeyChiffre: s3Key,
        hashSha256: hash,
        taille: pdfBuffer.length,
        publieClient: publieClient === true,
        datePublication: publieClient === true ? new Date() : null,
        creePar: ctx.userId,
        metadata: {
          description: docTitle,
          originalType: "application/pdf",
          iv: iv.toString("base64"),
          encryptedDek: encryptedDek.toString("base64"),
          chiffre: true,
          source: "demarche",
          demarcheId: demarche.id,
          demarcheReference: demarche.reference,
          modeleId: modele?.id || null,
          modeleCode: modele?.code || null,
        } as any,
      },
    });

    await ctx.prisma.demarcheEvenement.create({
      data: {
        demarcheId: demarche.id,
        type: "NOTE",
        description: `Document généré : ${docTitle} (${modele?.code || "libre"})`,
        details: { documentId: document.id, modeleCode: modele?.code },
        creePar: ctx.userId,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "demarche_pdf_generated", "demarche", demarche.id, {
      modeleId: modele?.id || null,
      documentId: document.id,
    });

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
    console.error("Demarche PDF generation error", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
