import { PrismaClient } from "@prisma/client";
import { publicPrisma, buildTenantDatabaseUrl } from "./prisma";

interface TenantClient {
  tenantId: string;
  prisma: PrismaClient;
}

const clients = new Map<string, PrismaClient>();

export async function getTenantClient(tenantId: string): Promise<PrismaClient> {
  if (clients.has(tenantId)) {
    return clients.get(tenantId)!;
  }

  const tenant = await publicPrisma.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant || !tenant.actif) {
    throw new Error("Tenant non trouvé ou inactif");
  }

  const databaseUrl =
    tenant.databaseUrl || buildTenantDatabaseUrl(tenant.schemaName);

  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });

  clients.set(tenantId, prisma);
  return prisma;
}

export async function createTenantSchema(
  tenantId: string,
  slug: string
): Promise<string> {
  const schemaName = `tenant_${slug.replace(/[^a-z0-9_]/gi, "_").toLowerCase()}`;

  const tenant = await publicPrisma.tenant.create({
    data: {
      id: tenantId,
      slug,
      raisonSociale: slug,
      schemaName,
    },
  });

  // TODO: exécuter les migrations Prisma sur le schéma du tenant
  // npx prisma migrate dev --schema=./prisma/schema/tenant.prisma
  // avec DATABASE_URL_TENANT_TEMPLATE pointant sur schema=schemaName

  return schemaName;
}

export { getTenantUrl } from "./tenant-url";

export async function getTenantIdFromHost(host: string): Promise<string | null> {
  const match = host.match(/^([a-z0-9-]+)\./i);
  if (!match) return process.env.DEFAULT_TENANT_ID || null;

  const slug = match[1].toLowerCase();
  if (["localhost", "127", "0"].includes(slug)) {
    return process.env.DEFAULT_TENANT_ID || null;
  }

  const tenant = await publicPrisma.tenant.findUnique({ where: { slug } });
  if (tenant?.actif) return tenant.id;
  return process.env.DEFAULT_TENANT_ID || null;
}
