import { execSync } from "child_process";
import { Prisma } from "@/prisma/generated/public";
import { publicPrisma, getTenantPrisma, buildTenantDatabaseUrl } from "./prisma";
import { hashPassword } from "./auth";

export interface CreateTenantInput {
  slug: string;
  raisonSociale: string;
  adresse?: string;
  identifiantFiscal?: string;
  domaine?: string;
  planId?: string;
  modeAbonnement?: string;
  debutAbonnement?: Date;
  finAbonnement?: Date;
  configuration?: Record<string, unknown>;
}

const SLUG_PATTERN = /^[a-z0-9-]{2,50}$/;
const SCHEMA_PATTERN = /^tenant_[a-z0-9_]{2,60}$/;

export async function createTenant(input: CreateTenantInput) {
  if (!SLUG_PATTERN.test(input.slug)) {
    throw new Error("Slug invalide : lettres minuscules, chiffres et tirets uniquement (2 à 50 caractères)");
  }

  const schemaName = `tenant_${input.slug.replace(/[^a-z0-9_]/gi, "_").toLowerCase()}`;
  if (!SCHEMA_PATTERN.test(schemaName)) {
    throw new Error("Nom de schéma invalide");
  }

  const existing = await publicPrisma.tenant.findFirst({
    where: { OR: [{ slug: input.slug }, { schemaName }] },
    select: { id: true },
  });

  if (existing) {
    throw new Error("Un cabinet avec ce slug existe déjà");
  }

  // Création du schéma PostgreSQL
  await publicPrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

  // Exécution des migrations du modèle tenant
  const databaseUrl = buildTenantDatabaseUrl(schemaName);
  runPrismaMigrate(schemaName, databaseUrl);

  // Enregistrement du tenant
  const tenant = await publicPrisma.tenant.create({
    data: {
      slug: input.slug,
      raisonSociale: input.raisonSociale,
      adresse: input.adresse,
      identifiantFiscal: input.identifiantFiscal,
      domaine: input.domaine,
      planId: input.planId,
      modeAbonnement: input.modeAbonnement,
      debutAbonnement: input.debutAbonnement,
      finAbonnement: input.finAbonnement,
      configuration: input.configuration as Prisma.InputJsonValue | undefined,
      schemaName,
      databaseUrl,
      actif: true,
    },
  });

  return tenant;
}

export async function createTenantWithAdmin(
  input: CreateTenantInput,
  admin: { email: string; prenom: string; nom: string; password: string }
) {
  const tenant = await createTenant(input);
  const tenantPrisma = await getTenantPrisma(tenant.id);

  const role = await tenantPrisma.role.create({
    data: {
      nom: "Administrateur",
      permissions: [],
      estAdmin: true,
      estClient: false,
      niveauConfidentialiteMax: 3,
    },
  });

  const passwordHash = await hashPassword(admin.password);

  await tenantPrisma.user.create({
    data: {
      email: admin.email,
      prenom: admin.prenom,
      nom: admin.nom,
      passwordHash,
      roleId: role.id,
      actif: true,
    },
  });

  return tenant;
}

function runPrismaMigrate(schemaName: string, databaseUrl: string) {
  try {
    execSync(
      `npx prisma db push --schema=./prisma/schema/tenant.prisma --accept-data-loss --skip-generate`,
      {
        env: {
          ...process.env,
          DATABASE_URL_TENANT_TEMPLATE: databaseUrl,
        },
        cwd: process.cwd(),
        stdio: "pipe",
      }
    );
  } catch (e) {
    console.error(`Échec création des tables pour le schéma ${schemaName}`, e);
    throw new Error(`Impossible de créer les tables du schéma ${schemaName}`);
  }
}
