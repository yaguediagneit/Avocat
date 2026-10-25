import Link from "next/link";
import { getTenantPrisma } from "@/lib/prisma";
import { listTiers, TIERS_TYPES, type TiersItem } from "@/lib/tiers";
import { PaginatedRows } from "@/components/pagination";

export default async function TiersPage() {
  const prisma = await getTenantPrisma(process.env.DEFAULT_TENANT_ID!);
  const tiers = await listTiers(prisma);

  const byType = new Map<string, TiersItem[]>();
  for (const t of tiers) {
    if (!byType.has(t.type)) byType.set(t.type, []);
    byType.get(t.type)!.push(t);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Comptes Tiers</h1>
        <Link href="/cabinet/comptabilite" className="text-sm text-cabinet-700 hover:underline">
          ← Retour à la comptabilité
        </Link>
      </div>
      <p className="text-sm text-gray-500">
        Tiers utilisables dans les écritures comptables pour identifier les paiements
        (fournisseurs, clients, employés, collaborateurs externes…).
      </p>

      <div className="space-y-6">
        {TIERS_TYPES.map((type) => {
          const items = byType.get(type.value) ?? [];
          return (
            <section key={type.value} className="card overflow-hidden p-0">
              <h2 className="border-b border-gray-100 bg-cabinet-100 px-4 py-3 text-sm font-semibold text-cabinet-900">
                {type.label} <span className="ml-1 text-xs font-normal text-gray-500">({items.length})</span>
              </h2>
              <table className="w-full text-left text-sm">
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-4 text-center text-gray-400">
                        Aucun tiers
                      </td>
                    </tr>
                  )}
                  <PaginatedRows colSpan={2}>
                  {items.map((t) => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                        {t.accountCode || "—"}
                      </td>
                      <td className="px-4 py-2.5">{t.label}</td>
                    </tr>
                  ))}
                  </PaginatedRows>
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
