import { listTiers, tiersMapOf } from "./tiers";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

// ============================================================
// lib/reporting.ts
// Calcul des états financiers SYSCOHADA révisé :
//   - Bilan OHADA (actif / passif)
//   - Compte de résultat OHADA
//   - Soldes intermédiaires de gestion (SIG)
//   - Tableau des flux de trésorerie
//   - Données de paie consolidées
// Portage fidèle de C:\xampp\htdocs\cabinet\src\Models\Comptabilite.php
// ============================================================

export interface ReportAccount {
  accountCode: string;
  label: string;
  solde: number;
  class: number;
  accountType: string;
}

export interface BilanSection {
  actifImmobilisations: ReportAccount[];
  actifCirculant: ReportAccount[];
  tresorerieActif: ReportAccount[];
  capitauxPropres: ReportAccount[];
  passifCirculant: ReportAccount[];
  tresoreriePassif: ReportAccount[];
  resultatNet: number;
  tvaCollectee: number;
  tvaRecuperable: number;
  tvaNette: number;
  totalActif: number;
  totalPassif: number;
  ecart: number;
}

export interface CompteResultatTotaux {
  ventes_marchandises: number;
  achats_marchandises: number;
  variation_stocks_marchandises: number;
  ventes_produits: number;
  travaux_services: number;
  produits_accessoires: number;
  autres_produits: number;
  transferts_charges: number;
  achats_matieres: number;
  variation_stocks_matieres: number;
  autres_achats: number;
  transports: number;
  services_exterieurs: number;
  impots_taxes: number;
  autres_charges: number;
  charges_personnel: number;
  dotations_amortissements: number;
  frais_financiers: number;
  revenus_financiers: number;
  produits_hao: number;
  charges_hao: number;
  impots_resultat: number;
}

export interface CompteResultat {
  produits: ReportAccount[];
  charges: ReportAccount[];
  totaux: CompteResultatTotaux;
}

export interface SIG {
  marge_commerciale: number;
  production: number;
  valeur_ajoutee: number;
  ebe: number;
  resultat_exploitation: number;
  resultat_financier: number;
  rao: number;
  resultat_hao: number;
  resultat_net: number;
}

export interface FluxTresorerie {
  tresorerie_initiale: number;
  flux_exploitation: number;
  flux_investissement: number;
  flux_financement: number;
  variation_tresorerie: number;
  tresorerie_finale: number;
}

export interface PayrollReportData {
  total_gross_salary: number;
  total_net_salary: number;
  total_ipres_employee: number;
  total_ipres_employer: number;
  total_css_employee: number;
  total_css_employer: number;
  total_irpp: number;
  total_employer_charges: number;
  employee_count: number;
  entry_count: number;
  by_month: Array<{
    period_month: number;
    employee_count: number;
    gross_salary: number;
    net_salary: number;
    ipres_employee: number;
    ipres_employer: number;
    css_employee: number;
    css_employer: number;
    irpp: number;
    employer_charges: number;
  }>;
}

export interface EntryLineReport {
  entry_id: string;
  entry_date: Date;
  reference: string | null;
  entry_libelle: string;
  account_code: string;
  account_label: string;
  libelle: string | null;
  debit: number;
  credit: number;
  journal_code: string | null;
  third_party_type: string | null;
  third_party_id: string | null;
  tiers_label: string | null;
}

export interface FinancialReport {
  exercice: number;
  dateDebut: Date;
  dateFin: Date;
  entryLines: EntryLineReport[];
  bilan: BilanSection;
  compteResultat: CompteResultat;
  sig: SIG;
  flux: FluxTresorerie;
  payroll: PayrollReportData;
  indicateurs: {
    totalProduits: number;
    totalCharges: number;
    resultatNet: number;
    tresorerieNette: number;
  };
}

// ============================================================
// Helpers
// ============================================================
function prefix3(code: string): string {
  return code.substring(0, 3);
}
function prefix2(code: string): string {
  return code.substring(0, 2);
}

/// Calcule le solde cumulé de chaque compte à une date donnée.
/// Utilisé pour le bilan (photo à date de fin).
export async function computeAccountBalancesAt(
  prisma: any,
  tenantId: string,
  upTo: Date
): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  const lines = await prisma.accountingEntryLine.findMany({
    where: {
      tenantId,
      entry: { entryDate: { lte: endOfDay(upTo) } },
    },
    select: {
      account: { select: { accountCode: true, accountType: true } },
      debit: true,
      credit: true,
    },
    orderBy: [{ entry: { entryDate: "asc" } }, { id: "asc" }],
  });
  for (const l of lines) {
    const code = l.account.accountCode;
    const passifProduit = ["PASSIF", "PRODUIT", "ACTIF/PASSIF", "CAPITAU"].includes(
      l.account.accountType
    );
    const signed = passifProduit
      ? (Number(l.credit) || 0) - (Number(l.debit) || 0)
      : (Number(l.debit) || 0) - (Number(l.credit) || 0);
    balances.set(code, (balances.get(code) || 0) + signed);
  }
  return balances;
}

/// Calcule les mouvements (débits - crédits) de chaque compte sur une période.
/// Utilisé pour le compte de résultat (mouvements de la période).
export async function computeAccountMovements(
  prisma: any,
  tenantId: string,
  dateDebut: Date,
  dateFin: Date
): Promise<Map<string, number>> {
  const movements = new Map<string, number>();
  const lines = await prisma.accountingEntryLine.findMany({
    where: {
      tenantId,
      entry: {
        entryDate: { gte: startOfDay(dateDebut), lte: endOfDay(dateFin) },
      },
    },
    select: {
      account: { select: { accountCode: true, accountType: true } },
      debit: true,
      credit: true,
    },
    orderBy: [{ entry: { entryDate: "asc" } }, { id: "asc" }],
  });
  for (const l of lines) {
    const code = l.account.accountCode;
    const passifProduit = ["PASSIF", "PRODUIT", "ACTIF/PASSIF", "CAPITAU"].includes(
      l.account.accountType
    );
    const signed = passifProduit
      ? (Number(l.credit) || 0) - (Number(l.debit) || 0)
      : (Number(l.debit) || 0) - (Number(l.credit) || 0);
    movements.set(code, (movements.get(code) || 0) + signed);
  }
  return movements;
}

/// Récupère les labels et métadonnées des comptes pour enrichir les rapports.
async function getAccountsWithBalances(
  prisma: any,
  balances: Map<string, number>
): Promise<any[]> {
  const allAccounts = await prisma.accountingAccount.findMany({
    where: { isActive: true },
    orderBy: { accountCode: "asc" },
    select: {
      accountCode: true,
      label: true,
      class: true,
      accountType: true,
    },
  });
  return allAccounts.map((a: any) => ({
    ...a,
    soldeActuel: balances.get(a.accountCode) || 0,
  }));
}

// ============================================================
// Compte de résultat OHADA
// ============================================================
export function computeCompteResultat(accounts: any[]): CompteResultat {
  const totaux: CompteResultatTotaux = {
    ventes_marchandises: 0,
    achats_marchandises: 0,
    variation_stocks_marchandises: 0,
    ventes_produits: 0,
    travaux_services: 0,
    produits_accessoires: 0,
    autres_produits: 0,
    transferts_charges: 0,
    achats_matieres: 0,
    variation_stocks_matieres: 0,
    autres_achats: 0,
    transports: 0,
    services_exterieurs: 0,
    impots_taxes: 0,
    autres_charges: 0,
    charges_personnel: 0,
    dotations_amortissements: 0,
    frais_financiers: 0,
    revenus_financiers: 0,
    produits_hao: 0,
    charges_hao: 0,
    impots_resultat: 0,
  };

  const produits: ReportAccount[] = [];
  const charges: ReportAccount[] = [];

  for (const a of accounts) {
    const code = a.accountCode;
    const solde = Number(a.soldeActuel) || 0;
    const label = a.label;
    const cls = Number(a.class);
    const p3 = prefix3(code);
    const p2 = prefix2(code);

    const item: ReportAccount = {
      accountCode: code,
      label,
      solde,
      class: cls,
      accountType: a.accountType,
    };

    if (solde === 0) continue;

    if (cls === 7) {
      produits.push(item);
      if (p3 === "701") totaux.ventes_marchandises += solde;
      else if (p3 === "702") totaux.ventes_produits += solde;
      else if (["703", "704", "705", "706"].includes(p3)) totaux.travaux_services += solde;
      else if (p3 === "707") totaux.produits_accessoires += solde;
      else if (["758", "759"].includes(p3)) totaux.autres_produits += solde;
      else if (["781", "787"].includes(p3)) totaux.transferts_charges += solde;
      else if (["76", "77"].includes(p2)) totaux.revenus_financiers += solde;
      else if (p2 === "79") totaux.produits_hao += solde;
      else totaux.autres_produits += solde;
    } else if (cls === 6) {
      charges.push(item);
      if (p3 === "601") totaux.achats_marchandises += solde;
      else if (p3 === "603") totaux.variation_stocks_marchandises += solde;
      else if (p3 === "602") totaux.achats_matieres += solde;
      else if (["604", "605", "606"].includes(p3)) totaux.autres_achats += solde;
      else if (p2 === "61") totaux.transports += solde;
      else if (["62", "63"].includes(p2)) totaux.services_exterieurs += solde;
      else if (p2 === "64") totaux.impots_taxes += solde;
      else if (["658", "659"].includes(p3)) totaux.autres_charges += solde;
      else if (p2 === "66") totaux.charges_personnel += solde;
      else if (["681", "687"].includes(p3)) totaux.dotations_amortissements += solde;
      else if (["679", "678"].includes(p3)) totaux.charges_hao += solde;
      else if (p2 === "67") totaux.frais_financiers += solde;
      else if (p2 === "69") totaux.impots_resultat += solde;
      else totaux.autres_charges += solde;
    }
  }

  return { produits, charges, totaux };
}

// ============================================================
// Soldes intermédiaires de gestion (SIG)
// ============================================================
export function computeSIG(cr: CompteResultat): SIG {
  const t = cr.totaux;

  const marge_commerciale =
    t.ventes_marchandises - t.achats_marchandises - t.variation_stocks_marchandises;

  const production =
    t.travaux_services + t.produits_accessoires + t.ventes_produits + t.autres_produits;

  const consommation_intermediaire =
    t.achats_matieres + t.autres_achats + t.transports + t.services_exterieurs;

  const valeur_ajoutee = marge_commerciale + production - consommation_intermediaire;

  const ebe =
    valeur_ajoutee + t.transferts_charges - t.autres_charges - t.impots_taxes;

  const resultat_exploitation =
    ebe - t.charges_personnel - t.dotations_amortissements;

  const resultat_financier = t.revenus_financiers - t.frais_financiers;

  const rao = resultat_exploitation + resultat_financier;

  const resultat_hao = t.produits_hao - t.charges_hao;

  const resultat_net = rao + resultat_hao - t.impots_resultat;

  return {
    marge_commerciale,
    production,
    valeur_ajoutee,
    ebe,
    resultat_exploitation,
    resultat_financier,
    rao,
    resultat_hao,
    resultat_net,
  };
}

// ============================================================
// Bilan OHADA
// ============================================================
export function computeBilan(accounts: any[], cr: CompteResultat): BilanSection {
  const actif_immobilisations: ReportAccount[] = [];
  const actif_circulant: ReportAccount[] = [];
  const tresorerie_actif: ReportAccount[] = [];
  const capitaux_propres: ReportAccount[] = [];
  const passif_circulant: ReportAccount[] = [];
  const tresorerie_passif: ReportAccount[] = [];

  let tvaCollectee = 0;
  let tvaRecuperable = 0;

  for (const a of accounts) {
    const code = a.accountCode;
    const solde = Number(a.soldeActuel) || 0;
    const cls = Number(a.class);
    const type = a.accountType;

    if (solde === 0) continue;

    const item: ReportAccount = {
      accountCode: code,
      label: a.label,
      solde,
      class: cls,
      accountType: type,
    };

    // TVA : consolider 443 et 445
    if (code === "443") tvaCollectee = solde;
    if (code === "445") tvaRecuperable = solde;

    // ACTIF IMMOBILISÉ (classes 2, 3)
    if ([2, 3].includes(cls)) {
      actif_immobilisations.push(item);
    }
    // ACTIF CIRCULANT (classe 4 ACTIF, sauf 445)
    else if (cls === 4 && type === "ACTIF" && code !== "445") {
      actif_circulant.push(item);
    }
    // TRÉSORERIE-ACTIF (classe 5, solde > 0)
    else if (cls === 5 && solde > 0) {
      tresorerie_actif.push(item);
    }
    // TRÉSORERIE-PASSIF (classe 5, solde < 0 = concours bancaires)
    else if (cls === 5 && solde < 0) {
      tresorerie_passif.push({ ...item, solde: Math.abs(solde) });
    }
    // CAPITAUX PROPRES (classe 1)
    else if (cls === 1) {
      capitaux_propres.push(item);
    }
    // PASSIF CIRCULANT (classe 4 PASSIF, sauf 443 et 445)
    else if (cls === 4 && type === "PASSIF" && !["443", "445"].includes(code)) {
      passif_circulant.push(item);
    }
  }

  // TVA nette : centralisée dans le compte 444 État, TVA due / crédit de TVA
  const tvaNette = tvaCollectee - tvaRecuperable;
  if (tvaNette > 0) {
    passif_circulant.push({
      accountCode: "4441",
      label: "État, TVA due (443 collectée - 445 récupérable)",
      solde: tvaNette,
      class: 4,
      accountType: "PASSIF",
    });
  } else if (tvaNette < 0) {
    actif_circulant.push({
      accountCode: "4449",
      label: "État, crédit de TVA (445 récupérable - 443 collectée)",
      solde: Math.abs(tvaNette),
      class: 4,
      accountType: "ACTIF",
    });
  }

  // Résultat net dans capitaux propres (comptes de la famille 13)
  const resultat_net = computeSIG(cr).resultat_net;

  if (resultat_net !== 0) {
    const resultCode = resultat_net >= 0 ? "131" : "139";
    const resultLabel = resultat_net >= 0 ? "Résultat net : bénéfice" : "Résultat net : déficit";
    capitaux_propres.push({
      accountCode: resultCode,
      label: resultLabel,
      solde: resultat_net,
      class: 1,
      accountType: "PASSIF",
    });
  }

  const total_actif =
    actif_immobilisations.reduce((s, a) => s + a.solde, 0) +
    actif_circulant.reduce((s, a) => s + a.solde, 0) +
    tresorerie_actif.reduce((s, a) => s + a.solde, 0);

  const total_passif =
    capitaux_propres.reduce((s, a) => s + a.solde, 0) +
    passif_circulant.reduce((s, a) => s + a.solde, 0) +
    tresorerie_passif.reduce((s, a) => s + a.solde, 0);

  return {
    actifImmobilisations: actif_immobilisations,
    actifCirculant: actif_circulant,
    tresorerieActif: tresorerie_actif,
    capitauxPropres: capitaux_propres,
    passifCirculant: passif_circulant,
    tresoreriePassif: tresorerie_passif,
    resultatNet: resultat_net,
    tvaCollectee,
    tvaRecuperable,
    tvaNette,
    totalActif: total_actif,
    totalPassif: total_passif,
    ecart: total_actif - total_passif,
  };
}

// ============================================================
// Flux de trésorerie OHADA
// ============================================================
export async function computeFluxTresorerie(
  prisma: any,
  tenantId: string,
  dateDebut: Date,
  dateFin: Date
): Promise<FluxTresorerie> {
  // Trésorerie actif (comptes 52, 57 et sous-comptes) au début de la période
  // et en fin de période, calculée à partir des lignes d'écriture.
  const balanceStart = await computeAccountBalancesAt(prisma, tenantId, new Date(startOfDay(dateDebut).getTime() - 1));
  const balanceEnd = await computeAccountBalancesAt(prisma, tenantId, dateFin);

  const treasuryCodes = new Set(["52", "57", "521", "522", "531", "571"]);
  const tresorerieInitiale = Array.from(balanceStart.entries())
    .filter(([code]) => treasuryCodes.has(code) || prefix2(code) === "52" || prefix2(code) === "57")
    .reduce((s, [, v]) => s + v, 0);
  const tresorerieFinale = Array.from(balanceEnd.entries())
    .filter(([code]) => treasuryCodes.has(code) || prefix2(code) === "52" || prefix2(code) === "57")
    .reduce((s, [, v]) => s + v, 0);

  // Flux d'investissement : débits sur comptes classe 2
  const invLines = await prisma.accountingEntryLine.findMany({
    where: {
      tenantId,
      entry: {
        entryDate: { gte: dateDebut, lte: dateFin },
      },
      account: { class: 2 },
    },
    select: { debit: true, credit: true },
  });
  const flux_investissement = -invLines.reduce((s: number, l: any) => s + (Number(l.debit) - Number(l.credit)), 0);

  // Flux de financement : crédits sur comptes classe 1
  const finLines = await prisma.accountingEntryLine.findMany({
    where: {
      tenantId,
      entry: {
        entryDate: { gte: dateDebut, lte: dateFin },
      },
      account: { class: 1 },
    },
    select: { debit: true, credit: true },
  });
  const flux_financement = finLines.reduce((s: number, l: any) => s + (Number(l.credit) - Number(l.debit)), 0);

  // Variation de trésorerie : débits - crédits sur comptes 52/57
  const tresLines = await prisma.accountingEntryLine.findMany({
    where: {
      tenantId,
      entry: {
        entryDate: { gte: dateDebut, lte: dateFin },
      },
      account: {
        class: 5,
        accountCode: { in: ["52", "57", "521", "522", "531", "571"] },
      },
    },
    select: { debit: true, credit: true },
  });
  const variation_tresorerie = tresorerieFinale - tresorerieInitiale;
  const flux_exploitation = variation_tresorerie - flux_investissement - flux_financement;

  return {
    tresorerie_initiale: tresorerieInitiale,
    flux_exploitation,
    flux_investissement,
    flux_financement,
    variation_tresorerie,
    tresorerie_finale: tresorerieFinale,
  };
}

// ============================================================
// Données de paie consolidées
// ============================================================
export async function computePayrollData(
  prisma: any,
  tenantId: string,
  exercice: number,
  dateDebut?: Date,
  dateFin?: Date
): Promise<PayrollReportData> {
  const monthDebut = dateDebut ? dateDebut.getMonth() + 1 : 1;
  const monthFin = dateFin ? dateFin.getMonth() + 1 : 12;
  const monthlyPayrolls = await prisma.payroll.groupBy({
    by: ["periodMonth"],
    where: {
      periodYear: exercice,
      periodMonth: { gte: monthDebut, lte: monthFin },
      status: "paid",
    },
    _count: { id: true },
    _sum: {
      grossSalary: true,
      netSalary: true,
      ipresAmount: true,
      ipresEmployerAmount: true,
      cssAmount: true,
      cssEmployerAmount: true,
      irppAmount: true,
    },
    orderBy: { periodMonth: "asc" },
  });

  const data: PayrollReportData = {
    total_gross_salary: 0,
    total_net_salary: 0,
    total_ipres_employee: 0,
    total_ipres_employer: 0,
    total_css_employee: 0,
    total_css_employer: 0,
    total_irpp: 0,
    total_employer_charges: 0,
    employee_count: 0,
    entry_count: 0,
    by_month: [],
  };

  for (const m of monthlyPayrolls) {
    const gross = Number(m._sum.grossSalary) || 0;
    const ipresEmp = Number(m._sum.ipresEmployerAmount) || 0;
    const cssEmp = Number(m._sum.cssEmployerAmount) || 0;
    const employerCharges = gross + ipresEmp + cssEmp;

    data.by_month.push({
      period_month: m.periodMonth,
      employee_count: m._count.id,
      gross_salary: gross,
      net_salary: Number(m._sum.netSalary) || 0,
      ipres_employee: Number(m._sum.ipresAmount) || 0,
      ipres_employer: ipresEmp,
      css_employee: Number(m._sum.cssAmount) || 0,
      css_employer: cssEmp,
      irpp: Number(m._sum.irppAmount) || 0,
      employer_charges: employerCharges,
    });

    data.total_gross_salary += gross;
    data.total_net_salary += Number(m._sum.netSalary) || 0;
    data.total_ipres_employee += Number(m._sum.ipresAmount) || 0;
    data.total_ipres_employer += ipresEmp;
    data.total_css_employee += Number(m._sum.cssAmount) || 0;
    data.total_css_employer += cssEmp;
    data.total_irpp += Number(m._sum.irppAmount) || 0;
    data.total_employer_charges += employerCharges;
    data.employee_count += m._count.id;
  }

  // Compter les écritures de paie
  const payrollEntries = await prisma.accountingEntry.count({
    where: {
      tenantId,
      reference: { startsWith: "SAL-" },
      entryDate: {
        gte: new Date(`${exercice}-01-01`),
        lte: new Date(`${exercice}-12-31T23:59:59`),
      },
    },
  });
  data.entry_count = payrollEntries;

  return data;
}

// ============================================================
// Journal des écritures (toutes les lignes sur la période)
// ============================================================
export async function computeEntryLines(
  prisma: any,
  tenantId: string,
  dateDebut: Date,
  dateFin: Date
): Promise<EntryLineReport[]> {
  const [lines, tiers] = await Promise.all([
    prisma.accountingEntryLine.findMany({
      where: {
        tenantId,
        entry: {
          entryDate: { gte: dateDebut, lte: dateFin },
        },
      },
      include: {
        entry: { include: { journal: true } },
        account: true,
      },
      orderBy: [
        { entry: { entryDate: "desc" } },
        { entry: { id: "desc" } },
        { debit: "desc" },
        { id: "asc" },
      ],
    }),
    listTiers(prisma),
  ]);
  const tiersMap = tiersMapOf(tiers);

  return lines.map((l: any) => ({
    entry_id: l.entry.id,
    entry_date: l.entry.entryDate,
    reference: l.entry.reference,
    entry_libelle: l.entry.libelle,
    account_code: l.account?.accountCode || "",
    account_label: l.account?.label || "",
    libelle: l.libelle,
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
    journal_code: l.entry.journal?.code || null,
    third_party_type: l.thirdPartyType || null,
    third_party_id: l.thirdPartyId || null,
    tiers_label:
      l.thirdPartyType && l.thirdPartyId
        ? tiersMap.get(`${l.thirdPartyType}:${l.thirdPartyId}`) ?? l.thirdPartyId
        : null,
  }));
}

// ============================================================
// Rapport financier complet
// ============================================================
export async function generateFinancialReport(
  prisma: any,
  tenantId: string,
  options: { exercice: number; dateDebut?: Date; dateFin?: Date }
): Promise<FinancialReport> {
  const { exercice } = options;
  const dateDebut = options.dateDebut || new Date(`${exercice}-01-01`);
  const dateFin = options.dateFin || new Date(`${exercice}-12-31T23:59:59`);

  // Exercice complet pour le bilan (résultat net cumulé jusqu'à dateFin)
  const debutExercice = new Date(`${exercice}-01-01`);

  const [accountsForBilan, accountsForCr, entryLines, flux, payroll] = await Promise.all([
    getAccountsWithBalances(prisma, await computeAccountBalancesAt(prisma, tenantId, dateFin)),
    getAccountsWithBalances(prisma, await computeAccountMovements(prisma, tenantId, dateDebut, dateFin)),
    computeEntryLines(prisma, tenantId, dateDebut, dateFin),
    computeFluxTresorerie(prisma, tenantId, dateDebut, dateFin),
    computePayrollData(prisma, tenantId, exercice, dateDebut, dateFin),
  ]);

  const compteResultat = computeCompteResultat(accountsForCr);
  const sig = computeSIG(compteResultat);

  // Le bilan est calculé avec les comptes en solde à dateFin, et un résultat net
  // cumulé depuis le 1er janvier de l'exercice (pas seulement la période).
  const crExercice = computeCompteResultat(
    await getAccountsWithBalances(
      prisma,
      await computeAccountMovements(prisma, tenantId, debutExercice, dateFin)
    )
  );
  const bilan = computeBilan(accountsForBilan, crExercice);

  const totalProduits = compteResultat.produits.reduce((s, p) => s + p.solde, 0);
  const totalCharges = compteResultat.charges.reduce((s, c) => s + c.solde, 0);

  return {
    exercice,
    dateDebut,
    dateFin,
    entryLines,
    bilan,
    compteResultat,
    sig,
    flux,
    payroll,
    indicateurs: {
      totalProduits,
      totalCharges,
      resultatNet: sig.resultat_net,
      tresorerieNette: flux.tresorerie_finale,
    },
  };
}
