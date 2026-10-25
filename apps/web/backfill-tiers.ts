// ============================================================
// backfill-tiers.ts
// Rétro-action : pour les écritures existantes, associe chaque
// ligne à son tiers et déplace le montant vers le compte
// auxiliaire détaillé du tiers (ex. 42201 pour un employé).
// Exécution :
//   node node_modules/tsx/dist/cli.mjs backfill-tiers.ts
//   (avec DEFAULT_TENANT_ID et DATABASE_URL définis)
// ============================================================
import { getTenantPrisma } from "./lib/prisma";
import { chargeAuxiliaryLabel, ensureTiersAccount } from "./lib/tiers";

const PASSIF_PRODUIT_TYPES = new Set(["PASSIF", "PRODUIT", "ACTIF/PASSIF", "CAPITAU"]);

function signedDelta(accountType: string, debit: number, credit: number) {
  return PASSIF_PRODUIT_TYPES.has(accountType) ? credit - debit : debit - credit;
}

async function resolveTiersLabel(
  prisma: any,
  type: string,
  id: string
): Promise<string | null> {
  switch (type) {
    case "client": {
      const c = await prisma.client.findUnique({
        where: { id },
        select: { raisonSociale: true },
      });
      return c?.raisonSociale ?? null;
    }
    case "employe": {
      const e = await prisma.employee.findUnique({
        where: { id },
        select: { firstName: true, lastName: true },
      });
      return e ? `${e.firstName} ${e.lastName}` : null;
    }
    case "collaborateur": {
      const u = await prisma.user.findUnique({
        where: { id },
        select: { titre: true, prenom: true, nom: true },
      });
      return u ? [u.titre, u.prenom, u.nom].filter(Boolean).join(" ") : null;
    }
    case "fournisseur":
      return id;
    case "charge": {
      const ch = await prisma.charge.findUnique({
        where: { id },
        include: { category: true },
      });
      return ch
        ? chargeAuxiliaryLabel(ch.category?.label ?? "Charge", ch.supplierName, ch.description)
        : null;
    }
    default:
      return null;
  }
}

async function tiersAccountFor(prisma: any, type: string, id: string): Promise<any | null> {
  const label = await resolveTiersLabel(prisma, type, id);
  if (!label) return null;

  const extra: string[] = [];
  if (type === "charge") {
    const ch = await prisma.charge.findUnique({
      where: { id },
      include: { category: true },
    });
    if (ch?.category?.accountCode) extra.push(ch.category.accountCode);
  }

  const code = await ensureTiersAccount(prisma, type as any, label, extra);
  if (!code) return null;
  return prisma.accountingAccount.findUnique({ where: { accountCode: code } });
}

async function attachTiers(
  prisma: any,
  line: any,
  type: string,
  id: string | null
): Promise<0 | 1 | 2> {
  if (!id) return 0;

  const updates: Record<string, any> = {
    thirdPartyType: type,
    thirdPartyId: id,
  };

  // Déplacer vers le compte auxiliaire seulement si le compte de la
  // ligne est le compte parent (ex. 422 → 42201). Un compte de
  // trésorerie ou de TVA n'est jamais déplacé.
  const aux = await tiersAccountFor(prisma, type, id);
  if (aux && aux.id !== line.accountId && aux.accountCode.startsWith(line.account.accountCode)) {
    const delta = signedDelta(line.account.accountType, line.debit, line.credit);
    await prisma.accountingAccount.update({
      where: { id: line.accountId },
      data: { soldeActuel: { decrement: delta } },
    });
    await prisma.accountingAccount.update({
      where: { id: aux.id },
      data: { soldeActuel: { increment: delta } },
    });
    updates.accountId = aux.id;
  }

  await prisma.accountingEntryLine.update({
    where: { id: line.id },
    data: updates,
  });
  return updates.accountId ? 2 : 1;
}

async function main() {
  const prisma = await getTenantPrisma(process.env.DEFAULT_TENANT_ID!);
  const entries = await prisma.accountingEntry.findMany({
    include: { lines: { include: { account: true } } },
    orderBy: { entryDate: "asc" },
  });

  let tagged = 0;
  let moved = 0;

  for (const e of entries) {
    const [payrollLinked, facture, paiement, charge] = await Promise.all([
      prisma.payroll.findFirst({
        where: { accountingEntryId: e.id },
        include: { employee: true },
      }),
      prisma.facture.findFirst({
        where: { accountingEntryId: e.id },
        include: { client: true },
      }),
      prisma.paiement.findFirst({
        where: { accountingEntryId: e.id },
        include: { facture: { include: { client: true } } },
      }),
      prisma.charge.findFirst({
        where: { accountingEntryId: e.id },
        include: { category: true },
      }),
    ]);

    let payroll = payrollLinked;
    if (!payroll && e.idempotencyKey?.startsWith("payroll-settlement-")) {
      payroll = await prisma.payroll.findUnique({
        where: { id: e.idempotencyKey.slice("payroll-settlement-".length) },
        include: { employee: true },
      });
    }

    const client = facture?.client ?? paiement?.facture?.client ?? null;

    for (const l of e.lines) {
      const code = String(l.account?.accountCode ?? "");
      const cls = Number(l.account?.class ?? 0);

      let result: 0 | 1 | 2 = 0;
      if (l.thirdPartyType && l.thirdPartyId) {
        result = await attachTiers(prisma, l, l.thirdPartyType, l.thirdPartyId);
      } else if (payroll && code.startsWith("422")) {
        result = await attachTiers(prisma, l, "employe", payroll.employeeId);
      } else if (payroll && cls === 5) {
        result = await attachTiers(prisma, l, "employe", payroll.employeeId);
      } else if (client) {
        result = await attachTiers(prisma, l, "client", client.id);
      } else if (charge && cls === 6) {
        result = await attachTiers(prisma, l, "charge", charge.id);
      } else if (charge && cls === 5 && charge.supplierName) {
        await ensureTiersAccount(prisma, "fournisseur", charge.supplierName);
        result = await attachTiers(prisma, l, "fournisseur", charge.supplierName);
      } else if (charge) {
        result = await attachTiers(prisma, l, "charge", charge.id);
      }

      if (result) tagged++;
      if (result === 2) moved++;
    }
  }

  console.log(`Rétro-action terminée : ${tagged} ligne(s) identifiées, ${moved} compte(s) déplacé(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => process.exit(0));
