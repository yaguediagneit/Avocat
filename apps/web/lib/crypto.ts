import { randomBytes, createCipheriv, createDecipheriv, publicEncrypt, privateDecrypt } from "crypto";

export function generateDocumentKey(): Buffer {
  return randomBytes(32);
}

export function encryptBuffer(buffer: Buffer, key: Buffer): { iv: Buffer; encrypted: Buffer; authTag: Buffer } {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { iv, encrypted, authTag };
}

export function decryptBuffer(encrypted: Buffer, key: Buffer, iv: Buffer, authTag: Buffer): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function encryptDek(dek: Buffer, publicKey: string): Buffer {
  return publicEncrypt(publicKey, dek);
}

export function decryptDek(encryptedDek: Buffer, privateKey: string): Buffer {
  return privateDecrypt(privateKey, encryptedDek);
}
