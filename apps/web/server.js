/**
 * Serveur Next.js personnalisé avec gestionnaire WebDAV pour l'édition
 * directe de fichiers Word (.docx) depuis Microsoft Word.
 *
 * Le protocole ms-word:ofe|u|URL permet à Word d'ouvrir un fichier depuis
 * une URL WebDAV. Quand l'utilisateur clique "Enregistrer" dans Word, Word
 * envoie un PUT sur la même URL. Ce serveur intercepte /webdav/* et gère
 * le protocole WebDAV minimal requis par Word :
 *   - OPTIONS  : annonce le support WebDAV
 *   - PROPFIND : retourne les propriétés du fichier (XML)
 *   - GET      : retourne le contenu du fichier depuis S3
 *   - HEAD     : retourne les en-têtes du fichier
 *   - PUT      : reçoit le fichier édité, le chiffre, le stocke dans S3
 *   - LOCK/UNLOCK : verrous factices (Word en a besoin)
 *
 * L'authentification se fait via un token embarqué dans l'URL, généré par
 * l'API /api/tache-templates/[id]/word/open après authentification de
 * l'utilisateur.
 */

const { createServer } = require("http");
const { PrismaClient: TenantPrismaClient } = require("@prisma/client");
const { PrismaClient: PublicPrismaClient } = require("./prisma/generated/public");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");

// jose is ESM-only — use dynamic import
let _importJWK = null;
async function getImportJWK() {
  if (!_importJWK) {
    const jose = await import("jose");
    _importJWK = jose.importJWK;
  }
  return _importJWK;
}

// Charger les variables d'environnement depuis .env
const fs = require("fs");
const path = require("path");
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== "production";

// --- S3 Client ---
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true,
});

async function getDocumentBuffer(key) {
  const resp = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  const chunks = [];
  for await (const chunk of resp.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function uploadDocument(key, body, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

// --- Prisma ---
const publicPrisma = new PublicPrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const tenantClients = new Map();

async function getTenantPrisma(tenantId) {
  let cached = tenantClients.get(tenantId);
  if (cached) return cached;
  const tenant = await publicPrisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant non trouvé");
  const baseUrl = tenant.databaseUrl || `${process.env.DATABASE_URL}?schema=${tenant.schemaName}`;
  const client = new TenantPrismaClient({ datasources: { db: { url: baseUrl } } });
  tenantClients.set(tenantId, client);
  return client;
}

// --- WebDAV Token Store (shared with lib/webdav-tokens.ts via global) ---
const globalForTokens = globalThis;
if (!globalForTokens.__webdavTokens) {
  globalForTokens.__webdavTokens = new Map();
}
const tokens = globalForTokens.__webdavTokens;

function getTokenContext(token) {
  const ctx = tokens.get(token);
  if (!ctx) return null;
  if (ctx.expiresAt < Date.now()) {
    tokens.delete(token);
    return null;
  }
  return ctx;
}

// --- Encryption (server-side, same as lib/pdf-encrypt.ts) ---
async function encryptDocumentServerSide(fileBuffer, publicKeyJwk) {
  const importJWK = await getImportJWK();
  const publicKey = await importJWK(publicKeyJwk, "RSA-OAEP-256");
  const dek = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "wrapKey"]
  );
  const iv = crypto.randomBytes(12);
  const encryptedFile = Buffer.from(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, dek, fileBuffer)
  );
  const encryptedDek = Buffer.from(
    await crypto.subtle.wrapKey("raw", dek, publicKey, {
      name: "RSA-OAEP",
      label: Buffer.from("document-encryption"),
    })
  );
  return { encryptedFile, encryptedDek, iv };
}

// --- WebDAV Handlers ---

/**
 * Récupère le contenu d'un fichier depuis S3.
 * - Si wordTemplateKey commence par "document:" → c'est un document chiffré
 *   du dossier, on le déchiffre.
 * - Sinon → c'est un modèle Word brut, on le retourne tel quel.
 */
async function getFileBuffer(ctx) {
  if (ctx.wordTemplateKey.startsWith("document:")) {
    // Document chiffré : déchiffrer depuis S3
    const documentId = ctx.wordTemplateKey.substring("document:".length);
    const prisma = await getTenantPrisma(ctx.tenantId);

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { s3KeyChiffre: true, metadata: true },
    });

    if (!document) throw new Error("Document non trouvé");

    const metadata = document.metadata || {};
    const iv = Buffer.from(metadata.iv, "base64");
    const encryptedDek = Buffer.from(metadata.encryptedDek, "base64");

    const tenantKey = await publicPrisma.tenantKey.findFirst({
      where: { tenantId: ctx.tenantId },
    });
    if (!tenantKey) throw new Error("Clé du cabinet manquante");

    const importJWK = await getImportJWK();
    // Pour le déchiffrement, on a besoin de la clé privée
    const { importPKCS8 } = await import("jose");
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

    const encryptedFile = await getDocumentBuffer(document.s3KeyChiffre);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      dek,
      encryptedFile
    );

    return Buffer.from(decrypted);
  }

  // Modèle Word brut : retourner tel quel
  return getDocumentBuffer(ctx.wordTemplateKey);
}

function parseUrl(url) {
  // /webdav/{token}/{filename}
  const match = url.match(/^\/webdav\/([a-f0-9]+)\/(.+)$/);
  if (!match) return null;
  return { token: match[1], fileName: decodeURIComponent(match[2]) };
}

function buildPropfindResponse(baseUrl, fileName, fileSize) {
  const encodedName = encodeURIComponent(fileName).replace(/%20/g, " ");
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${baseUrl}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${fileName}</D:displayname>
        <D:getcontentlength>${fileSize}</D:getcontentlength>
        <D:getcontenttype>application/vnd.openxmlformats-officedocument.wordprocessingml.document</D:getcontenttype>
        <D:getlastmodified>${now}</D:getlastmodified>
        <D:creationdate>${now}</D:creationdate>
        <D:resourcetype/>
        <D:supportedlock>
          <D:lockentry>
            <D:lockscope><D:exclusive/></D:lockscope>
            <D:locktype><D:write/></D:locktype>
          </D:lockentry>
        </D:supportedlock>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;
}

function buildLockResponse(baseUrl, fileName) {
  const lockToken = crypto.randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  const timeout = Date.now() + 60 * 60 * 1000;
  return `<?xml version="1.0" encoding="UTF-8"?>
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:exclusive/></D:lockscope>
      <D:depth>0</D:depth>
      <D:owner>Word</D:owner>
      <D:timeout>Second-3600</D:timeout>
      <D:locktoken><D:href>opaquelocktoken:${lockToken}</D:href></D:locktoken>
      <D:lockroot><D:href>${baseUrl}</D:href></D:lockroot>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>`;
}

async function handleWebDAV(req, res) {
  const parsed = parseUrl(req.url);
  if (!parsed) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const { token, fileName } = parsed;
  const ctx = getTokenContext(token);

  if (!ctx) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    res.end("Token invalide ou expiré");
    return;
  }

  const method = req.method.toUpperCase();
  const fullUrl = req.url;

  // OPTIONS — advertise WebDAV support
  if (method === "OPTIONS") {
    res.writeHead(200, {
      "DAV": "1, 2",
      "MS-Author-Via": "DAV",
      "Allow": "OPTIONS, GET, HEAD, PUT, PROPFIND, PROPPATCH, MKCOL, DELETE, LOCK, UNLOCK",
      "Content-Length": "0",
    });
    res.end();
    return;
  }

  // PROPFIND — return file properties
  if (method === "PROPFIND") {
    try {
      const buffer = await getFileBuffer(ctx);
      const xml = buildPropfindResponse(fullUrl, fileName, buffer.length);
      res.writeHead(207, {
        "Content-Type": "application/xml; charset=utf-8",
        "DAV": "1, 2",
        "MS-Author-Via": "DAV",
      });
      res.end(xml);
    } catch (err) {
      console.error("WebDAV PROPFIND error:", err.message);
      res.writeHead(500);
      res.end("Internal error");
    }
    return;
  }

  // GET — return file content
  if (method === "GET") {
    try {
      const buffer = await getFileBuffer(ctx);
      const safeName = encodeURIComponent(fileName).replace(/%20/g, " ");
      res.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Content-Length": buffer.length,
        "Cache-Control": "no-store",
        "DAV": "1, 2",
      });
      res.end(buffer);
    } catch (err) {
      console.error("WebDAV GET error:", err.message);
      res.writeHead(500);
      res.end("Internal error");
    }
    return;
  }

  // HEAD — return headers only
  if (method === "HEAD") {
    try {
      const buffer = await getFileBuffer(ctx);
      const safeName = encodeURIComponent(fileName).replace(/%20/g, " ");
      res.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Content-Length": buffer.length,
        "Cache-Control": "no-store",
      });
      res.end();
    } catch (err) {
      console.error("WebDAV HEAD error:", err.message);
      res.writeHead(500);
      res.end();
    }
    return;
  }

  // PUT — receive edited file, encrypt, store in S3, create Document
  // (uniquement pour les modèles, pas pour les documents en lecture seule)
  if (method === "PUT") {
    if (ctx.wordTemplateKey.startsWith("document:")) {
      // Lecture seule : refuser le PUT
      res.writeHead(403);
      res.end("Read-only");
      return;
    }
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const docxBuffer = Buffer.concat(chunks);

      const prisma = await getTenantPrisma(ctx.tenantId);

      // Get tenant public key for encryption
      const tenantKey = await publicPrisma.tenantKey.findFirst({
        where: { tenantId: ctx.tenantId },
      });

      if (!tenantKey) {
        res.writeHead(500);
        res.end("Clé du cabinet manquante");
        return;
      }

      const publicKeyJwk = JSON.parse(tenantKey.publicKey);
      const { encryptedFile, encryptedDek, iv } = await encryptDocumentServerSide(
        docxBuffer,
        publicKeyJwk
      );

      const hash = crypto.createHash("sha256").update(docxBuffer).digest("hex");
      const s3Key = `tenants/${ctx.tenantId}/dossiers/${ctx.dossierId}/${hash}`;
      await uploadDocument(
        s3Key,
        encryptedFile,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );

      const metadata = {
        description: ctx.templateTitre,
        originalType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        iv: iv.toString("base64"),
        encryptedDek: encryptedDek.toString("base64"),
        chiffre: true,
        source: "word-webdav",
        templateId: ctx.templateId,
        templateTitre: ctx.templateTitre,
      };
      if (ctx.tacheId) metadata.tacheId = ctx.tacheId;

      const document = await prisma.document.create({
        data: {
          dossierId: ctx.dossierId,
          nom: fileName,
          categorie: "note_interne",
          s3KeyChiffre: s3Key,
          hashSha256: hash,
          taille: docxBuffer.length,
          publieClient: false,
          datePublication: null,
          creePar: ctx.userId,
          metadata: metadata,
        },
      });

      // Link to task
      if (ctx.tacheId) {
        const tache = await prisma.tache.findUnique({
          where: { id: ctx.tacheId },
          select: { id: true, checklist: true },
        });
        if (tache) {
          const checklist = tache.checklist || {};
          const documents = Array.isArray(checklist.documents) ? checklist.documents : [];
          documents.push({
            documentId: document.id,
            nom: fileName,
            genereLe: new Date().toISOString(),
          });
          await prisma.tache.update({
            where: { id: ctx.tacheId },
            data: { checklist: { ...checklist, documents } },
          });
        }
      }

      // Audit log
      try {
        await prisma.auditLog.create({
          data: {
            userId: ctx.userId,
            action: "document_word_webdav_saved",
            entite: "document",
            entiteId: document.id,
            details: {
              templateId: ctx.templateId,
              dossierId: ctx.dossierId,
              tacheId: ctx.tacheId || null,
            },
            adresseIp: "127.0.0.1",
            userAgent: "WebDAV/Word",
          },
        });
      } catch {}

      // Mark token as saved
      ctx.saved = true;
      ctx.documentId = document.id;

      res.writeHead(200, { "Content-Length": "0" });
      res.end();
    } catch (err) {
      console.error("WebDAV PUT error:", err.message);
      res.writeHead(500);
      res.end("Internal error");
    }
    return;
  }

  // LOCK — return a fake lock token
  if (method === "LOCK") {
    const xml = buildLockResponse(fullUrl, fileName);
    res.writeHead(200, {
      "Content-Type": "application/xml; charset=utf-8",
      "Lock-Token": `<opaquelocktoken:${crypto.randomBytes(16).toString("hex")}>`,
    });
    res.end(xml);
    return;
  }

  // UNLOCK — always succeed
  if (method === "UNLOCK") {
    res.writeHead(204);
    res.end();
    return;
  }

  // PROPPATCH — no-op success
  if (method === "PROPPATCH") {
    res.writeHead(207, { "Content-Type": "application/xml; charset=utf-8" });
    res.end(`<?xml version="1.0" encoding="UTF-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${fullUrl}</D:href>
    <D:propstat>
      <D:prop/>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`);
    return;
  }

  // MKCOL / DELETE — not supported for single-file WebDAV
  if (method === "MKCOL" || method === "DELETE") {
    res.writeHead(403);
    res.end("Not supported");
    return;
  }

  res.writeHead(405, { Allow: "OPTIONS, GET, HEAD, PUT, PROPFIND, LOCK, UNLOCK" });
  res.end("Method not allowed");
}

// --- Next.js custom server ---
async function startServer() {
  const next = require("next");
  const app = next({ dev: isDev });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = createServer(async (req, res) => {
    // Intercept WebDAV requests
    if (req.url.startsWith("/webdav/")) {
      await handleWebDAV(req, res);
      return;
    }
    // Pass everything else to Next.js
    try {
      await handle(req, res);
    } catch (err) {
      console.error("Next.js handler error:", err);
      res.writeHead(500);
      res.end("Internal error");
    }
  });

  server.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT} (WebDAV on /webdav/*)`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
