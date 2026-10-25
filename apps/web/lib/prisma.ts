import { headers } from "next/headers";
import { PrismaClient as TenantPrismaClient } from "@prisma/client";
import { PrismaClient as PublicPrismaClient } from "@/prisma/generated/public";

function withConnectionLimit(url: string | undefined, limit = 1): string | undefined {
  if (!url) return url;
  if (url.includes("connection_limit")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}connection_limit=${limit}`;
}

const globalForPrisma = globalThis as unknown as {
  publicPrisma?: PublicPrismaClient;
  tenantClients?: Map<string, Promise<TenantPrismaClient>>;
  defaultClient?: Promise<TenantPrismaClient>;
};

export const publicPrisma =
  globalForPrisma.publicPrisma ??
  (globalForPrisma.publicPrisma = new PublicPrismaClient({
    datasources: {
      db: { url: withConnectionLimit(process.env.DATABASE_URL) },
    },
  }));

const tenantClients =
  globalForPrisma.tenantClients ??
  (globalForPrisma.tenantClients = new Map<string, Promise<TenantPrismaClient>>());

export function buildTenantDatabaseUrl(schemaName: string): string {
  const baseUrl = process.env.DATABASE_URL || "";
  if (!baseUrl) return "";

  const qIndex = baseUrl.indexOf("?");
  if (qIndex === -1) {
    return `${baseUrl}?schema=${encodeURIComponent(schemaName)}`;
  }

  const base = baseUrl.slice(0, qIndex);
  const query = baseUrl.slice(qIndex + 1);
  const params = query.split("&").filter((p) => !p.toLowerCase().startsWith("schema="));
  return `${base}?${params.length ? params.join("&") + "&" : ""}schema=${encodeURIComponent(schemaName)}`;
}

export async function getTenantPrisma(tenantId: string): Promise<TenantPrismaClient> {
  let cached = tenantClients.get(tenantId);
  if (!cached) {
    cached = (async () => {
      const tenant = await publicPrisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant || !tenant.actif) {
        throw new Error("Tenant non trouvé ou inactif");
      }

      const databaseUrl =
        tenant.databaseUrl || buildTenantDatabaseUrl(tenant.schemaName);

      return new TenantPrismaClient({
        datasources: {
          db: { url: withConnectionLimit(databaseUrl) },
        },
      });
    })();
    cached.catch(() => tenantClients.delete(tenantId));
    tenantClients.set(tenantId, cached);
  }
  return cached;
}

async function getCurrentPrismaClient(): Promise<TenantPrismaClient> {
  const defaultTenantId = process.env.DEFAULT_TENANT_ID;

  try {
    const h = headers();
    const tenantId = h.get("x-tenant-id") || "";
    if (tenantId) {
      return getTenantPrisma(tenantId);
    }
  } catch (err) {
    // Pendant le prerender statique, Next lève DYNAMIC_SERVER_USAGE pour basculer la
    // page en rendu dynamique : il faut le laisser remonter, sinon la page est
    // prérendue sans tenant et l'erreur « x-tenant-id requis » apparaît au build.
    if ((err as { digest?: string })?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    // headers() non disponible en dehors d'un Server Component ou API route
  }

  if (defaultTenantId) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("x-tenant-id requis en production");
    }
    return getTenantPrisma(defaultTenantId);
  }

  throw new Error("Aucun tenant résolu");
}

function createModelProxy(modelName: string): any {
  return new Proxy({} as any, {
    get(_target, method) {
      return (...args: any[]) =>
        getCurrentPrismaClient().then((client) =>
          (client as any)[modelName][method](...args)
        );
    },
  });
}

export const prisma = new Proxy<TenantPrismaClient>({} as TenantPrismaClient, {
  get(_target, prop) {
    return createModelProxy(prop as string);
  },
});
