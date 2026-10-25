import Link from "next/link";
import { getTenantPrisma } from "@/lib/prisma";
import { PaginatedRows } from "@/components/pagination";

const CLASS_LABELS: Record<number, string> = {
  2: "Actif immobilisé",
  3: "Stocks",
  4: "Créances et tiers",
  5: "Trésorerie",
  1: "Capitaux propres et dettes",
};

export default async function BilanPage() {
  const prisma = await getTenantPrisma(process.env.DEFAULT_TENANT_ID!);

  const accounts = await prisma.accountingAccount.findMany({
    where: { class: { in: [1, 2, 3, 4, 5, 6, 7] } },
    orderBy: [{ class: "asc" }, { accountCode: "asc" }],
  });

  const assetsByClass: Record<number, { code: string; label: string; solde: number }[]> = {};
  const liabilities: { code: string; label: string; solde: number }[] = [];
  let totalAssets = 0;
  let totalLiabilitiesBase = 0;
  let totalCharges = 0;
  let totalProducts = 0;

  for (const a of accounts) {
    const solde = Number(a.soldeActuel);
    if (a.class >= 2 && a.class <= 5) {
      (assetsByClass[a.class] ||= []).push({
        code: a.accountCode,
        label: a.label,
        solde,
      });
      totalAssets += solde;
    } else if (a.class === 1) {
      liabilities.push({ code: a.accountCode, label: a.label, solde });
      totalLiabilitiesBase += solde;
    } else if (a.class === 6) {
      totalCharges += solde;
    } else if (a.class === 7) {
      totalProducts += solde;
    }
  }

  const result = totalProducts - totalCharges;
  const totalLiabilities = totalLiabilitiesBase + result;
  const ecart = totalAssets - totalLiabilities;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bilan</h1>
        <Link href="/cabinet/comptabilite" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Actif</h2>
          {Object.entries(assetsByClass)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([classe, items]) => (
              <div key={classe} className="mb-4">
                <h3 className="mb-2 text-sm font-medium text-gray-600">
                  Classe {classe} — {CLASS_LABELS[Number(classe)]}
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    <PaginatedRows colSpan={3}>
                    {items.map((item) => (
                      <tr key={item.code} className="border-b">
                        <td className="py-2 font-mono">{item.code}</td>
                        <td className="py-2">{item.label}</td>
                        <td className="py-2 text-right">{item.solde.toLocaleString("fr-FR")}</td>
                      </tr>
                    ))}
                    </PaginatedRows>
                  </tbody>
                </table>
              </div>
            ))}
          <div className="mt-4 flex justify-between border-t pt-3 font-semibold">
            <span>Total actif</span>
            <span>{totalAssets.toLocaleString("fr-FR")}</span>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Passif</h2>
          {liabilities.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-medium text-gray-600">
                Classe 1 — {CLASS_LABELS[1]}
              </h3>
              <table className="w-full text-sm">
                <tbody>
                  <PaginatedRows colSpan={3}>
                  {liabilities.map((item) => (
                    <tr key={item.code} className="border-b">
                      <td className="py-2 font-mono">{item.code}</td>
                      <td className="py-2">{item.label}</td>
                      <td className="py-2 text-right">{item.solde.toLocaleString("fr-FR")}</td>
                    </tr>
                  ))}
                  </PaginatedRows>
                </tbody>
              </table>
            </div>
          )}
          <div className="mb-2 flex justify-between">
            <span>Résultat de l&apos;exercice</span>
            <span>{result.toLocaleString("fr-FR")}</span>
          </div>
          <div className="mt-4 flex justify-between border-t pt-3 font-semibold">
            <span>Total passif</span>
            <span>{totalLiabilities.toLocaleString("fr-FR")}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex justify-between font-semibold">
          <span>Écart bilan</span>
          <span className={ecart === 0 ? "text-emerald-600" : "text-red-600"}>
            {ecart.toLocaleString("fr-FR")}
          </span>
        </div>
      </div>
    </div>
  );
}
