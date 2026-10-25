import { getTenantPrisma, publicPrisma } from "./lib/prisma";
import { hashPassword } from "./lib/auth";

async function main() {
  const prismaClient = await getTenantPrisma(process.env.DEFAULT_TENANT_ID!);

  const clientRole = await prismaClient.role.findUnique({
    where: { nom: "Client" },
  });

  if (!clientRole) {
    throw new Error("Rôle Client non trouvé");
  }

  const existing = await prismaClient.user.findUnique({
    where: { email: "client@cabinet.sn" },
  });

  if (!existing) {
    await prismaClient.user.create({
      data: {
        email: "client@cabinet.sn",
        passwordHash: await hashPassword("Client1234!"),
        prenom: "Client",
        nom: "Test",
        roleId: clientRole.id,
        mfaEnabled: false,
        actif: true,
      },
    });
    console.log("Utilisateur client créé : client@cabinet.sn / Client1234!");
  } else {
    console.log("Utilisateur client existe déjà");
  }

  const clientEntry = await prismaClient.client.findFirst({
    where: { raisonSociale: "Client Test" },
  });

  if (!clientEntry) {
    await prismaClient.client.create({
      data: {
        type: "physique",
        raisonSociale: "Client Test",
        coordonnees: { email: "client@cabinet.sn", telephone: "77 123 45 67" },
      },
    });
    console.log("Client créé");
  } else {
    console.log("Client existe déjà");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await publicPrisma.$disconnect();
  });
