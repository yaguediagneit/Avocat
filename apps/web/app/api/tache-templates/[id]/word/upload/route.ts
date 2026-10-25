import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { publicPrisma } from "@/lib/prisma";
import { uploadDocument } from "@/lib/s3";
import { logAudit } from "@/lib/audit";
import { encryptDocumentServerSide } from "@/lib/pdf-encrypt";
import crypto from "crypto";

/**
 * POST — enregistre un document Word édité par l'utilisateur dans le dossier.
 *
 * Le flux :
 *  1. L'utilisateur clique « Générer Word » → le .docx est téléchargé
 *  2. L'utilisateur édite le fichier dans Word et l'enregistre localement
 *  3. L'utilisateur clique « Enregistrer le document » → ce endpoint reçoit
 *     le fichier édité, le chiffre, le stocke dans S3 et crée un Document.
 *
 * Le modèle Word original (wordTemplateKey) n'est jamais modifié.
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

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const dossierId = formData.get("dossierId") as string | null;
  const tacheId = formData.get("tacheId") as string | null;
  const title = (formData.get("title") as string | null) || template.titre;
  const publieClient = formData.get("publieClient") === "true";

  if (!file) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  if (!dossierId) {
    return NextResponse.json({ error: "L'identifiant du dossier est requis" }, { status: 400 });
  }

  // Vérifier l'accès au dossier
  const dossierOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, dossierId, "write");
  if (!dossierOk) {
    return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
  }

  try {
    const docxBuffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name || `${title}.docx`;

    // Récupérer la clé publique du tenant pour chiffrer
    const tenantKey = await publicPrisma.tenantKey.findFirst({
      where: { tenantId: ctx.tenantId },
    });

    if (!tenantKey) {
      return NextResponse.json({ error: "Clé du cabinet manquante" }, { status: 500 });
    }

    const publicKeyJwk = JSON.parse(tenantKey.publicKey) as JsonWebKey;

    // Chiffrer le .docx
    const { encryptedFile, encryptedDek, iv } = await encryptDocumentServerSide(
      docxBuffer,
      publicKeyJwk
    );

    // Stocker dans S3
    const hash = crypto.createHash("sha256").update(docxBuffer).digest("hex");
    const s3Key = `tenants/${ctx.tenantId}/dossiers/${dossierId}/${hash}`;
    await uploadDocument(s3Key, encryptedFile, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    // Créer l'enregistrement Document
    const metadata: Record<string, unknown> = {
      description: title,
      originalType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      iv: iv.toString("base64"),
      encryptedDek: encryptedDek.toString("base64"),
      chiffre: true,
      source: "word-upload",
      templateId: template.id,
      templateTitre: template.titre,
    };
    if (tacheId) {
      metadata.tacheId = tacheId;
    }

    const document = await ctx.prisma.document.create({
      data: {
        dossierId,
        nom: fileName,
        categorie: "note_interne",
        s3KeyChiffre: s3Key,
        hashSha256: hash,
        taille: docxBuffer.length,
        publieClient,
        datePublication: publieClient ? new Date() : null,
        creePar: ctx.userId,
        metadata: metadata as any,
      },
    });

    // Lier le document à la tâche si fournie
    if (tacheId) {
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

    await logAudit(ctx.prisma, ctx.userId, "document_word_uploaded", "document", document.id, {
      templateId: template.id,
      dossierId,
      tacheId: tacheId || null,
    });

    return NextResponse.json({
      ok: true,
      documentId: document.id,
      documentName: fileName,
    });
  } catch (error) {
    console.error("Word upload error", error);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement du document Word" }, { status: 500 });
  }
}
