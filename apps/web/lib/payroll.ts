export interface PayrollRubricInput {
  id: string;
  code: string;
  label: string;
  type: "gain" | "deduction" | "cotisation";
  calcType: "fixed" | "percent_base" | "percent_gross";
  rateOrAmount: number;
  sortOrder: number;
}

export interface ComputedPayrollLine {
  rubricId: string;
  rubricCode: string;
  rubricLabel: string;
  rubricType: string;
  calcType: string;
  rateOrAmount: number;
  baseAmount: number;
  computedAmount: number;
  sortOrder: number;
}

import { calculateContribution, type ContributionRule } from "./payroll-rules";

export interface ComputedPayroll {
  baseSalary: number;
  grossSalary: number;
  totalGains: number;
  totalDeductions: number;
  totalCotisations: number;
  cssBase: number;
  cssRate: number;
  cssAmount: number;
  cssEmployerAmount: number;
  ipresBase: number;
  ipresRate: number;
  ipresAmount: number;
  ipresEmployerAmount: number;
  irppTaxableBase: number;
  irppShares: number;
  irppAmount: number;
  netSalary: number;
  totalEmployerCost: number;
  lines: ComputedPayrollLine[];
}

export function computeTaxShares(maritalStatus: string, nbChildren: number): number {
  let shares = 1.0;
  if (maritalStatus === "married") shares += 0.5;
  shares += nbChildren / 2;
  return Math.min(shares, 5.0);
}

export function computeIRPP(monthlyTaxableBase: number, taxShares: number): number {
  const annual = monthlyTaxableBase * 12;
  const allowance = Math.max(0, Math.min(900000, annual * 0.3));
  const net = Math.max(0, annual - allowance);
  const quotient = taxShares > 0 ? net / taxShares : net;

  const brackets = [
    { min: 0, max: 630000, rate: 0 },
    { min: 630000, max: 1500000, rate: 0.2 },
    { min: 1500000, max: 4000000, rate: 0.3 },
    { min: 4000000, max: 8000000, rate: 0.35 },
    { min: 8000000, max: 13500000, rate: 0.37 },
    { min: 13500000, max: Infinity, rate: 0.4 },
  ];

  let taxPerShare = 0;
  for (const b of brackets) {
    if (quotient <= b.min) break;
    const taxable = Math.min(quotient, b.max) - b.min;
    if (taxable > 0) taxPerShare += taxable * b.rate;
  }

  const annualTax = taxPerShare * taxShares;
  return Math.round(annualTax / 12);
}

function findContributionRule(
  rules: ContributionRule[] | undefined,
  keywords: string[]
): ContributionRule | undefined {
  if (!rules) return undefined;
  const upper = (s: string) => s.toUpperCase();
  return rules.find((r) =>
    keywords.some(
      (k) =>
        upper(r.code).includes(upper(k)) ||
        upper(r.organism || "").includes(upper(k)) ||
        upper(r.branch || "").includes(upper(k))
    )
  );
}

export function computePayroll(
  baseSalary: number,
  maritalStatus: string,
  nbChildren: number,
  cssRate: number,
  ipresRate: number,
  ipresEmployerRate: number,
  rubrics: PayrollRubricInput[],
  taxSharesOverride?: number,
  contributionRules?: ContributionRule[]
): ComputedPayroll {
  const taxShares =
    taxSharesOverride && taxSharesOverride > 0
      ? Math.min(taxSharesOverride, 5.0)
      : computeTaxShares(maritalStatus, nbChildren);

  let totalGains = 0;
  let totalDeductions = 0;
  let totalCotisations = 0;

  const lines: ComputedPayrollLine[] = [];

  // First pass: fixed and percent_base
  for (const r of rubrics.sort((a, b) => a.sortOrder - b.sortOrder)) {
    let baseAmount = 0;
    let computed = 0;

    if (r.calcType === "fixed") {
      computed = r.rateOrAmount;
    } else if (r.calcType === "percent_base") {
      baseAmount = baseSalary;
      computed = Math.round((baseSalary * r.rateOrAmount) / 100);
    } else {
      // percent_gross computed later
    }

    if (r.type === "gain" && r.calcType !== "percent_gross") totalGains += computed;
    if (r.type === "deduction" && r.calcType !== "percent_gross") totalDeductions += computed;
    if (r.type === "cotisation" && r.calcType !== "percent_gross") totalCotisations += computed;

    lines.push({
      rubricId: r.id,
      rubricCode: r.code,
      rubricLabel: r.label,
      rubricType: r.type,
      calcType: r.calcType,
      rateOrAmount: r.rateOrAmount,
      baseAmount,
      computedAmount: computed,
      sortOrder: r.sortOrder,
    });
  }

  const grossSalary = baseSalary + totalGains;

  // Second pass: percent_gross
  for (const l of lines) {
    if (l.calcType === "percent_gross") {
      l.baseAmount = grossSalary;
      l.computedAmount = Math.round((grossSalary * l.rateOrAmount) / 100);
      if (l.rubricType === "gain") totalGains += l.computedAmount;
      if (l.rubricType === "deduction") totalDeductions += l.computedAmount;
      if (l.rubricType === "cotisation") totalCotisations += l.computedAmount;
    }
  }

  const cssBase = grossSalary;
  const ipresBase = grossSalary;

  const cssRule = findContributionRule(contributionRules, ["CSS", "CNSS"]);
  const ipresRule = findContributionRule(contributionRules, ["IPRES"]);

  const cssCalc = cssRule
    ? calculateContribution(cssRule, cssBase)
    : { base: cssBase, employeeAmount: Math.round((cssBase * cssRate) / 100), employerAmount: 0 };
  const cssAmount = cssCalc.employeeAmount;
  const cssEmployerAmount = cssRule ? cssCalc.employerAmount : cssAmount;
  const cssRateUsed = cssRule ? cssRule.employeeRate * 100 : cssRate;

  const ipresCalc = ipresRule
    ? calculateContribution(ipresRule, ipresBase)
    : { base: ipresBase, employeeAmount: Math.round((ipresBase * ipresRate) / 100), employerAmount: 0 };
  const ipresAmount = ipresCalc.employeeAmount;
  const ipresEmployerAmount = ipresRule ? ipresCalc.employerAmount : Math.round((ipresBase * ipresEmployerRate) / 100);
  const ipresRateUsed = ipresRule ? ipresRule.employeeRate * 100 : ipresRate;

  const irppTaxableBase = Math.max(0, grossSalary - totalCotisations - cssAmount - ipresAmount);
  const irppAmount = computeIRPP(irppTaxableBase, taxShares);

  const netSalary = Math.max(
    0,
    grossSalary - totalDeductions - totalCotisations - cssAmount - ipresAmount - irppAmount
  );
  const totalEmployerCost = grossSalary + cssEmployerAmount + ipresEmployerAmount;

  return {
    baseSalary,
    grossSalary,
    totalGains,
    totalDeductions,
    totalCotisations,
    cssBase,
    cssRate: cssRateUsed,
    cssAmount,
    cssEmployerAmount,
    ipresBase,
    ipresRate: ipresRateUsed,
    ipresAmount,
    ipresEmployerAmount,
    irppTaxableBase,
    irppShares: taxShares,
    irppAmount,
    netSalary,
    totalEmployerCost,
    lines,
  };
}
