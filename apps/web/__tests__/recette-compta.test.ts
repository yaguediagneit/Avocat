/**
 * Recette du moteur comptable — partie sans base de données.
 * A. Mappings des états (CR / SIG / bilan) sur un grand livre synthétique
 * B. Classification du bilan par signe réel + anomalies de trésorerie
 * C. Invariants structurels du code
 *
 * Convention de `soldeActuel` : pour les comptes ACTIF, + = débiteur ; pour les
 * comptes PASSIF/PRODUIT, + = créditeur (comme computeAccountBalancesAt).
 */
import { describe, test, expect } from "vitest";
import { computeCompteResultat, computeSIG, computeBilan } from "../lib/reporting";

const acc = (accountCode: string, solde: number, cls: number, accountType: string, label = accountCode) => ({
  accountCode, label, soldeActuel: solde, class: cls, accountType,
});

describe("A. Compte de résultat : correspondance comptes → rubriques OHADA", () => {
  test("706 → TC travaux/services vendus ; 707 → TD produits accessoires", () => {
    const { totaux } = computeCompteResultat([
      acc("706", 100000, 7, "PRODUIT"),
      acc("707", 20000, 7, "PRODUIT"),
    ]);
    expect(totaux.travaux_services).toBe(100000);
    expect(totaux.produits_accessoires).toBe(20000);
  });

  test("758/759 → TH autres produits ; 781/787 → TI transferts ; ni l'un ni l'autre ne se confondent", () => {
    const { totaux } = computeCompteResultat([
      acc("758", 15000, 7, "PRODUIT"),
      acc("781", 8000, 7, "PRODUIT"),
    ]);
    expect(totaux.autres_produits).toBe(15000);
    expect(totaux.transferts_charges).toBe(8000);
  });

  test("661/66 → charges de personnel ; 67 → frais financiers ; 681 → dotations", () => {
    const { totaux } = computeCompteResultat([
      acc("661", 50000, 6, "CHARGE"),
      acc("671", 3000, 6, "CHARGE"),
      acc("6813", 10000, 6, "CHARGE"),
    ]);
    expect(totaux.charges_personnel).toBe(50000);
    expect(totaux.frais_financiers).toBe(3000);
    expect(totaux.dotations_amortissements).toBe(10000);
  });

  test("SIG : résultat net = produits − charges − impôts (cohérence interne)", () => {
    const cr = computeCompteResultat([
      acc("706", 100000, 7, "PRODUIT"),
      acc("661", 40000, 6, "CHARGE"),
      acc("622", 10000, 6, "CHARGE"),
    ]);
    const sig = computeSIG(cr);
    expect(sig.resultat_net).toBe(100000 - 50000);
    expect(sig.resultat_exploitation).toBe(sig.resultat_net); // pas de financier/HAO/impôts
  });
});

describe("B. Bilan : classement par signe réel et anomalies", () => {
  // Grand livre équilibré (somme des soldes nets débiteurs − créditeurs = 0)
  const base = [
    acc("411001", 50000, 4, "ACTIF", "Client A"),       // créance client 50 000
    acc("401001", 30000, 4, "PASSIF", "Fournisseur B"), // dette fournisseur 30 000
    acc("52", 100000, 5, "ACTIF", "Banque"),
    acc("57", 20000, 5, "ACTIF", "Caisse"),
    acc("101", 80000, 1, "PASSIF", "Capital"),          // capitaux propres 80 000
    acc("706", 60000, 7, "PRODUIT"),                    // résultat +60 000
  ];

  test("bilan équilibré : actif = passif + résultat, écart nul", () => {
    const cr = computeCompteResultat(base);
    const b = computeBilan(base, cr);
    expect(b.ecart).toBe(0);
    expect(b.totalActif).toBe(170000);
    expect(b.resultatNet).toBe(60000);
  });

  test("résultat net intégré une seule fois dans les capitaux propres", () => {
    const b = computeBilan(base, computeCompteResultat(base));
    expect(b.capitauxPropres.filter((a) => a.accountCode === "131")).toHaveLength(1);
    expect(b.capitauxPropres.find((a) => a.accountCode === "131")!.solde).toBe(60000);
  });

  test("tiers par signe : fournisseur débiteur → actif ; client créditeur (avance reçue) → passif", () => {
    const data = [
      ...base,
      acc("401002", -5000, 4, "PASSIF", "Avance versée fournisseur"),
      acc("411002", -12000, 4, "ACTIF", "Avance reçue client"),
    ];
    const b = computeBilan(data, computeCompteResultat(data));
    expect(b.actifCirculant.map((a) => a.accountCode)).toContain("401002");
    expect(b.actifCirculant.find((a) => a.accountCode === "401002")!.solde).toBe(5000);
    expect(b.passifCirculant.map((a) => a.accountCode)).toContain("411002");
    expect(b.passifCirculant.find((a) => a.accountCode === "411002")!.solde).toBe(12000);
    // l'écart bouge avec les soldes, mais le reclassement est visible des deux côtés
  });

  test("banque négative → trésorerie-passif (découvert légitime)", () => {
    // Grand livre équilibré avec découvert 40 000 : capital ramené à −60 000 (pertes)
    const data = [
      acc("411001", 50000, 4, "ACTIF", "Client A"),
      acc("401001", 30000, 4, "PASSIF", "Fournisseur B"),
      acc("52", -40000, 5, "ACTIF", "Banque"),
      acc("57", 20000, 5, "ACTIF", "Caisse"),
      acc("101", -60000, 1, "PASSIF", "Capital"),
      acc("706", 60000, 7, "PRODUIT"),
    ];
    const b = computeBilan(data, computeCompteResultat(data));
    expect(b.tresoreriePassif).toHaveLength(1);
    expect(b.tresoreriePassif[0].solde).toBe(40000);
    expect(b.ecart).toBe(0);
  });

  test("caisse négative → reste à l'actif, signalée ANOMALIE, jamais déguisée en découvert", () => {
    // Grand livre équilibré avec caisse créditrice 5 000 : capital = 55 000
    const data = [
      acc("411001", 50000, 4, "ACTIF", "Client A"),
      acc("401001", 30000, 4, "PASSIF", "Fournisseur B"),
      acc("52", 100000, 5, "ACTIF", "Banque"),
      acc("57", -5000, 5, "ACTIF", "Caisse"),
      acc("101", 55000, 1, "PASSIF", "Capital"),
      acc("706", 60000, 7, "PRODUIT"),
    ];
    const b = computeBilan(data, computeCompteResultat(data));
    const caisse = b.tresorerieActif.find((a) => a.accountCode === "57");
    expect(caisse).toBeDefined();
    expect(caisse!.solde).toBe(-5000);
    expect(caisse!.label).toContain("ANOMALIE");
    expect(b.tresoreriePassif.map((a) => a.accountCode)).not.toContain("57");
    expect(b.ecart).toBe(0);
  });
});

describe("C. Invariants structurels (code, pas données)", () => {
  test("la contre-passation existe et garantit l'idempotence par clé dédiée", async () => {
    const src = await import("../lib/accounting");
    expect(typeof src.reverseAccountingEntry).toBe("function");
    const code = (src.reverseAccountingEntry as Function).toString();
    expect(code).toContain("-ANN");
    expect(code).toContain("reversal-");
  });
});
