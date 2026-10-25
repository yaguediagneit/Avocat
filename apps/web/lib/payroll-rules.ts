// ============================================================
// lib/payroll-rules.ts
// Règles de cotisation paramétrables par régime (général / cadre),
// organisme, branche, plafond et période d'effet.
// Base pour remplacer les taux codés en dur du moteur de paie.
// ============================================================

export interface ContributionRule {
  id: string;
  code: string;
  regime: string;
  label: string;
  organism: string | null;
  branch: string | null;
  employeeRate: number;
  employerRate: number;
  monthlyCeiling: number | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  accountEmployee: string | null;
  accountEmployer: string | null;
  isActive: boolean;
}

export interface ContributionResult {
  base: number;
  employeeAmount: number;
  employerAmount: number;
}

/// Récupère les règles actives pour un régime donné à une date donnée.
export async function listActiveContributionRules(
  prisma: any,
  {
    regime,
    at = new Date(),
  }: { regime: string; at?: Date }
): Promise<ContributionRule[]> {
  return prisma.payrollContributionRule.findMany({
    where: {
      isActive: true,
      regime,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
    },
    orderBy: [{ code: "asc" }, { effectiveFrom: "desc" }],
  });
}

/// Calcule les montants salarié / employeur pour une règle et une base.
/// Le plafond mensuel s'applique avant application du taux.
export function calculateContribution(
  rule: Pick<
    ContributionRule,
    "employeeRate" | "employerRate" | "monthlyCeiling"
  >,
  base: number
): ContributionResult {
  const cappedBase =
    rule.monthlyCeiling != null && rule.monthlyCeiling > 0
      ? Math.min(base, rule.monthlyCeiling)
      : base;
  const employeeAmount = Math.round(cappedBase * rule.employeeRate);
  const employerAmount = Math.round(cappedBase * rule.employerRate);
  return { base: cappedBase, employeeAmount, employerAmount };
}

/// Codes de cotisation par défaut pour SYSCOHADA Sénégal.
/// Cette liste doit être surchargée par la table `payroll_contribution_rules`.
export const DEFAULT_CONTRIBUTION_CODES = [
  {
    code: "IPRES_SALARIE",
    regime: "general",
    label: "IPRES retraite — part salarié",
    organism: "IPRES",
    branch: "retraite_obligatoire",
    employeeRate: 0.056,
    employerRate: 0.084,
    monthlyCeiling: null,
    accountEmployee: "4313",
    accountEmployer: "4313",
  },
  {
    code: "CNSS_SALARIE",
    regime: "general",
    label: "CNSS/CSS — part salarié",
    organism: "CNSS",
    branch: "prestations_familiales",
    employeeRate: 0.0,
    employerRate: 0.0,
    monthlyCeiling: null,
    accountEmployee: "4311",
    accountEmployer: "4311",
  },
];
