// Définitions des lignes OHADA partagées entre l'affichage du rapport
// financier (rapport-client.tsx) et la génération du PDF
// (api/comptabilite/rapport/pdf).

export const SIG_ROWS: { key: string; label: string; isTotal?: boolean }[] = [
  { key: "marge_commerciale", label: "Marge Commerciale" },
  { key: "production", label: "Production de l'exercice" },
  { key: "valeur_ajoutee", label: "Valeur Ajoutée" },
  { key: "ebe", label: "Excédent Brut d'Exploitation (EBE)" },
  { key: "resultat_exploitation", label: "Résultat d'Exploitation" },
  { key: "resultat_financier", label: "Résultat Financier" },
  { key: "rao", label: "Résultat des Activités Ordinaires" },
  { key: "resultat_hao", label: "Résultat HAO" },
  { key: "resultat_net", label: "RÉSULTAT NET", isTotal: true },
];

export const CR_ROWS: { ref: string; label: string; sign: string; note: string; key?: string; isTotal?: boolean }[] = [
  { ref: "TA", label: "Ventes de marchandises", sign: "+", note: "21", key: "ventes_marchandises" },
  { ref: "RA", label: "Achats de marchandises", sign: "-", note: "22", key: "achats_marchandises" },
  { ref: "RB", label: "Variation de stocks de marchandises", sign: "-/+", note: "6", key: "variation_stocks_marchandises" },
  { ref: "XA", label: "MARGE COMMERCIALE", sign: "", note: "", isTotal: true },
  { ref: "TB", label: "Ventes de produits fabriqués", sign: "+", note: "21", key: "ventes_produits" },
  { ref: "TC", label: "Travaux, services vendus", sign: "+", note: "21", key: "travaux_services" },
  { ref: "TD", label: "Produits accessoires", sign: "+", note: "21", key: "produits_accessoires" },
  { ref: "XB", label: "PRODUCTION DE L'EXERCICE", sign: "", note: "", isTotal: true },
  { ref: "TH", label: "Autres produits", sign: "+", note: "21", key: "autres_produits" },
  { ref: "TI", label: "Transferts de charges d'exploitation", sign: "+", note: "12", key: "transferts_charges" },
  { ref: "RC", label: "Achats de matières premières", sign: "-", note: "22", key: "achats_matieres" },
  { ref: "RE", label: "Autres achats", sign: "-", note: "22", key: "autres_achats" },
  { ref: "RG", label: "Transports", sign: "-", note: "23", key: "transports" },
  { ref: "RH", label: "Services extérieurs", sign: "-", note: "24", key: "services_exterieurs" },
  { ref: "RI", label: "Impôts et taxes", sign: "-", note: "25", key: "impots_taxes" },
  { ref: "RJ", label: "Autres charges", sign: "-", note: "26", key: "autres_charges" },
  { ref: "XC", label: "VALEUR AJOUTÉE", sign: "", note: "", isTotal: true },
  { ref: "RK", label: "Charges de personnel", sign: "-", note: "27", key: "charges_personnel" },
  { ref: "RL", label: "Dotations aux amortissements et provisions", sign: "-", note: "3C", key: "dotations_amortissements" },
  { ref: "XE", label: "RÉSULTAT D'EXPLOITATION", sign: "", note: "", isTotal: true },
  { ref: "XF", label: "RÉSULTAT FINANCIER", sign: "", note: "", isTotal: true },
  { ref: "XG", label: "RÉSULTAT DES ACTIVITÉS ORDINAIRES", sign: "", note: "", isTotal: true },
  { ref: "XH", label: "RÉSULTAT HORS ACTIVITÉS ORDINAIRES", sign: "", note: "", isTotal: true },
  { ref: "XI", label: "RÉSULTAT NET DE L'EXERCICE", sign: "", note: "", isTotal: true },
];

export const CR_TOTAL_KEYS: Record<string, string> = {
  XA: "marge_commerciale",
  XB: "production",
  XC: "valeur_ajoutee",
  XD: "ebe",
  XE: "resultat_exploitation",
  XF: "resultat_financier",
  XG: "rao",
  XH: "resultat_hao",
  XI: "resultat_net",
};

export const FLUX_ROWS: { ref: string; label: string; note: string; key: string }[] = [
  { ref: "ZA", label: "Trésorerie nette au 1er janvier", note: "A", key: "tresorerie_initiale" },
  { ref: "ZB", label: "Flux de trésorerie des activités opérationnelles", note: "B", key: "flux_exploitation" },
  { ref: "ZC", label: "Flux de trésorerie des activités d'investissement", note: "C", key: "flux_investissement" },
  { ref: "ZD", label: "Flux de trésorerie du financement par capitaux propres", note: "D", key: "" },
  { ref: "ZE", label: "Flux de trésorerie des capitaux étrangers", note: "E", key: "flux_financement" },
  { ref: "ZF", label: "Variation de trésorerie (ZB+ZC+ZD+ZE)", note: "F", key: "variation_tresorerie" },
  { ref: "ZG", label: "Trésorerie nette à la clôture (ZA+ZF)", note: "G", key: "tresorerie_finale" },
  { ref: "ZH", label: "Trésorerie nette à la clôture (Trésorerie actif - passif)", note: "H", key: "tresorerie_finale" },
];

export const CLASS_LABELS: Record<number, string> = {
  1: "Capitaux",
  2: "Immobilisations",
  3: "Stocks",
  4: "Tiers",
  5: "Financiers",
  6: "Charges",
  7: "Produits",
  8: "Comptes spéciaux",
};
