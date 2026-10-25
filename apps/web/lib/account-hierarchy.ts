// ============================================================
// lib/account-hierarchy.ts
// Distinction des comptes selon leur nature dans le plan SYSCOHADA :
//   - mouvementable : compte sur lequel on passe des écritures
//   - collectif     : compte regroupant des comptes auxiliaires (ex. 411)
//   - auxiliaire    : sous-compte d'un collectif (ex. 41101)
//   - regroupement  : compte de regroupement pour l'affichage
//   - presentation  : compte de présentation des états financiers
// ============================================================

export const ACCOUNT_NATURES = [
  "mouvementable",
  "collectif",
  "auxiliaire",
  "regroupement",
  "presentation",
] as const;

export type AccountNature = (typeof ACCOUNT_NATURES)[number];

export interface AccountWithHierarchy {
  accountCode: string;
  label: string;
  nature: AccountNature | string;
  level: number;
  isAuxiliary: boolean;
  parentId: string | null;
}

/// Détermine la nature comptable d'un compte, en repliant sur level/isAuxiliary
/// si le champ `nature` n'est pas encore renseigné.
export function inferAccountNature(account: Partial<AccountWithHierarchy>): AccountNature {
  const explicit = (account.nature ?? "").trim();
  if (ACCOUNT_NATURES.includes(explicit as AccountNature)) {
    return explicit as AccountNature;
  }

  if (account.isAuxiliary) return "auxiliaire";
  if (account.level != null && account.level > 1) return "auxiliaire";
  if (account.accountCode?.match(/^(10|12|13|14|15|16)[0-9]{1,}$/)) return "presentation";

  return "mouvementable";
}

export function isCollectif(account: Partial<AccountWithHierarchy>): boolean {
  return inferAccountNature(account) === "collectif";
}

export function isAuxiliaire(account: Partial<AccountWithHierarchy>): boolean {
  return inferAccountNature(account) === "auxiliaire";
}

export function isMouvementable(account: Partial<AccountWithHierarchy>): boolean {
  return inferAccountNature(account) === "mouvementable";
}

/// Renvoie le libellé de regroupement pour une nature donnée.
export function natureLabel(nature: string): string {
  switch (nature) {
    case "mouvementable":
      return "Compte mouvementable";
    case "collectif":
      return "Compte collectif";
    case "auxiliaire":
      return "Compte auxiliaire";
    case "regroupement":
      return "Compte de regroupement";
    case "presentation":
      return "Compte de présentation";
    default:
      return nature;
  }
}
