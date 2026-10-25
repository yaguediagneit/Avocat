import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { publicPrisma } from "@/lib/prisma";
import { uploadDocument, getDocumentBuffer } from "@/lib/s3";
import { logAudit } from "@/lib/audit";
import { encryptDocumentServerSide } from "@/lib/pdf-encrypt";
import crypto from "crypto";

/**
 * POST — télécharge le modèle Word (.docx) stocké dans S3.
 *
 * Le fichier est retourné tel quel, sans substitution de variables.
 * L'utilisateur l'édite dans Word puis l'enregistre via /word/upload.
 *
 * Le modèle original n'est jamais modifié : on retourne directement le
 * buffer S3, sans passer par docxtemplater.
 *
 * Modes :
 *  - downloadOnly=true  : retourne le .docx sans l'enregistrer
 *  - downloadOnly=false : enregistre le .docx dans le dossier et le retourne
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = params;

  const template = await ctx.prisma.tacheTemplate.findUnique({
    where: { id },
    select: { id: true, titre: true, wordTemplateKey: true },
  });

  if (!template) {
    return NextResponse.json({ error: "Modèle non trouvé" }, { status: 404 });
  }

  if (!template.wordTemplateKey) {
    return NextResponse.json({ error: "Aucun modèle Word associé à cette tâche" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    title,
    dossierId,
    tacheId,
    missionId,
    publieClient,
    downloadOnly,
  } = body as Record<string, string | boolean>;

  if (!dossierId || typeof dossierId !== "string") {
    return NextResponse.json({ error: "L'identifiant du dossier est requis" }, { status: 400 });
  }

  // Vérifier l'accès au dossier
  const dossierOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, dossierId, "write");
  if (!dossierOk) {
    return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
  }

  const docTitle = (title as string)?.trim() || template.titre;
  const isDownloadOnly = downloadOnly === true;
  const isPublieClient = publieClient === true;

  try {
    // Charger le modèle .docx depuis S3 tel quel (sans substitution)
    const docxBuffer = await getDocumentBuffer(template.wordTemplateKey);
    const fileName = `${docTitle}.docx`;

    // Mode downloadOnly : retourner le .docx sans l'enregistrer
    if (isDownloadOnly) {
      const safeFileName = encodeURIComponent(fileName).replace(/%20/g, " ");
      return new NextResponse(new Uint8Array(docxBuffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${safeFileName}"`,
          "Cache-Control": "no-store",
          "X-Document-Saved": "false",
        },
      });
    }

    // Mode complet : chiffrer, enregistrer dans le dossier
    const tenantKey = await publicPrisma.tenantKey.findFirst({
      where: { tenantId: ctx.tenantId },
    });

    if (!tenantKey) {
      return NextResponse.json({ error: "Clé du cabinet manquante" }, { status: 500 });
    }

    const publicKeyJwk = JSON.parse(tenantKey.publicKey) as JsonWebKey;

    const { encryptedFile, encryptedDek, iv } = await encryptDocumentServerSide(
      docxBuffer,
      publicKeyJwk
    );

    const hash = crypto.createHash("sha256").update(docxBuffer).digest("hex");
    const s3Key = `tenants/${ctx.tenantId}/dossiers/${dossierId}/${hash}`;
    await uploadDocument(s3Key, encryptedFile, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    const metadata: Record<string, unknown> = {
      description: docTitle,
      originalType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      iv: iv.toString("base64"),
      encryptedDek: encryptedDek.toString("base64"),
      chiffre: true,
      source: "word-genere",
      templateId: template.id,
      templateTitre: template.titre,
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
        taille: docxBuffer.length,
        publieClient: isPublieClient,
        datePublication: isPublieClient ? new Date() : null,
        creePar: ctx.userId,
        metadata: metadata as any,
      },
    });

    // Lier le document à la tâche si fournie
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

    await logAudit(ctx.prisma, ctx.userId, "document_word_generated", "document", document.id, {
      templateId: template.id,
      dossierId,
      tacheId: tacheId || null,
      missionId: missionId || null,
    });

    const safeFileName = encodeURIComponent(fileName).replace(/%20/g, " ");
    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `inline; filename="${safeFileName}"`,
        "Cache-Control": "no-store",
        "X-Document-Id": document.id,
        "X-Document-Saved": "true",
      },
    });
  } catch (error) {
    console.error("Word generation error", error);
    return NextResponse.json({ error: "Erreur lors de la génération du document Word" }, { status: 500 });
  }
}
