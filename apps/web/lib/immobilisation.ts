// Immobilisations amorties : une charge cochée « immobilisation » n'est pas
// passée en classe 6 mais inscrite en classe 2, puis répartie sur N mois par des
// dotations aux amortissements (D 681x / C 28x).
//
// Deux modes de calcul de la dotation mensuelle :
//  - "montant" : montant mensuel fixe saisi par le comptable ;
//  - "taux"    : taux d'amortissement annuel en % (dotation = base × taux / 12).

export type ImmobilisationMode = "montant" | "taux";

export const IMMOBILISATION_MODES: { value: ImmobilisationMode; label: string }[] = [
  { value: "montant", label: "Montant mensuel fixe" },
  { value: "taux", label: "Taux annuel (%)" },
];

export interface AmortissementRow {
  numero: number;
  periodYear: number;
  periodMonth: number;
  dueDate: Date;
  amount: number;
  cumul: number;
  vnc: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/// Dernier jour du mois (date de comptabilisation de la dotation).
function endOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0, 12, 0, 0));
}

/// Dotation mensuelle et durée en mois déduites du mode de calcul.
/// `base` = valeur amortissable (HT de l'immobilisation).
export function computeDotationMensuelle({
  base,
  mode,
  rate,
  monthlyAmount,
  months,
}: {
  base: number;
  mode: ImmobilisationMode;
  rate?: number | null;
  monthlyAmount?: number | null;
  months?: number | null;
}): { monthly: number; months: number } {
  const valeur = Math.max(0, Number(base) || 0);

  if (mode === "taux") {
    const taux = Math.max(0, Number(rate) || 0);
    const monthly = round2((valeur * taux) / 100 / 12);
    // Durée par défaut en amortissement linéaire : 100 / taux années.
    const dureeDefaut = taux > 0 ? Math.round(1200 / taux) : 0;
    return { monthly, months: Math.max(1, Number(months) || dureeDefaut || 1) };
  }

  const monthly = round2(Math.max(0, Number(monthlyAmount) || 0));
  return { monthly, months: Math.max(1, Number(months) || 0) };
}

/// Construit le plan d'amortissement mois par mois. La dernière dotation absorbe
/// l'arrondi pour que le cumul soit exactement égal à la base amortissable ; si la
/// dotation mensuelle solde le bien avant la fin de la durée, le plan s'arrête.
export function buildAmortissementPlan({
  base,
  monthly,
  months,
  startDate,
}: {
  base: number;
  monthly: number;
  months: number;
  startDate: Date;
}): AmortissementRow[] {
  const valeur = round2(Math.max(0, Number(base) || 0));
  const dotation = round2(Math.max(0, Number(monthly) || 0));
  const duree = Math.max(0, Math.floor(months));
  if (valeur <= 0 || dotation <= 0 || duree <= 0) return [];

  const startYear = startDate.getUTCFullYear();
  const startMonth = startDate.getUTCMonth(); // 0-indexé

  const rows: AmortissementRow[] = [];
  let cumul = 0;

  for (let i = 0; i < duree; i++) {
    const reste = round2(valeur - cumul);
    if (reste <= 0) break;
    // La dernière échéance solde le reste (arrondis compris).
    const amount = i === duree - 1 ? reste : Math.min(dotation, reste);
    cumul = round2(cumul + amount);

    const date = endOfMonth(startYear, startMonth + i + 1);
    rows.push({
      numero: i + 1,
      periodYear: date.getUTCFullYear(),
      periodMonth: date.getUTCMonth() + 1,
      dueDate: date,
      amount,
      cumul,
      vnc: round2(valeur - cumul),
    });
  }

  return rows;
}

/// Comptes d'amortissements cumulés candidats pour une immobilisation
/// (SYSCOHADA : 28 + code de l'immobilisation sans son « 2 »,
/// ex. 2441 → 28441), du plus précis au plus général.
export function amortissementAccountCandidates(immoAccountCode: string): string[] {
  const code = String(immoAccountCode || "").trim();
  const reste = code.startsWith("2") ? code.slice(1) : code;
  const candidates: string[] = [];
  for (let len = reste.length; len > 0; len--) {
    candidates.push(`28${reste.slice(0, len)}`);
  }
  candidates.push("28");
  return Array.from(new Set(candidates));
}

/// Comptes de dotations candidats selon la nature de l'immobilisation
/// (6812 incorporelles, 6813 corporelles, 681 par défaut).
export function dotationAccountCandidates(immoAccountCode: string): string[] {
  const prefix2 = String(immoAccountCode || "").slice(0, 2);
  if (["20", "21"].includes(prefix2)) return ["6812", "681"];
  if (["22", "23", "24"].includes(prefix2)) return ["6813", "681"];
  return ["6813", "6812", "681"];
}

export function formatPeriode(year: number, month: number): string {
  return `${String(month).padStart(2, "0")}/${year}`;
}
