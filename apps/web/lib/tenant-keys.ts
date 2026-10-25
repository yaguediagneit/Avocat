import { generateKeyPair, exportJWK, exportPKCS8, exportSPKI } from "jose";
import { publicPrisma } from "./prisma";

export async function getOrCreateTenantKeys(tenantId: string) {
  let key = await publicPrisma.tenantKey.findFirst({
    where: { tenantId },
  });

  if (key) {
    return {
      publicKey: key.publicKey,
      encryptedPrivateKey: key.encryptedPrivateKey,
    };
  }

  const { publicKey, privateKey } = await generateKeyPair("RSA-OAEP-256", {
    extractable: true,
    modulusLength: 4096,
  });

  const publicJwk = await exportJWK(publicKey);
  const privatePkcs8 = await exportPKCS8(privateKey);

  // TODO: chiffrer la clé privée avec le master key du serveur
  const encryptedPrivateKey = Buffer.from(privatePkcs8).toString("base64");

  key = await publicPrisma.tenantKey.create({
    data: {
      tenantId,
      publicKey: JSON.stringify(publicJwk),
      encryptedPrivateKey,
    },
  });

  return {
    publicKey: key.publicKey,
    encryptedPrivateKey: key.encryptedPrivateKey,
  };
}
