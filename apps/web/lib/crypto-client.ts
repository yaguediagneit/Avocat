export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["wrapKey"]
  );
}

export async function encryptDocumentForUpload(
  file: File,
  publicKeyJwk: JsonWebKey
): Promise<{
  encryptedFile: ArrayBuffer;
  encryptedDek: ArrayBuffer;
  iv: Uint8Array;
}> {
  const fileBuffer = await file.arrayBuffer();

  // Génération de la DEK
  const dek = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "wrapKey"]
  );

  // Chiffrement RSA de la DEK avec la clé publique du tenant
  const publicKey = await importPublicKey(publicKeyJwk);
  const encryptedDek = await crypto.subtle.wrapKey(
    "raw",
    dek,
    publicKey,
    { name: "RSA-OAEP" }
  );

  // Chiffrement du fichier avec la DEK
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedFile = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    dek,
    fileBuffer
  );

  return { encryptedFile, encryptedDek, iv };
}
