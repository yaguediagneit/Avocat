import { PrismaClient } from "@prisma/client";
import { ensureAuxiliaryAccount, chargeAuxiliaryLabel, ensureTiersAccount } from "./tiers";
import {
  amortissementAccountCandidates,
  dotationAccountCandidates,
  formatPeriode,
} from "./immobilisation";

const PASSIF_PRODUIT_TYPES = new Set(["PASSIF", "PRODUIT", "ACTIF/PASSIF", "CAPITAU"]);

/// Résout (ou crée) le compte auxiliaire du tiers sous le compte parent
/// (ex. 41101 "Abdou Diouf" sous 411).
async function resolveTiersAccount(prisma: any, parentAccount: any, tiersLabel?: string | null) {
  if (!tiersLabel) return parentAccount;
  const code = await ensureAuxiliaryAccount(prisma, [parentAccount.accountCode], tiersLabel);
  if (!code) return parentAccount;
  const account = await prisma.accountingAccount.findUnique({ where: { accountCode: code } });
  return account || parentAccount;
}

export interface AccountingLineInput {
  accountId: string;
  debit: number;
  credit: number;
  libelle?: string;
  /// Compte tiers associé à la ligne (ex. "client", "fournisseur",
  /// "employe", "collaborateur", "charge").
  thirdPartyType?: string | null;
  thirdPartyId?: string | null;
}

// ============================================================
// MAPPING DE COMPTES CONFIGURABLE
// Codes de mapping utilisés par les automatisations.
// Si aucun AccountMapping n'existe en base, on retombe sur les
// valeurs par défaut du Syscohada.
// ============================================================
const DEFAULT_MAPPINGS: Record<string, { accountCode: string; journalCode: string }> = {
  // Trésorerie
  CASH: { accountCode: "57", journalCode: "CAI" },
  BANK: { accountCode: "52", journalCode: "BAN" },
  // Produits / ventes
  REVENUE_SERVICES: { accountCode: "706", journalCode: "VEN" },
  TVA_COLLECTED: { accountCode: "443", journalCode: "TVA" },
  CUSTOMER_RECEIVABLE: { accountCode: "411", journalCode: "VEN" },
  // Charges
  TVA_RECOVERABLE: { accountCode: "445", journalCode: "TVA" },
  SUPPLIER_PAYABLE: { accountCode: "401", journalCode: "ACH" },
  SUPPLIER_ADVANCE: { accountCode: "409", journalCode: "ACH" },
  // Immobilisations / amortissements
  AMORTIZATION_EXPENSE: { accountCode: "6813", journalCode: "OD" },
  AMORTIZATION_CUMULATED: { accountCode: "28", journalCode: "OD" },
  // Paie
  DIRECT_REMUNERATION: { accountCode: "661", journalCode: "SAL" },
  SOCIAL_CHARGES: { accountCode: "664", journalCode: "SAL" },
  CNSS_PAYABLE: { accountCode: "4311", journalCode: "SAL" },
  IPRES_PAYABLE: { accountCode: "4313", journalCode: "SAL" },
  TAX_WITHHELD: { accountCode: "447", journalCode: "SAL" },
  OTHER_DEDUCTIONS: { accountCode: "423", journalCode: "SAL" },
  SALARIES_PAYABLE: { accountCode: "422", journalCode: "SAL" },
};

async function getMapping(prisma: any, code: string) {
  const mapping = await prisma.accountMapping.findUnique({ where: { code } });
  if (mapping && mapping.isActive) {
    return {
      accountCode: mapping.accountCode,
      journalCode: mapping.journalCode || DEFAULT_MAPPINGS[code]?.journalCode || "OD",
    };
  }
  return DEFAULT_MAPPINGS[code] || { accountCode: "", journalCode: "OD" };
}

async function resolveAccount(prisma: any, accountCode: string) {
  const account = await prisma.accountingAccount.findUnique({ where: { accountCode } });
  if (!account) throw new Error(`Compte comptable ${accountCode} non trouvé`);
  return account;
}

/// Résout le premier compte existant parmi une liste de codes candidats
/// (du plus précis au plus général).
async function resolveFirstAccount(prisma: any, accountCodes: string[]) {
  for (const code of accountCodes) {
    if (!code) continue;
    const account = await prisma.accountingAccount.findUnique({ where: { accountCode: code } });
    if (account) return account;
  }
  throw new Error(`Aucun compte comptable trouvé parmi : ${accountCodes.join(", ")}`);
}

async function resolveJournal(prisma: any, journalCode: string) {
  const journal = await prisma.accountingJournal.findFirst({ where: { code: journalCode } });
  if (!journal) {
    // Fallback: try TRE then OD
    const fallback = await prisma.accountingJournal.findFirst({ where: { code: "OD" } });
    if (!fallback) throw new Error(`Journal ${journalCode} non trouvé et pas de fallback OD`);
    return fallback;
  }
  return journal;
}

async function getOpenExercise(prisma: any) {
  const exercise = await prisma.accountingExercise.findFirst({
    where: { isClosed: false },
    orderBy: { year: "desc" },
  });
  if (!exercise) throw new Error("Aucun exercice comptable ouvert");
  return exercise;
}

// ============================================================
// CRÉATION D'ÉCRITURE AVEC IDEMPOTENCE
// Si idempotencyKey est fourni et qu'une écriture existe déjà
// avec cette clé, on retourne l'écriture existante sans en
// créer une nouvelle. Cela garantit qu'un même événement
// métier ne génère jamais deux écritures.
// ============================================================
export async function createAccountingEntry(
  prisma: any,
  {
    tenantId,
    journalId,
    exerciseId,
    entryDate,
    reference,
    libelle,
    lines,
    createdBy,
    idempotencyKey,
  }: {
    tenantId: string;
    journalId: string;
    exerciseId: string;
    entryDate: Date;
    reference?: string | null;
    libelle: string;
    lines: AccountingLineInput[];
    createdBy?: string | null;
    idempotencyKey?: string | null;
  }
) {
  if (!tenantId) throw new Error("tenantId requis pour créer une écriture");

  // --- Idempotence : si la clé existe, on retourne l'existante ---
  if (idempotencyKey) {
    const existing = await prisma.accountingEntry.findUnique({
      where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      include: { journal: true, lines: { include: { account: true } } },
    });
    if (existing) return existing;
  }

  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `L'écriture n'est pas équilibrée (débit=${totalDebit}, crédit=${totalCredit}).`
    );
  }

  const accounts = await prisma.accountingAccount.findMany({
    where: { id: { in: lines.map((l) => l.accountId) } },
  });
  const accountMap: Map<string, any> = new Map(accounts.map((a: any) => [a.id, a]));

  const entry = await prisma.accountingEntry.create({
    data: {
      tenantId,
      journalId,
      exerciseId,
      entryDate,
      reference,
      idempotencyKey,
      libelle,
      totalDebit,
      totalCredit,
      createdBy,
    },
  });

  for (const l of lines) {
    await prisma.accountingEntryLine.create({
      data: {
        tenantId,
        entryId: entry.id,
        accountId: l.accountId,
        debit: l.debit || 0,
        credit: l.credit || 0,
        libelle: l.libelle,
        thirdPartyType: l.thirdPartyType || null,
        thirdPartyId: l.thirdPartyId || null,
      },
    });

    const account = accountMap.get(l.accountId);
    if (account) {
      const signedAmount = PASSIF_PRODUIT_TYPES.has(account.accountType)
        ? (l.credit || 0) - (l.debit || 0)
        : (l.debit || 0) - (l.credit || 0);
      await prisma.accountingAccount.update({
        where: { id: l.accountId },
        data: { soldeActuel: { increment: signedAmount } },
      });
    }
  }

  return prisma.accountingEntry.findUnique({
    where: { id: entry.id },
    include: { journal: true, lines: { include: { account: true } } },
  });
}

// ============================================================
// 1. ÉMISSION DE FACTURE (journal VEN)
// D 411 Client (créance) pour le TTC
// C 706 Prestations pour le HT
// C 443 TVA collectée pour la TVA (si applicable)
// ============================================================
export async function createEntryFromInvoiceIssuance(
  prisma: any,
  tenantId: string,
  facture: {
    id: string;
    numero: string;
    totalHt: number;
    totalTva: number;
    totalTtc: number;
    tvaEnabled: boolean;
    dateEmission: Date;
    clientId?: string | null;
  },
  userId: string | null
) {
  const mapping = await getMapping(prisma, "REVENUE_SERVICES");
  const journal = await resolveJournal(prisma, mapping.journalCode);
  const exercise = await getOpenExercise(prisma);

  const totalHt = Number(facture.totalHt) || 0;
  const totalTva = Number(facture.totalTva) || 0;
  const totalTtc = Number(facture.totalTtc) || 0;
  const tvaEnabled = facture.tvaEnabled && totalTva > 0;

  const [revenueAccount, receivableAccount, tvaAccount] = await Promise.all([
    resolveAccount(prisma, mapping.accountCode),
    resolveAccount(prisma, DEFAULT_MAPPINGS.CUSTOMER_RECEIVABLE.accountCode),
    tvaEnabled
      ? resolveAccount(prisma, DEFAULT_MAPPINGS.TVA_COLLECTED.accountCode)
      : Promise.resolve(null),
  ]);

  const client = facture.clientId
    ? await prisma.client.findUnique({
        where: { id: facture.clientId },
        select: { raisonSociale: true },
      })
    : null;
  const clientReceivableAccount = client
    ? await resolveTiersAccount(prisma, receivableAccount, client.raisonSociale)
    : receivableAccount;

  const lines: AccountingLineInput[] = [
    {
      accountId: clientReceivableAccount.id,
      debit: totalTtc,
      credit: 0,
      libelle: `Facture ${facture.numero} — Client`,
      thirdPartyType: "client",
      thirdPartyId: facture.clientId || null,
    },
    {
      accountId: revenueAccount.id,
      debit: 0,
      credit: totalHt,
      libelle: `Prestations facturées`,
    },
  ];

  if (tvaEnabled && tvaAccount) {
    lines.push({
      accountId: tvaAccount.id,
      debit: 0,
      credit: totalTva,
      libelle: "TVA collectée",
    });
  }

  const entry = await createAccountingEntry(prisma, {
    tenantId,
    journalId: journal.id,
    exerciseId: exercise.id,
    entryDate: new Date(facture.dateEmission),
    reference: `FAC-${facture.numero}`,
    idempotencyKey: `invoice-issue-${facture.id}`,
    libelle: `Émission facture ${facture.numero}`,
    createdBy: userId,
    lines,
  });

  // Lier l'écriture à la facture
  await prisma.facture.update({
    where: { id: facture.id },
    data: { accountingEntryId: entry.id },
  });

  return entry;
}

// ============================================================
// 2. ENCAISSEMENT DE FACTURE (journal TRE/BAN/CAI)
// D 57/52 Trésorerie pour le montant encaissé
// C 411 Client (extinction de la créance) pour le HT+TVA
//   — ou C 706 + 443 si la facture n'avait pas d'écriture d'émission
// ============================================================
export async function createEntryFromPayment(
  prisma: any,
  tenantId: string,
  payment: {
    id: string;
    factureId: string;
    montant: number;
    mode: string;
    datePaiement: Date;
    reference?: string | null;
  },
  facture: {
    id: string;
    numero?: string | null;
    totalHt: number;
    totalTva: number;
    totalTtc: number;
    tvaEnabled: boolean;
    accountingEntryId?: string | null;
    clientId?: string | null;
  },
  userId: string | null
) {
  const isCash = payment.mode === "especes";
  const treasuryMapping = await getMapping(prisma, isCash ? "CASH" : "BANK");
  const journal = await resolveJournal(prisma, treasuryMapping.journalCode);
  const exercise = await getOpenExercise(prisma);

  const amount = Number(payment.montant);
  const totalTtc = Number(facture.totalTtc) || 0;
  const totalHt = Number(facture.totalHt) || 0;
  const totalTva = Number(facture.totalTva) || 0;
  const hasIssuanceEntry = !!facture.accountingEntryId;

  const cashAccount = await resolveAccount(prisma, treasuryMapping.accountCode);

  const lines: AccountingLineInput[] = [
    {
      accountId: cashAccount.id,
      debit: amount,
      credit: 0,
      libelle: "Encaissement",
    },
  ];

  if (hasIssuanceEntry) {
    // Extinction de la créance client
    const receivableAccount = await resolveAccount(
      prisma,
      DEFAULT_MAPPINGS.CUSTOMER_RECEIVABLE.accountCode
    );
    const client = facture.clientId
      ? await prisma.client.findUnique({
          where: { id: facture.clientId },
          select: { raisonSociale: true },
        })
      : null;
    const clientReceivableAccount = client
      ? await resolveTiersAccount(prisma, receivableAccount, client.raisonSociale)
      : receivableAccount;
    lines.push({
      accountId: clientReceivableAccount.id,
      debit: 0,
      credit: amount,
      libelle: `Règlement facture ${facture.numero || payment.factureId.slice(-6)}`,
      thirdPartyType: "client",
      thirdPartyId: facture.clientId || null,
    });
  } else {
    // Pas d'écriture d'émission : on enregistre directement en produits + TVA
    const revenueMapping = await getMapping(prisma, "REVENUE_SERVICES");
    const revenueAccount = await resolveAccount(prisma, revenueMapping.accountCode);
    const tvaEnabled = facture.tvaEnabled && totalTva > 0 && totalTtc > 0;

    if (tvaEnabled) {
      const ratio = totalTtc > 0 ? amount / totalTtc : 1;
      const htPortion = Math.round(totalHt * ratio * 100) / 100;
      const tvaPortion = Math.round((amount - htPortion) * 100) / 100;
      lines.push({
        accountId: revenueAccount.id,
        debit: 0,
        credit: htPortion,
        libelle: "Prestations",
        thirdPartyType: "client",
        thirdPartyId: facture.clientId || null,
      });
      if (tvaPortion > 0) {
        const tvaAccount = await resolveAccount(
          prisma,
          DEFAULT_MAPPINGS.TVA_COLLECTED.accountCode
        );
        lines.push({
          accountId: tvaAccount.id,
          debit: 0,
          credit: tvaPortion,
          libelle: "TVA collectée",
        });
      }
    } else {
      lines.push({
        accountId: revenueAccount.id,
        debit: 0,
        credit: amount,
        libelle: "Prestations",
        thirdPartyType: "client",
        thirdPartyId: facture.clientId || null,
      });
    }
  }

  const entry = await createAccountingEntry(prisma, {
    tenantId,
    journalId: journal.id,
    exerciseId: exercise.id,
    entryDate: new Date(payment.datePaiement),
    reference: payment.reference || `PAY-${payment.id.slice(-6)}`,
    idempotencyKey: `payment-${payment.id}`,
    libelle: `Encaissement facture ${facture.numero || payment.factureId.slice(-6)}`,
    createdBy: userId,
    lines,
  });

  // Lier l'écriture au paiement
  await prisma.paiement.update({
    where: { id: payment.id },
    data: { accountingEntryId: entry.id },
  });

  return entry;
}

// ============================================================
// 3. CHARGE / DÉPENSE (journal OD ou ACH)
// D 6xx Compte de charge (selon catégorie) pour le HT
// D 445 TVA récupérable (si applicable)
// C 57/52 Trésorerie pour le TTC
//
// Cas d'une immobilisation amortie (charge.isImmobilisation) : le bien n'est pas
// passé en charge mais inscrit à l'actif, le HT est donc débité au compte de
// classe 2 (`immobilisationAccountCode`). La charge est ensuite étalée par les
// dotations mensuelles (voir createEntryFromAmortissement).
// ============================================================
export async function createEntryFromCharge(
  prisma: any,
  tenantId: string,
  charge: {
    id: string;
    amount: number;
    totalHt: number | null;
    taxAmount: number | null;
    tvaEnabled: boolean;
    paymentMethod: string;
    chargeDate: Date;
    description: string | null;
    supplierName: string | null;
    supplierInvoiceRef: string | null;
    isImmobilisation?: boolean;
    immobilisationAccountCode?: string | null;
    metadata?: any;
  },
  category: { accountCode: string | null; label: string },
  userId: string | null
) {
  const isCash = charge.paymentMethod === "especes";
  const treasuryMapping = await getMapping(prisma, isCash ? "CASH" : "BANK");
  const journal = await resolveJournal(prisma, "OD");
  const exercise = await getOpenExercise(prisma);

  const amount = Number(charge.amount);
  const totalHt = charge.totalHt ?? amount;
  const taxAmount = charge.taxAmount || 0;
  const tvaEnabled = !!charge.tvaEnabled && taxAmount > 0;
  const isImmobilisation = !!charge.isImmobilisation;
  const metadata = (charge.metadata || {}) as { taxMode?: string; netAmount?: number };
  const isWithholding = metadata.taxMode === "prelevement_impots" && !tvaEnabled && taxAmount > 0;

  // Immobilisation : le HT est porté à l'actif (classe 2), sans compte auxiliaire
  // de charge ni tiers "charge".
  const chargeCode = isImmobilisation
    ? charge.immobilisationAccountCode || "24"
    : category.accountCode || "605";
  let chargeAccount = await prisma.accountingAccount.findUnique({
    where: { accountCode: chargeCode },
  });
  if (!chargeAccount) {
    chargeAccount = await prisma.accountingAccount.findUnique({
      where: { accountCode: isImmobilisation ? "24" : "605" },
    });
  }
  if (!chargeAccount) {
    throw new Error(
      `Compte ${isImmobilisation ? "d'immobilisation" : "de charge"} ${chargeCode} non trouvé`
    );
  }

  // Compte auxiliaire propre à la charge (SYSCOHADA révisé).
  const chargeLabel = chargeAuxiliaryLabel(category.label, charge.supplierName, charge.description);
  const chargeAuxCode = isImmobilisation
    ? null
    : await ensureTiersAccount(prisma, "charge", chargeLabel, [chargeAccount.accountCode]);
  const chargeAuxAccount = chargeAuxCode
    ? await prisma.accountingAccount.findUnique({ where: { accountCode: chargeAuxCode } })
    : null;

  // Compte auxiliaire du fournisseur (si renseigné).
  if (charge.supplierName) {
    await ensureTiersAccount(prisma, "fournisseur", charge.supplierName);
  }

  const cashAccount = await resolveAccount(prisma, treasuryMapping.accountCode);
  const tvaAccount = tvaEnabled
    ? await resolveAccount(prisma, DEFAULT_MAPPINGS.TVA_RECOVERABLE.accountCode)
    : null;
  const taxWithheldMapping = isWithholding ? await getMapping(prisma, "TAX_WITHHELD") : null;
  const withholdingAccount =
    isWithholding && taxWithheldMapping
      ? await resolveFirstAccount(prisma, [taxWithheldMapping.accountCode, "447"])
      : null;

  const lines: AccountingLineInput[] = [
    {
      accountId: chargeAuxAccount?.id ?? chargeAccount.id,
      debit: totalHt,
      credit: 0,
      libelle: `${isImmobilisation ? "Immobilisation" : category.label}${charge.description ? ` - ${charge.description}` : ""}`,
      thirdPartyType: "charge",
      thirdPartyId: charge.id,
    },
  ];

  if (tvaEnabled && tvaAccount && taxAmount > 0) {
    lines.push({
      accountId: tvaAccount.id,
      debit: taxAmount,
      credit: 0,
      libelle: "TVA récupérable",
    });
  } else if (isWithholding && withholdingAccount && taxAmount > 0) {
    lines.push({
      accountId: withholdingAccount.id,
      debit: 0,
      credit: taxAmount,
      libelle: "Retenue d'impôt",
    });
  }

  const cashAmount = isWithholding ? amount - taxAmount : amount;
  lines.push({
    accountId: cashAccount.id,
    debit: 0,
    credit: cashAmount,
    libelle: `${isImmobilisation ? "Acquisition immobilisation" : isWithholding ? "Paiement net intervenant" : "Paiement charge"} - ${isCash ? "Caisse" : "Banque"}`,
    thirdPartyType: charge.supplierName ? "fournisseur" : null,
    thirdPartyId: charge.supplierName || null,
  });

  const entry = await createAccountingEntry(prisma, {
    tenantId,
    journalId: journal.id,
    exerciseId: exercise.id,
    entryDate: new Date(charge.chargeDate),
    reference: `${isImmobilisation ? "IMM" : "CHG"}-${charge.id.slice(-6)}`,
    idempotencyKey: `charge-${charge.id}`,
    libelle: `${isImmobilisation ? "Immobilisation" : "Charge"}: ${charge.description || category.label}${charge.supplierName ? ` - ${charge.supplierName}` : ""}`,
    createdBy: userId,
    lines,
  });

  // Lier l'écriture à la charge
  await prisma.charge.update({
    where: { id: charge.id },
    data: { accountingEntryId: entry.id },
  });

  return entry;
}

// ============================================================
// 3 bis. DOTATION AUX AMORTISSEMENTS (journal OD)
// D 681x Dotations aux amortissements d'exploitation
// C 28x  Amortissements de l'immobilisation
//
// Une écriture par ligne du plan d'amortissement (ChargeAmortissement).
// L'idempotence par dotation garantit qu'un mois n'est jamais comptabilisé deux fois.
// ============================================================
export async function createEntryFromAmortissement(
  prisma: any,
  tenantId: string,
  charge: {
    id: string;
    description: string | null;
    immobilisationAccountCode: string | null;
    category?: { label: string } | null;
  },
  dotation: {
    id: string;
    numero: number;
    periodYear: number;
    periodMonth: number;
    dueDate: Date;
    amount: number;
  },
  userId: string | null
) {
  const amount = Math.round((Number(dotation.amount) || 0) * 100) / 100;
  if (amount <= 0) throw new Error("Dotation nulle : rien à comptabiliser");

  const expenseMapping = await getMapping(prisma, "AMORTIZATION_EXPENSE");
  const journal = await resolveJournal(prisma, expenseMapping.journalCode || "OD");
  const exercise = await getOpenExercise(prisma);

  const immoCode = charge.immobilisationAccountCode || "24";
  const dotationAccount = await resolveFirstAccount(prisma, [
    expenseMapping.accountCode,
    ...dotationAccountCandidates(immoCode),
  ]);
  const cumulMapping = await getMapping(prisma, "AMORTIZATION_CUMULATED");
  const cumulAccount = await resolveFirstAccount(prisma, [
    ...amortissementAccountCandidates(immoCode),
    cumulMapping.accountCode,
  ]);

  const periode = formatPeriode(dotation.periodYear, dotation.periodMonth);
  const libelleBase = charge.description || charge.category?.label || "Immobilisation";

  const entry = await createAccountingEntry(prisma, {
    tenantId,
    journalId: journal.id,
    exerciseId: exercise.id,
    entryDate: new Date(dotation.dueDate),
    reference: `AMO-${charge.id.slice(-6)}-${String(dotation.numero).padStart(3, "0")}`,
    idempotencyKey: `amortissement-${dotation.id}`,
    libelle: `Dotation amortissement ${periode} - ${libelleBase}`,
    createdBy: userId,
    lines: [
      {
        accountId: dotationAccount.id,
        debit: amount,
        credit: 0,
        libelle: `Dotation ${periode} - ${libelleBase}`,
        thirdPartyType: "charge",
        thirdPartyId: charge.id,
      },
      {
        accountId: cumulAccount.id,
        debit: 0,
        credit: amount,
        libelle: `Amortissements cumulés - ${libelleBase}`,
      },
    ],
  });

  await prisma.chargeAmortissement.update({
    where: { id: dotation.id },
    data: { isPosted: true, postedAt: new Date(), accountingEntryId: entry.id },
  });

  return entry;
}

/// Comptabilise toutes les dotations échues et non encore comptabilisées.
/// Appelée à la création d'une immobilisation, depuis le bouton
/// « Comptabiliser les dotations échues » et utilisable par une tâche planifiée.
export async function postDueAmortissements(
  prisma: any,
  tenantId: string,
  userId: string | null,
  { chargeId, upTo }: { chargeId?: string; upTo?: Date } = {}
) {
  const dotations = await prisma.chargeAmortissement.findMany({
    where: {
      isPosted: false,
      dueDate: { lte: upTo ?? new Date() },
      ...(chargeId ? { chargeId } : {}),
      charge: { actif: true, isImmobilisation: true },
    },
    include: { charge: { include: { category: { select: { label: true } } } } },
    orderBy: [{ dueDate: "asc" }, { numero: "asc" }],
  });

  const errors: { id: string; message: string }[] = [];
  let posted = 0;
  let totalAmount = 0;

  for (const d of dotations) {
    try {
      await createEntryFromAmortissement(prisma, tenantId, d.charge, d, userId);
      posted++;
      totalAmount += Number(d.amount) || 0;
    } catch (error: any) {
      errors.push({ id: d.id, message: error?.message || "Erreur inconnue" });
    }
  }

  return { posted, totalAmount: Math.round(totalAmount * 100) / 100, errors };
}

// ============================================================
// 4. PAIE (journal SAL)
// D 661 Rémunération brute
// D 664 Charges sociales patronales
// C 4311 CNSS/CSS due (salarié + employeur)
// C 4313 IPRES due (salarié + employeur)
// C 447 IRPP retenu
// C 423 Personnel, oppositions et saisies-arrêts (autres retenues)
// C 422 Salaires dus (net à payer)
// ============================================================
export async function createEntryFromPayroll(
  prisma: any,
  tenantId: string,
  payroll: {
    id: string;
    periodYear: number;
    periodMonth: number;
    grossSalary: number;
    totalDeductions: number;
    totalCotisations: number;
    cssAmount: number;
    cssEmployerAmount: number;
    ipresAmount: number;
    ipresEmployerAmount: number;
    irppAmount: number;
    netSalary: number;
    employeeId?: string | null;
  },
  mode: string,
  userId: string | null
) {
  const journal = await resolveJournal(prisma, "SAL");
  const exercise = await getOpenExercise(prisma);

  const isCash = mode === "especes";
  const cashMapping = await getMapping(prisma, isCash ? "CASH" : "BANK");

  const [directRemMap, socialMap, cnssMap, ipresMap, taxMap, deducMap, salariesMap, cashAccount] =
    await Promise.all([
      getMapping(prisma, "DIRECT_REMUNERATION"),
      getMapping(prisma, "SOCIAL_CHARGES"),
      getMapping(prisma, "CNSS_PAYABLE"),
      getMapping(prisma, "IPRES_PAYABLE"),
      getMapping(prisma, "TAX_WITHHELD"),
      getMapping(prisma, "OTHER_DEDUCTIONS"),
      getMapping(prisma, "SALARIES_PAYABLE"),
      resolveAccount(prisma, cashMapping.accountCode),
    ]);

  const [directRemAccount, socialChargesAccount, cnssAccount, ipresAccount, taxAccount, otherDeducAccount, salariesAccount] =
    await Promise.all([
      resolveAccount(prisma, directRemMap.accountCode),
      resolveAccount(prisma, socialMap.accountCode),
      resolveAccount(prisma, cnssMap.accountCode),
      resolveAccount(prisma, ipresMap.accountCode),
      resolveAccount(prisma, taxMap.accountCode),
      resolveFirstAccount(prisma, [deducMap.accountCode, "427"]),
      resolveAccount(prisma, salariesMap.accountCode),
    ]);

  const cssTotal = Number(payroll.cssAmount) + Number(payroll.cssEmployerAmount);
  const ipresTotal = Number(payroll.ipresAmount) + Number(payroll.ipresEmployerAmount);
  const otherDeductions = Number(payroll.totalDeductions) + Number(payroll.totalCotisations);
  // Le net est le résidu exact brut − retenues : garantit l'équilibre de
  // l'écriture même si les montants stockés ont été arrondis à l'entier
  // indépendamment (écart possible de ±1 F).
  const netSalary =
    Number(payroll.grossSalary) -
    Number(payroll.cssAmount) -
    Number(payroll.ipresAmount) -
    Number(payroll.irppAmount) -
    otherDeductions;

  // Corriger le net stocké s'il a été décalé par un arrondi : le compte 422
  // crédité ici doit être soldé par le règlement qui utilise netSalary.
  if (netSalary !== Number(payroll.netSalary)) {
    await prisma.payroll.update({
      where: { id: payroll.id },
      data: { netSalary },
    });
    payroll.netSalary = netSalary;
  }

  const employee = payroll.employeeId
    ? await prisma.employee.findUnique({
        where: { id: payroll.employeeId },
        select: { firstName: true, lastName: true },
      })
    : null;
  const employeeAccount = employee
    ? await resolveTiersAccount(prisma, salariesAccount, `${employee.firstName} ${employee.lastName}`)
    : salariesAccount;

  const lines: AccountingLineInput[] = [
    {
      accountId: directRemAccount.id,
      debit: Number(payroll.grossSalary),
      credit: 0,
      libelle: "Rémunération brute",
    },
    {
      accountId: socialChargesAccount.id,
      debit: Number(payroll.cssEmployerAmount) + Number(payroll.ipresEmployerAmount),
      credit: 0,
      libelle: "Charges sociales patronales",
    },
    {
      accountId: cnssAccount.id,
      debit: 0,
      credit: cssTotal,
      libelle: "Caisse de sécurité sociale (CNSS/CSS)",
    },
    {
      accountId: ipresAccount.id,
      debit: 0,
      credit: ipresTotal,
      libelle: "Caisse de retraite (IPRES)",
    },
    {
      accountId: taxAccount.id,
      debit: 0,
      credit: Number(payroll.irppAmount),
      libelle: "IRPP retenu à la source",
    },
    {
      accountId: otherDeducAccount.id,
      debit: 0,
      credit: otherDeductions,
      libelle: "Autres retenues / oppositions",
    },
    {
      accountId: employeeAccount.id,
      debit: 0,
      credit: netSalary,
      libelle: "Salaire net à payer",
      thirdPartyType: "employe",
      thirdPartyId: payroll.employeeId || null,
    },
  ];

  const entry = await createAccountingEntry(prisma, {
    tenantId,
    journalId: journal.id,
    exerciseId: exercise.id,
    entryDate: new Date(),
    reference: `SAL-${payroll.id.slice(-6)}`,
    idempotencyKey: `payroll-${payroll.id}`,
    libelle: `Paie ${payroll.periodMonth}/${payroll.periodYear}`,
    createdBy: userId,
    lines,
  });

  // Lier l'écriture au bulletin
  await prisma.payroll.update({
    where: { id: payroll.id },
    data: { accountingEntryId: entry.id },
  });

  return entry;
}

// ============================================================
// 5. RÈGLEMENT DU NET À PAYER (journal TRE)
// D 422 Salaires dus (extinction de la dette)
// C 57/52 Trésorerie (sortie de trésorerie)
// Cette écriture est séparée de l'écriture de paie pour
// refléter le décaissement effectif du salaire net.
// ============================================================
export async function createEntryFromPayrollSettlement(
  prisma: any,
  tenantId: string,
  payroll: {
    id: string;
    periodYear: number;
    periodMonth: number;
    netSalary: number;
    paidAt: Date | null;
    employeeId?: string | null;
  },
  mode: string,
  userId: string | null
) {
  const isCash = mode === "especes";
  const cashMapping = await getMapping(prisma, isCash ? "CASH" : "BANK");
  const journal = await resolveJournal(prisma, cashMapping.journalCode);
  const exercise = await getOpenExercise(prisma);

  const salariesMap = await getMapping(prisma, "SALARIES_PAYABLE");
  const [salariesAccount, cashAccount] = await Promise.all([
    resolveAccount(prisma, salariesMap.accountCode),
    resolveAccount(prisma, cashMapping.accountCode),
  ]);

  const netSalary = Number(payroll.netSalary);

  const employee = payroll.employeeId
    ? await prisma.employee.findUnique({
        where: { id: payroll.employeeId },
        select: { firstName: true, lastName: true },
      })
    : null;
  const employeeAccount = employee
    ? await resolveTiersAccount(prisma, salariesAccount, `${employee.firstName} ${employee.lastName}`)
    : salariesAccount;

  const lines: AccountingLineInput[] = [
    {
      accountId: employeeAccount.id,
      debit: netSalary,
      credit: 0,
      libelle: `Règlement salaire net ${payroll.periodMonth}/${payroll.periodYear}`,
      thirdPartyType: "employe",
      thirdPartyId: payroll.employeeId || null,
    },
    {
      accountId: cashAccount.id,
      debit: 0,
      credit: netSalary,
      libelle: `Sortie trésorerie - ${isCash ? "Caisse" : "Banque"}`,
    },
  ];

  return createAccountingEntry(prisma, {
    tenantId,
    journalId: journal.id,
    exerciseId: exercise.id,
    entryDate: payroll.paidAt ? new Date(payroll.paidAt) : new Date(),
    reference: `PAY-SAL-${payroll.id.slice(-6)}`,
    idempotencyKey: `payroll-settlement-${payroll.id}`,
    libelle: `Règlement net salaire ${payroll.periodMonth}/${payroll.periodYear}`,
    createdBy: userId,
    lines,
  });
}

// ============================================================
// 6. RÈGLEMENT DES PASSIFS SOCIAUX ET FISCAUX
// (virement des cotisations CNSS/IPRES et de l'IRPP aux
// organismes — à appeler mensuellement ou trimestriellement)
// D 4311 CNSS due
// D 4313 IPRES due
// D 447  IRPP retenu
// C 52   Banque
// ============================================================
export async function createEntryFromSocialSettlement(
  prisma: any,
  tenantId: string,
  {
    periodYear,
    periodMonth,
    cnssAmount,
    ipresAmount,
    irppAmount,
    settlementDate,
  }: {
    periodYear: number;
    periodMonth: number;
    cnssAmount: number;
    ipresAmount: number;
    irppAmount: number;
    settlementDate: Date;
  },
  userId: string | null
) {
  const bankMapping = await getMapping(prisma, "BANK");
  const journal = await resolveJournal(prisma, bankMapping.journalCode);
  const exercise = await getOpenExercise(prisma);

  const [cnssMap, ipresMap, taxMap, bankAccount] = await Promise.all([
    getMapping(prisma, "CNSS_PAYABLE"),
    getMapping(prisma, "IPRES_PAYABLE"),
    getMapping(prisma, "TAX_WITHHELD"),
    resolveAccount(prisma, bankMapping.accountCode),
  ]);

  const [cnssAccount, ipresAccount, taxAccount] = await Promise.all([
    resolveAccount(prisma, cnssMap.accountCode),
    resolveAccount(prisma, ipresMap.accountCode),
    resolveAccount(prisma, taxMap.accountCode),
  ]);

  const total = cnssAmount + ipresAmount + irppAmount;
  if (total <= 0) {
    throw new Error("Montant du règlement social/fiscal nul ou négatif");
  }

  const lines: AccountingLineInput[] = [];

  if (cnssAmount > 0) {
    lines.push({
      accountId: cnssAccount.id,
      debit: cnssAmount,
      credit: 0,
      libelle: `Règlement CNSS/CSS ${periodMonth}/${periodYear}`,
    });
  }
  if (ipresAmount > 0) {
    lines.push({
      accountId: ipresAccount.id,
      debit: ipresAmount,
      credit: 0,
      libelle: `Règlement IPRES ${periodMonth}/${periodYear}`,
    });
  }
  if (irppAmount > 0) {
    lines.push({
      accountId: taxAccount.id,
      debit: irppAmount,
      credit: 0,
      libelle: `Règlement IRPP ${periodMonth}/${periodYear}`,
    });
  }
  lines.push({
    accountId: bankAccount.id,
    debit: 0,
    credit: total,
    libelle: `Sortie banque - règlement social/fiscal`,
  });

  return createAccountingEntry(prisma, {
    tenantId,
    journalId: journal.id,
    exerciseId: exercise.id,
    entryDate: settlementDate,
    reference: `SOC-${periodYear}${String(periodMonth).padStart(2, "0")}`,
    idempotencyKey: `social-settlement-${periodYear}-${periodMonth}`,
    libelle: `Règlement passifs sociaux et fiscaux ${periodMonth}/${periodYear}`,
    createdBy: userId,
    lines,
  });
}

// ============================================================
// 7. AVANCE ASSUREUR (journal ACH)
// D 409 Avances et acomptes versés aux fournisseurs
// C 52/57 Trésorerie
// L'écriture est générée au moment du règlement effectif par le comptable,
// après approbation d'un administrateur / directeur / associé.
// ============================================================
export async function createEntryFromInsuranceAdvance(
  prisma: any,
  tenantId: string,
  payment: {
    id: string;
    montant: number;
    modePaiement: string;
    datePaiement: Date;
    referencePaiement?: string | null;
    contract: { reference: string; insurer: { id: string; nom: string } };
  },
  userId: string | null
) {
  const advanceMapping = await getMapping(prisma, "SUPPLIER_ADVANCE");
  const journal = await resolveJournal(prisma, advanceMapping.journalCode);
  const exercise = await getOpenExercise(prisma);

  const advanceParent = await resolveFirstAccount(prisma, [
    advanceMapping.accountCode,
    "409",
  ]);

  const advanceAuxCode = await ensureAuxiliaryAccount(prisma, [advanceMapping.accountCode, "409"], payment.contract.insurer.nom);
  let advanceAccount = advanceParent;
  if (advanceAuxCode) {
    const aux = await prisma.accountingAccount.findUnique({
      where: { accountCode: advanceAuxCode },
    });
    if (aux) advanceAccount = aux;
  }

  const isCash = payment.modePaiement === "especes";
  const cashMapping = await getMapping(prisma, isCash ? "CASH" : "BANK");
  const cashAccount = await resolveAccount(prisma, cashMapping.accountCode);

  const amount = Number(payment.montant);
  const lines: AccountingLineInput[] = [
    {
      accountId: advanceAccount.id,
      debit: amount,
      credit: 0,
      libelle: `Avance assurance ${payment.contract.reference}`,
      thirdPartyType: "fournisseur",
      thirdPartyId: payment.contract.insurer.id,
    },
    {
      accountId: cashAccount.id,
      debit: 0,
      credit: amount,
      libelle: `Sortie ${isCash ? "caisse" : "banque"} - avance assurance ${payment.contract.reference}${
        payment.referencePaiement ? ` - ${payment.referencePaiement}` : ""
      }`,
    },
  ];

  return createAccountingEntry(prisma, {
    tenantId,
    journalId: journal.id,
    exerciseId: exercise.id,
    entryDate: new Date(payment.datePaiement),
    reference: `AVC-ASS-${payment.id.slice(-6)}`,
    idempotencyKey: `insurance-advance-${payment.id}`,
    libelle: `Avance assurance ${payment.contract.reference} - ${payment.contract.insurer.nom}`,
    createdBy: userId,
    lines,
  });
}
