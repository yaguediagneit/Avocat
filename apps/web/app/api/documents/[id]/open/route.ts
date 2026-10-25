import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier, estIntervenantExterne } from "@/lib/rbac";
import { canClientAccessDossier } from "@/lib/client-access";
import { createWebDAVToken } from "@/lib/webdav-tokens";

/**
 * POST — génère un token WebDAV et une URL ms-word:ofv (lecture seule)
 * pour ouvrir un document déjà uploadé directement dans Word en mode
 * lecture seule.
 *
 * Contrairement à /word/open (qui ouvre le modèle pour édition), celui-ci
 * ouvre le document chiffré stocké dans le dossier, en lecture seule.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "documents", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const document = await ctx.prisma.document.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      nom: true,
      s3KeyChiffre: true,
      dossierId: true,
      publieClient: true,
      partageExterne: true,
      metadata: true,
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Document non trouvé" }, { status: 404 });
  }

  // Vérifier l'accès au document (mêmes règles que preview)
  const dossierOk = ctx.isClient
    ? document.publieClient &&
      (await canClientAccessDossier(ctx.prisma, ctx.userId, ctx.clientId, document.dossierId))
    : await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, document.dossierId, "read") &&
      (!estIntervenantExterne(ctx.roleInfo) || document.partageExterne);

  if (!dossierOk) {
    return NextResponse.json({ error: "Accès interdit à ce document" }, { status: 403 });
  }

  const metadata = (document.metadata as Record<string, string>) || {};
  if (!metadata.iv || !metadata.encryptedDek) {
    return NextResponse.json({ error: "Métadonnées manquantes" }, { status: 400 });
  }

  // Générer le token WebDAV pour ce document (mode lecture)
  const { token } = createWebDAVToken({
    templateId: "document-" + document.id,
    templateTitre: document.nom,
    wordTemplateKey: "document:" + document.id,
    dossierId: document.dossierId,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    fileName: document.nom,
  });

  // Construire l'URL publique
  const host = req.headers.get("host") || "localhost:3000";
  const protocol = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;
  const encodedName = encodeURIComponent(document.nom);
  const webdavUrl = `${baseUrl}/webdav/${token}/${encodedName}`;
  // ofv = open for view (lecture seule)
  const msWordUrl = `ms-word:ofv|u|${webdavUrl}`;

  return NextResponse.json({
    ok: true,
    msWordUrl,
    webdavUrl,
    token,
  });
}
