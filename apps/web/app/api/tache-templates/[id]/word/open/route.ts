import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { createWebDAVToken } from "@/lib/webdav-tokens";

/**
 * POST — génère un token WebDAV et une URL ms-word: pour ouvrir le
 * modèle Word directement dans Microsoft Word.
 *
 * Quand l'utilisateur clique "Enregistrer" dans Word, Word envoie un PUT
 * sur l'URL WebDAV, ce qui chiffre et enregistre le fichier dans le dossier.
 *
 * Le flux :
 *  1. L'utilisateur clique "Ouvrir dans Word"
 *  2. Cette API génère un token + URL ms-word:
 *  3. Le navigateur ouvre ms-word:ofe|u|https://domain/webdav/{token}/{file}.docx
 *  4. Word ouvre le fichier depuis le serveur (GET WebDAV)
 *  5. L'utilisateur édite dans Word
 *  6. L'utilisateur clique "Enregistrer" → Word envoie PUT WebDAV
 *  7. Le serveur chiffre, stocke dans S3, crée un Document
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
  const { dossierId, tacheId } = body as { dossierId?: string; tacheId?: string };

  if (!dossierId) {
    return NextResponse.json({ error: "L'identifiant du dossier est requis" }, { status: 400 });
  }

  // Vérifier l'accès au dossier
  const dossierOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, dossierId, "write");
  if (!dossierOk) {
    return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
  }

  const fileName = `${template.titre}.docx`;

  // Générer le token WebDAV
  const { token } = createWebDAVToken({
    templateId: template.id,
    templateTitre: template.titre,
    wordTemplateKey: template.wordTemplateKey,
    dossierId,
    tacheId,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    fileName,
  });

  // Construire l'URL publique
  // Utiliser NEXT_PUBLIC_APP_URL ou le Host header
  const host = req.headers.get("host") || "localhost:3000";
  const protocol = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;
  const webdavUrl = `${baseUrl}/webdav/${token}/${encodeURIComponent(fileName)}`;
  const msWordUrl = `ms-word:ofe|u|${webdavUrl}`;

  return NextResponse.json({
    ok: true,
    msWordUrl,
    webdavUrl,
    token,
  });
}
