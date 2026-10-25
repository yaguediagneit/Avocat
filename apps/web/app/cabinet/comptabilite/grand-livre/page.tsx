import Link from "next/link";
import { getTenantPrisma } from "@/lib/prisma";
import { listTiers, tiersMapOf } from "@/lib/tiers";
import { PaginatedRows } from "@/components/pagination";

const PASSIF_PRODUIT_TYPES = new Set(["PASSIF", "PRODUIT", "ACTIF/PASSIF", "CAPITAU"]);

function signedLine(accountType: string, debit: number, credit: number) {
  return PASSIF_PRODUIT_TYPES.has(accountType) ? credit - debit : debit - credit;
}

export default async function GrandLivrePage({
  searchParams,
}: {
  searchParams: { accountId?: string; start?: string; end?: string };
}) {
  const tenantId = process.env.DEFAULT_TENANT_ID!;
  const prisma = await getTenantPrisma(tenantId);

  const accounts = await prisma.accountingAccount.findMany({
    where: { isActive: true },
    orderBy: [{ class: "asc" }, { accountCode: "asc" }],
    take: 2000,
  });

  const accountId = searchParams.accountId;
  const startDate = searchParams.start ? new Date(searchParams.start) : undefined;
  const endDate = searchParams.end ? new Date(searchParams.end) : undefined;

  let account = null;
  let lines: any[] = [];
  let openingBalance = 0;
  const tiers = await listTiers(prisma);
  const tiersMap = tiersMapOf(tiers);

  if (accountId) {
    account = await prisma.accountingAccount.findUnique({
      where: { id: accountId },
    });

    if (account) {
      const dateFilter: any = {};
      if (startDate) dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;

      const rangeWhere: any = { accountId, tenantId };
      if (Object.keys(dateFilter).length) {
        rangeWhere.entry = { entryDate: dateFilter };
      }

      const [rangeLines, beforeLines] = await Promise.all([
        prisma.accountingEntryLine.findMany({
          where: rangeWhere,
          include: { entry: true },
          orderBy: { entry: { entryDate: "asc" } },
        }),
        startDate
          ? prisma.accountingEntryLine.findMany({
              where: {
                tenantId,
                accountId,
                entry: { entryDate: { lt: startDate } },
              },
              select: { debit: true, credit: true },
            })
          : Promise.resolve([] as any[]),
      ]);

      openingBalance = Number(account.soldeInitial);
      for (const l of beforeLines) {
        openingBalance += signedLine(account.accountType, Number(l.debit), Number(l.credit));
      }

      lines = rangeLines;
    }
  }

  let running = openingBalance;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Grand-livre</h1>
        <Link href="/cabinet/comptabilite" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>

      <form className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium">Compte</label>
          <select name="accountId" defaultValue={accountId ?? ""} className="input w-full" required>
            <option value="">Sélectionner un compte</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.accountCode} - {a.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Date début</label>
          <input type="date" name="start" defaultValue={searchParams.start ?? ""} className="input w-full" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Date fin</label>
          <input type="date" name="end" defaultValue={searchParams.end ?? ""} className="input w-full" />
        </div>
        <button type="submit" className="btn-primary">
          Afficher
        </button>
      </form>

      {account && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              {account.accountCode} - {account.label}
            </h2>
            <p className="text-sm text-gray-600">
              Solde initial : {openingBalance.toLocaleString("fr-FR")} / Type : {account.accountType}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cabinet-100 text-cabinet-900">
                <tr>
                  <th className="px-2 py-3 text-xs whitespace-nowrap">Date</th>
                  <th className="px-2 py-3 text-xs whitespace-nowrap">Réf.</th>
                  <th className="px-2 py-3 text-xs whitespace-nowrap">Libellé</th>
                  <th className="px-2 py-3 text-xs whitespace-nowrap">Tiers</th>
                  <th className="px-2 py-3 text-right text-xs whitespace-nowrap">Débit</th>
                  <th className="px-2 py-3 text-right text-xs whitespace-nowrap">Crédit</th>
                  <th className="px-2 py-3 text-right text-xs whitespace-nowrap">Solde</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-6 text-center text-gray-500">
                      Aucune écriture pour ce compte sur la période.
                    </td>
                  </tr>
                )}
                <PaginatedRows colSpan={7}>
                {(() => {
                let balance = openingBalance;
                return lines.map((l) => {
                  const signed = signedLine(account.accountType, Number(l.debit), Number(l.credit));
                  balance += signed;
                  return (
                    <tr key={l.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {new Date(l.entry.entryDate).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3">{l.entry.reference || "—"}</td>
                      <td className="px-4 py-3">{l.libelle || l.entry.libelle}</td>
                      <td className="px-4 py-3">
                        {l.thirdPartyType && l.thirdPartyId
                          ? tiersMap.get(`${l.thirdPartyType}:${l.thirdPartyId}`) ?? l.thirdPartyId
                          : account.class === 4
                            ? account.label
                            : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">{Number(l.debit).toLocaleString("fr-FR")}</td>
                      <td className="px-4 py-3 text-right">{Number(l.credit).toLocaleString("fr-FR")}</td>
                      <td className="px-4 py-3 text-right font-medium">{balance.toLocaleString("fr-FR")}</td>
                    </tr>
                  );
                });
              })()}
              </PaginatedRows>
            </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
