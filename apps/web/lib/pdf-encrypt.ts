import { importJWK } from "jose";

export interface EncryptedDocument {
  encryptedFile: Buffer;
  encryptedDek: Buffer;
  iv: Buffer;
}

/**
 * Chiffre un document côté serveur avec AES-GCM + RSA-OAEP,
 * compatible avec le flux de déchiffrement de /api/documents/[id]/download.
 *
 * Utilise Web Crypto API (crypto.subtle) pour être 100% compatible
 * avec le chiffrement client (crypto-client.ts) et le déchiffrement (download route).
 */
export async function encryptDocumentServerSide(
  fileBuffer: Buffer,
  publicKeyJwk: JsonWebKey
): Promise<EncryptedDocument> {
  // 1. Importer la clé publique RSA du tenant
  const publicKey = await importJWK(publicKeyJwk, "RSA-OAEP-256");
  if (!(publicKey instanceof CryptoKey)) {
    throw new Error("Clé publique invalide");
  }

  // 2. Générer la DEK (AES-256-GCM)
  const dek = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "wrapKey"]
  );

  // 3. Wrap la DEK avec la clé publique RSA (RSA-OAEP)
  const encryptedDekBuffer = await crypto.subtle.wrapKey(
    "raw",
    dek,
    publicKey,
    { name: "RSA-OAEP" }
  );

  // 4. Chiffrer le fichier avec AES-GCM (iv 12 bytes, comme crypto-client.ts)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileArrayBuffer = new Uint8Array(fileBuffer).buffer;
  const encryptedFileBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    dek,
    fileArrayBuffer
  );

  return {
    encryptedFile: Buffer.from(encryptedFileBuffer),
    encryptedDek: Buffer.from(encryptedDekBuffer),
    iv: Buffer.from(iv),
  };
}
