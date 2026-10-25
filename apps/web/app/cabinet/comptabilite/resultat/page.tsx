import Link from "next/link";
import { getTenantPrisma } from "@/lib/prisma";
import { PaginatedRows } from "@/components/pagination";

export default async function ResultatPage() {
  const prisma = await getTenantPrisma(process.env.DEFAULT_TENANT_ID!);

  const accounts = await prisma.accountingAccount.findMany({
    where: { class: { in: [6, 7] } },
    orderBy: [{ class: "asc" }, { accountCode: "asc" }],
  });

  const charges = accounts.filter((a) => a.class === 6);
  const products = accounts.filter((a) => a.class === 7);
  const totalCharges = charges.reduce((sum, a) => sum + Number(a.soldeActuel), 0);
  const totalProducts = products.reduce((sum, a) => sum + Number(a.soldeActuel), 0);
  const result = totalProducts - totalCharges;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Compte de résultat</h1>
        <Link href="/cabinet/comptabilite" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total charges</p>
          <p className="text-2xl font-bold text-red-700">{totalCharges.toLocaleString("fr-FR")}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total produits</p>
          <p className="text-2xl font-bold text-emerald-700">{totalProducts.toLocaleString("fr-FR")}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Résultat</p>
          <p className={`text-2xl font-bold ${result >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {result.toLocaleString("fr-FR")}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Charges (classe 6)</h2>
          <table className="w-full text-sm">
            <tbody>
              <PaginatedRows colSpan={3}>
              {charges.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2 font-mono">{a.accountCode}</td>
                  <td className="py-2">{a.label}</td>
                  <td className="py-2 text-right">{Number(a.soldeActuel).toLocaleString("fr-FR")}</td>
                </tr>
              ))}
              </PaginatedRows>
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Produits (classe 7)</h2>
          <table className="w-full text-sm">
            <tbody>
              <PaginatedRows colSpan={3}>
              {products.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2 font-mono">{a.accountCode}</td>
                  <td className="py-2">{a.label}</td>
                  <td className="py-2 text-right">{Number(a.soldeActuel).toLocaleString("fr-FR")}</td>
                </tr>
              ))}
              </PaginatedRows>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
