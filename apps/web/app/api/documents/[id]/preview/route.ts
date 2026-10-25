import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { importPKCS8 } from "jose";
import { guard } from "@/lib/api-guard";
import { canAccessDossier, estIntervenantExterne } from "@/lib/rbac";
import { canClientAccessDossier } from "@/lib/client-access";
import { publicPrisma } from "@/lib/prisma";
import { s3 } from "@/lib/s3";
import { logAudit } from "@/lib/audit";

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  txt: "text/plain",
  html: "text/html",
  htm: "text/html",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "documents", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { id } = params;

  const document = await ctx.prisma.document.findUnique({
    where: { id },
    include: {
      dossier: { select: { referenceInterne: true, clientId: true } },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document non trouvé" }, { status: 404 });
  }

  const dossierOk = ctx.isClient
    ? document.publieClient &&
      (await canClientAccessDossier(ctx.prisma, ctx.userId, ctx.clientId, document.dossierId))
    : await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, document.dossierId, "read") &&
      // Les intervenants externes (huissier, collaborateurs externes) ne
      // prévisualisent que les documents partagés avec eux.
      (!estIntervenantExterne(ctx.roleInfo) || document.partageExterne);
  if (!dossierOk) {
    return NextResponse.json({ error: "Accès interdit à ce document" }, { status: 403 });
  }

  const metadata = (document.metadata as Record<string, string>) || {};
  if (!metadata.iv || !metadata.encryptedDek) {
    return NextResponse.json({ error: "Métadonnées manquantes" }, { status: 400 });
  }

  try {
    const iv = Buffer.from(metadata.iv, "base64");
    const encryptedDek = Buffer.from(metadata.encryptedDek, "base64");

    const tenantKey = await publicPrisma.tenantKey.findFirst({
      where: { tenantId: ctx.tenantId },
    });

    if (!tenantKey) {
      return NextResponse.json({ error: "Clé du cabinet manquante" }, { status: 500 });
    }

    const privatePem = Buffer.from(tenantKey.encryptedPrivateKey, "base64").toString("utf8");
    const privateKey = await importPKCS8(privatePem, "RSA-OAEP-256");

    const dek = await crypto.subtle.unwrapKey(
      "raw",
      encryptedDek,
      privateKey,
      { name: "RSA-OAEP" },
      { name: "AES-GCM", length: 256 },
      true,
      ["decrypt"]
    );

    const s3Response = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: document.s3KeyChiffre,
      })
    );

    if (!s3Response.Body) {
      return NextResponse.json({ error: "Fichier introuvable dans le stockage" }, { status: 500 });
    }

    const encryptedFile = Buffer.from(await s3Response.Body.transformToByteArray());
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      dek,
      encryptedFile
    );

    const fileName = encodeURIComponent(document.nom).replace(/%20/g, " ");
    const contentType = getMimeType(document.nom);
    await logAudit(ctx.prisma, ctx.userId, "document_previewed", "document", document.id);

    return new NextResponse(Buffer.from(decrypted), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Document preview error", error);
    return NextResponse.json({ error: "Erreur de déchiffrement ou de prévisualisation" }, { status: 500 });
  }
}
