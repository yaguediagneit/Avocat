"use client";

import { useEffect, useRef, useState } from "react";
import { SIG_ROWS, CR_ROWS, CR_TOTAL_KEYS, FLUX_ROWS } from "@/lib/report-rows";
import { PaginatedRows } from "@/components/pagination";

interface CabinetInfo {
  raisonSociale: string;
  description: string;
  logoUrl: string;
  adresse: string;
  identifiantFiscal: string;
  identificationLegale: string;
  telephonePrincipal: string;
  telephoneSecondaire: string;
  email: string;
  siteWeb: string;
}

interface PlanComptableEntry {
  classe: number;
  label: string;
  nombre: number;
  soldeTotal: number;
}

interface JournalStat {
  code: string;
  libelle: string;
  nbEcritures: number;
  totalDebit: number;
  totalCredit: number;
}

interface Props {
  report: any;
  exercice: number;
  cabinet: CabinetInfo;
  userName: string;
  isAdmin: boolean;
  planComptable: PlanComptableEntry[];
  journalStats: JournalStat[];
}

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}


export default function RapportClient({ report, exercice, cabinet, userName, isAdmin, planComptable, journalStats }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const [exporting, setExporting] = useState(false);
  const [mode, setMode] = useState<string | null>(null);

  const handlePrint = async (selectedMode: string) => {
    setMode(selectedMode);
    setExporting(true);
    try {
      const periodParams =
        typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "";
      const base = `/api/comptabilite/rapport/pdf?exercice=${exercice}&mode=${encodeURIComponent(selectedMode)}`;
      const res = await fetch(
        periodParams ? `${base}&${periodParams}` : base
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Erreur lors de la génération du PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      alert("Erreur réseau lors de la génération du PDF");
    } finally {
      setExporting(false);
      setMode(null);
    }
  };

  const sig = report.sig;
  const t = report.compteResultat.totaux;
  const bilan = report.bilan;
  const flux = report.flux;
  const payroll = report.payroll;
  const ind = report.indicateurs;
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const d = new Date();
    setNow(d);
  }, []);
  const dateGeneree = now ? now.toLocaleDateString("fr-FR") : "";
  const heureGeneree = now ? now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  const totalDebit = report.entryLines.reduce((s: number, l: any) => s + l.debit, 0);
  const totalCredit = report.entryLines.reduce((s: number, l: any) => s + l.credit, 0);

  return (
    <div ref={printRef} className="space-y-5 print:space-y-0">
      {/* Actions */}
      <div className="flex flex-wrap justify-end gap-2 print:hidden">
        <button
          onClick={() => handlePrint("detaille")}
          disabled={exporting}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {exporting && mode === "detaille" ? "Génération..." : "Rapport PDF Détaillé"}
        </button>
        <button
          onClick={() => handlePrint("sans-tiers")}
          disabled={exporting}
          className="rounded-md bg-cabinet-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-cabinet-800 disabled:opacity-60"
        >
          {exporting && mode === "sans-tiers" ? "Génération..." : "Rapport PDF Sans Tiers"}
        </button>
        <button
          onClick={() => handlePrint("reduit")}
          disabled={exporting}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {exporting && mode === "reduit" ? "Génération..." : "Rapport PDF Réduit"}
        </button>
      </div>

      {/* ===== COVER PAGE (print only) ===== */}
      <div className="hidden print:block print-cover">
        <div className="flex flex-col items-center justify-center min-h-[230mm] text-center">
          {cabinet.logoUrl && (
            <img src={cabinet.logoUrl} alt="" className="h-24 w-24 mb-6 object-contain" />
          )}
          <h1 className="text-2xl font-bold uppercase text-cabinet-900">{cabinet.raisonSociale}</h1>
          {cabinet.adresse && <p className="mt-2 text-sm text-gray-600">{cabinet.adresse}</p>}
          <p className="mt-1 text-sm text-gray-600">
            {cabinet.telephonePrincipal && `+221${cabinet.telephonePrincipal}`}
            {cabinet.email && ` | ${cabinet.email}`}
          </p>
          <div className="mt-12 border-t border-b border-cabinet-300 py-6">
            <h2 className="text-xl font-semibold text-cabinet-800">RAPPORT DE COMPTABILITÉ</h2>
            <p className="mt-2 text-lg text-cabinet-700">EXERCICE {exercice}</p>
          </div>
          <p className="mt-8 text-sm text-gray-600">Généré le {dateGeneree} à  {heureGeneree}</p>
          <p className="mt-1 text-sm text-gray-600">Par {userName}</p>
        </div>
      </div>

      {/*
        Mise en page imprimable : le tableau englobant permet au navigateur de
        répéter nativement l'en-tête (thead) et le pied de page (tfoot) sur
        chaque page, sans jamais recouvrir le contenu.
      */}
      <table className="print-layout">
        <thead className="print-layout-head">
          <tr>
            <td>
              <div className="hidden print:block print-header">
                <div className="flex items-center justify-between border-b border-cabinet-300 pb-2">
                  <div className="flex items-center gap-3">
                    {cabinet.logoUrl && (
                      <img src={cabinet.logoUrl} alt="" className="h-10 w-10 object-contain" />
                    )}
                    <div>
                      <p className="text-xs font-bold text-cabinet-900">{cabinet.raisonSociale}</p>
                      <p className="text-[8pt] text-gray-500">{cabinet.description}</p>
                    </div>
                  </div>
                  <p className="text-[8pt] text-gray-500">Exercice {exercice}</p>
                </div>
              </div>
            </td>
          </tr>
        </thead>
        <tfoot className="print-layout-foot">
          <tr>
            <td>
              <div className="hidden print:block print-footer">
                <div className="border-t border-gray-300 pt-1 text-[7pt] text-gray-500">
                  <div className="flex flex-wrap justify-center gap-x-3">
                    {cabinet.adresse && <span>{cabinet.adresse}</span>}
                    {(cabinet.telephonePrincipal || cabinet.telephoneSecondaire) && (
                      <span>
                        Tél. {cabinet.telephonePrincipal}
                        {cabinet.telephoneSecondaire && ` / ${cabinet.telephoneSecondaire}`}
                      </span>
                    )}
                    {cabinet.email && <span>{cabinet.email}</span>}
                  </div>
                  <div className="flex flex-wrap justify-center gap-x-3">
                    {cabinet.identificationLegale && <span>{cabinet.identificationLegale}</span>}
                    {cabinet.identifiantFiscal && <span>N° fiscal : {cabinet.identifiantFiscal}</span>}
                    {cabinet.siteWeb && <span>{cabinet.siteWeb}</span>}
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td>
              <div className="print-body space-y-5 print:space-y-0">

      {/* ===== 1. TABLEAU DE BORD ===== */}
      <section className="print-section rounded-lg border border-gray-200 bg-white p-5 shadow-sm print:shadow-none print:border-cabinet-200">
        <h2 className="print-section-title mb-4 border-b border-gray-100 pb-2 text-lg font-semibold text-cabinet-800">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-cabinet-700 text-xs text-white print-badge">1</span>
          Tableau de Bord
        </h2>
        <p className="mb-4 text-sm text-gray-500 print:hidden">Indicateurs clés de l&apos;exercice</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 print:grid-cols-3">
          <div className="rounded-lg border border-gray-100 p-3 text-center">
            <p className="text-xs text-gray-500">Total Produits</p>
            <p className="mt-1 text-lg font-bold text-emerald-600">{fmt(ind.totalProduits)} F</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-3 text-center">
            <p className="text-xs text-gray-500">Total Charges</p>
            <p className="mt-1 text-lg font-bold text-red-600">{fmt(ind.totalCharges)} F</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-3 text-center">
            <p className="text-xs text-gray-500">Résultat Net</p>
            <p className={`mt-1 text-lg font-bold ${ind.resultatNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {fmt(ind.resultatNet)} F
            </p>
          </div>
          <div className="rounded-lg border border-gray-100 p-3 text-center">
            <p className="text-xs text-gray-500">Total Écritures</p>
            <p className="mt-1 text-lg font-bold text-cabinet-700">{report.entryLines.length}</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-3 text-center">
            <p className="text-xs text-gray-500">Total Débit</p>
            <p className="mt-1 text-lg font-bold text-cabinet-700">{fmt(totalDebit)} F</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-3 text-center">
            <p className="text-xs text-gray-500">Total Crédit</p>
            <p className="mt-1 text-lg font-bold text-cabinet-700">{fmt(totalCredit)} F</p>
          </div>
        </div>
      </section>

      <div className="print-spacer" />
      {/* ===== 2. PLAN COMPTABLE ===== */}
      <section className="print-section rounded-lg border border-gray-200 bg-white p-5 shadow-sm print:shadow-none print:border-cabinet-200">
        <h2 className="print-section-title mb-4 border-b border-gray-100 pb-2 text-lg font-semibold text-cabinet-800">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-cabinet-700 text-xs text-white print-badge">2</span>
          Plan Comptable
        </h2>
        <p className="mb-3 text-sm text-gray-500 print:hidden">Répartition des comptes par classe</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
              <th className="py-2">Classe</th>
              <th className="py-2 text-right">Nombre de Comptes</th>
              <th className="py-2 text-right">Solde Total</th>
            </tr>
          </thead>
          <tbody>
            <PaginatedRows colSpan={3}>
            {planComptable.map((p) => (
              <tr key={p.classe} className="border-b border-gray-50">
                <td className="py-1.5 text-xs">{p.label}</td>
                <td className="py-1.5 text-right text-xs">{p.nombre}</td>
                <td className="py-1.5 text-right text-xs">{fmt(p.soldeTotal)} F</td>
              </tr>
            ))}
            </PaginatedRows>
          </tbody>
        </table>
      </section>

      <div className="print-spacer" />
      {/* ===== 3. JOURNAUX ===== */}
      <section className="print-section rounded-lg border border-gray-200 bg-white p-5 shadow-sm print:shadow-none print:border-cabinet-200">
        <h2 className="print-section-title mb-4 border-b border-gray-100 pb-2 text-lg font-semibold text-cabinet-800">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-cabinet-700 text-xs text-white print-badge">3</span>
          Journaux
        </h2>
        <p className="mb-3 text-sm text-gray-500 print:hidden">Récapitulatif par journal</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
              <th className="py-2">Journal</th>
              <th className="py-2 text-right">Écritures</th>
              <th className="py-2 text-right">Total Débit</th>
              <th className="py-2 text-right">Total Crédit</th>
            </tr>
          </thead>
          <tbody>
            <PaginatedRows colSpan={4}>
            {journalStats.map((j) => (
              <tr key={j.code} className="border-b border-gray-50">
                <td className="py-1.5 text-xs">{j.code} - {j.libelle}</td>
                <td className="py-1.5 text-right text-xs">{j.nbEcritures} écriture{j.nbEcritures > 1 ? "s" : ""}</td>
                <td className="py-1.5 text-right text-xs">{fmt(j.totalDebit)} F</td>
                <td className="py-1.5 text-right text-xs">{fmt(j.totalCredit)} F</td>
              </tr>
            ))}
            </PaginatedRows>
          </tbody>
        </table>
      </section>

      <div className="print-spacer" />
      {/* ===== 4. BILAN COMPTABLE ===== */}
      <section className="print-section print-allow-break rounded-lg border border-gray-200 bg-white p-5 shadow-sm print:shadow-none print:border-cabinet-200">
        <h2 className="print-section-title mb-4 border-b border-gray-100 pb-2 text-lg font-semibold text-cabinet-800">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-cabinet-700 text-xs text-white print-badge">4</span>
          Bilan Comptable
        </h2>
        <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2">
          {/* ACTIF */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-cabinet-700">ACTIF</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-1">Compte</th>
                  <th className="py-1">Libellé</th>
                  <th className="py-1 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                <PaginatedRows colSpan={3}>
                {bilan.actifImmobilisations.length > 0 && (
                  <tr className="bg-gray-50 print:bg-gray-100">
                    <td colSpan={3} className="py-1.5 text-xs font-semibold text-gray-700">ACTIF IMMOBILISÉ</td>
                  </tr>
                )}
                {bilan.actifImmobilisations.map((a: any) => (
                  <tr key={a.accountCode} className="border-b border-gray-50">
                    <td className="py-1.5 font-mono text-xs">{a.accountCode}</td>
                    <td className="py-1.5 text-xs">{a.label.substring(0, 35)}</td>
                    <td className="py-1.5 text-right text-xs">{fmt(a.solde)} F</td>
                  </tr>
                ))}
                {bilan.actifCirculant.length > 0 && (
                  <tr className="bg-gray-50 print:bg-gray-100">
                    <td colSpan={3} className="py-1.5 text-xs font-semibold text-gray-700">ACTIF CIRCULANT</td>
                  </tr>
                )}
                {bilan.actifCirculant.map((a: any) => (
                  <tr key={a.accountCode} className="border-b border-gray-50">
                    <td className="py-1.5 font-mono text-xs">{a.accountCode}</td>
                    <td className="py-1.5 text-xs">{a.label.substring(0, 35)}</td>
                    <td className="py-1.5 text-right text-xs">{fmt(a.solde)} F</td>
                  </tr>
                ))}
                {bilan.tresorerieActif.length > 0 && (
                  <tr className="bg-gray-50 print:bg-gray-100">
                    <td colSpan={3} className="py-1.5 text-xs font-semibold text-gray-700">TRÉSORERIE - ACTIF</td>
                  </tr>
                )}
                {bilan.tresorerieActif.map((a: any) => (
                  <tr key={a.accountCode} className="border-b border-gray-50">
                    <td className="py-1.5 font-mono text-xs">{a.accountCode}</td>
                    <td className="py-1.5 text-xs">{a.label.substring(0, 35)}</td>
                    <td className="py-1.5 text-right text-xs">{fmt(a.solde)} F</td>
                  </tr>
                ))}
                </PaginatedRows>
                <tr className="border-t-2 border-cabinet-200 bg-cabinet-50 font-bold">
                  <td className="py-2" colSpan={2}>TOTAL ACTIF</td>
                  <td className="py-2 text-right">{fmt(bilan.totalActif)} F</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* PASSIF */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-red-700">PASSIF</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-1">Compte</th>
                  <th className="py-1">Libellé</th>
                  <th className="py-1 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                <PaginatedRows colSpan={3}>
                {bilan.capitauxPropres.length > 0 && (
                  <tr className="bg-gray-50 print:bg-gray-100">
                    <td colSpan={3} className="py-1.5 text-xs font-semibold text-gray-700">CAPITAUX PROPRES</td>
                  </tr>
                )}
                {bilan.capitauxPropres.map((p: any) => (
                  <tr key={p.accountCode} className="border-b border-gray-50">
                    <td className="py-1.5 font-mono text-xs">{p.accountCode}</td>
                    <td className="py-1.5 text-xs">{p.label.substring(0, 35)}</td>
                    <td className="py-1.5 text-right text-xs">{fmt(p.solde)} F</td>
                  </tr>
                ))}
                {bilan.passifCirculant.length > 0 && (
                  <tr className="bg-gray-50 print:bg-gray-100">
                    <td colSpan={3} className="py-1.5 text-xs font-semibold text-gray-700">PASSIF CIRCULANT</td>
                  </tr>
                )}
                {bilan.passifCirculant.map((p: any) => (
                  <tr key={p.accountCode} className="border-b border-gray-50">
                    <td className="py-1.5 font-mono text-xs">{p.accountCode}</td>
                    <td className="py-1.5 text-xs">{p.label.substring(0, 35)}</td>
                    <td className="py-1.5 text-right text-xs">{fmt(p.solde)} F</td>
                  </tr>
                ))}
                {bilan.tresoreriePassif.length > 0 && (
                  <tr className="bg-gray-50 print:bg-gray-100">
                    <td colSpan={3} className="py-1.5 text-xs font-semibold text-gray-700">TRÉSORERIE - PASSIF</td>
                  </tr>
                )}
                {bilan.tresoreriePassif.map((p: any) => (
                  <tr key={p.accountCode} className="border-b border-gray-50">
                    <td className="py-1.5 font-mono text-xs">{p.accountCode}</td>
                    <td className="py-1.5 text-xs">{p.label.substring(0, 35)}</td>
                    <td className="py-1.5 text-right text-xs">{fmt(p.solde)} F</td>
                  </tr>
                ))}
                </PaginatedRows>
                <tr className="border-t-2 border-red-200 bg-red-50 font-bold">
                  <td className="py-2" colSpan={2}>TOTAL PASSIF</td>
                  <td className="py-2 text-right">{fmt(bilan.totalPassif)} F</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="print-spacer" />
      {/* ===== 5. JOURNAL DES ÉCRITURES ===== */}
      <section className="print-section print-page-start print-allow-break rounded-lg border border-gray-200 bg-white p-5 shadow-sm print:shadow-none print:border-cabinet-200">
        <h2 className="print-section-title mb-4 border-b border-gray-100 pb-2 text-lg font-semibold text-cabinet-800">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-cabinet-700 text-xs text-white print-badge">5</span>
          Journal des Écritures
        </h2>
        <p className="mb-3 text-sm text-gray-500 print:hidden">Détail des lignes d&apos;écritures de l&apos;exercice</p>
        <div className="max-h-96 overflow-y-auto print:max-h-none print:overflow-visible">
          {report.entryLines.length === 0 ? (
            <p className="py-4 text-sm text-gray-500">Aucune écriture pour la période.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 print:static">
                <tr className="text-left border-b border-gray-200">
                  <th className="px-2 py-2 font-medium text-gray-600 text-xs">Date</th>
                  <th className="px-2 py-2 font-medium text-gray-600 text-xs">Compte</th>
                  <th className="px-2 py-2 font-medium text-gray-600 text-xs">Tier</th>
                  <th className="px-2 py-2 font-medium text-gray-600 text-xs">Libellé</th>
                  <th className="px-2 py-2 text-right font-medium text-gray-600 text-xs">Débit</th>
                  <th className="px-2 py-2 text-right font-medium text-gray-600 text-xs">Crédit</th>
                </tr>
              </thead>
              <tbody>
                <PaginatedRows colSpan={6}>
                {report.entryLines.map((l: any, i: number) => {
                  const prev = i > 0 ? report.entryLines[i - 1] : null;
                  const showDate = !prev || prev.entry_id !== l.entry_id;
                  return (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-2 py-1.5 text-xs text-gray-600">
                        {showDate ? fmtDate(l.entry_date) : ""}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs">{l.account_code}</td>
                      <td className="px-2 py-1.5 text-xs">
                        {l.tiers_label || l.account_label || "—"}
                      </td>
                      <td className="px-2 py-1.5 text-xs">
                        {(l.libelle || l.entry_libelle || "").substring(0, 40)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs">
                        {l.debit > 0 ? fmt(l.debit) + " F" : ""}
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs">
                        {l.credit > 0 ? fmt(l.credit) + " F" : ""}
                      </td>
                    </tr>
                  );
                })}
                </PaginatedRows>
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="print-spacer" />
      {/* ===== 6. COMPTE DE RÉSULTAT OHADA ===== */}
      <section className="print-section rounded-lg border border-gray-200 bg-white p-5 shadow-sm print:shadow-none print:border-cabinet-200">
        <h2 className="print-section-title mb-2 border-b border-gray-100 pb-2 text-lg font-semibold text-cabinet-800">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-cabinet-700 text-xs text-white print-badge">6</span>
          Compte de Résultat
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          Période du {fmtDate(report.dateDebut)} au {fmtDate(report.dateFin)}
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
              <th className="py-1">Ref</th>
              <th className="py-1">Libellé</th>
              <th className="py-1 text-center">+/-</th>
              <th className="py-1 text-center">Note</th>
              <th className="py-1 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            <PaginatedRows colSpan={5}>
            {CR_ROWS.map((row) => {
              const value = row.key ? t[row.key] : sig[CR_TOTAL_KEYS[row.ref]] || 0;
              return (
                <tr
                  key={row.ref}
                  className={`border-b border-gray-50 ${row.isTotal ? "bg-amber-50 font-bold" : ""}`}
                >
                  <td className="py-1.5 font-mono text-xs">{row.ref}</td>
                  <td className="py-1.5 text-xs">{row.label}</td>
                  <td className="py-1.5 text-center text-xs">{row.sign}</td>
                  <td className="py-1.5 text-center text-xs">{row.note}</td>
                  <td className="py-1.5 text-right text-xs">{fmt(value)} F</td>
                </tr>
              );
            })}
            </PaginatedRows>
          </tbody>
        </table>
      </section>

      <div className="print-spacer" />
      {/* ===== 7. SIG ===== */}
      <section className="print-section rounded-lg border border-gray-200 bg-white p-5 shadow-sm print:shadow-none print:border-cabinet-200">
        <h2 className="print-section-title mb-4 border-b border-gray-100 pb-2 text-lg font-semibold text-cabinet-800">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-cabinet-700 text-xs text-white print-badge">7</span>
          Soldes Intermédiaires de Gestion
        </h2>
        <p className="mb-3 text-sm text-gray-500 print:hidden">Analyse de la performance</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
              <th className="py-1">Indicateur</th>
              <th className="py-1 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            <PaginatedRows colSpan={2}>
            {SIG_ROWS.map((row) => (
              <tr
                key={row.key}
                className={`border-b border-gray-50 ${row.isTotal ? "bg-amber-50 font-bold" : ""}`}
              >
                <td className="py-1.5 text-xs">{row.label}</td>
                <td className="py-1.5 text-right text-xs">{fmt(sig[row.key])} F</td>
              </tr>
            ))}
            </PaginatedRows>
          </tbody>
        </table>
      </section>

      <div className="print-spacer" />
      {/* ===== 8. FLUX DE TRÉSORERIE ===== */}
      <section className="print-section rounded-lg border border-gray-200 bg-white p-5 shadow-sm print:shadow-none print:border-cabinet-200">
        <h2 className="print-section-title mb-2 border-b border-gray-100 pb-2 text-lg font-semibold text-cabinet-800">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-cabinet-700 text-xs text-white print-badge">8</span>
          Tableau des Flux de Trésorerie
        </h2>
        <p className="mb-4 text-xs text-gray-500">Selon le modèle OHADA</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
              <th className="py-1">Ref</th>
              <th className="py-1">Libellé</th>
              <th className="py-1 text-center">Note</th>
              <th className="py-1 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            <PaginatedRows colSpan={4}>
            {FLUX_ROWS.map((row) => {
              const value = row.key ? flux[row.key] : 0;
              return (
                <tr key={row.ref} className="border-b border-gray-50 bg-blue-50/30 font-medium">
                  <td className="py-1.5 font-mono text-xs">{row.ref}</td>
                  <td className="py-1.5 text-xs">{row.label}</td>
                  <td className="py-1.5 text-center text-xs">{row.note}</td>
                  <td className="py-1.5 text-right text-xs">{fmt(value)} F</td>
                </tr>
              );
            })}
            </PaginatedRows>
          </tbody>
        </table>
      </section>

      <div className="print-spacer" />
      {/* ===== 9. PAIE ET CHARGES SOCIALES ===== */}
      <section className="print-section print-page-start rounded-lg border border-gray-200 bg-white p-5 shadow-sm print:shadow-none print:border-cabinet-200">
        <h2 className="print-section-title mb-4 border-b border-gray-100 pb-2 text-lg font-semibold text-cabinet-800">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-cabinet-700 text-xs text-white print-badge">9</span>
          Paie et Charges Sociales (SYSCOHADA Révisé)
        </h2>
        {payroll.employee_count > 0 ? (
          <div className="space-y-5">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Synthèse de la paie</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 print:grid-cols-3">
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Total Salaires Bruts</p>
                <p className="mt-1 text-lg font-bold text-cabinet-700">{fmt(payroll.total_gross_salary)} F</p>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Total Salaires Nets</p>
                <p className="mt-1 text-lg font-bold text-emerald-600">{fmt(payroll.total_net_salary)} F</p>
              </div>
              <div className="rounded-lg border border-gray-100 p-3">
                <p className="text-xs text-gray-500">Coût Total Employeur<br />hors assurance</p>
                <p className="mt-1 text-lg font-bold text-red-600">{fmt(payroll.total_employer_charges)} F</p>
              </div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Détail des charges sociales</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                    <th className="py-1">Type</th>
                    <th className="py-1 text-right">Part Salarié</th>
                    <th className="py-1 text-right">Part Patronale</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-50">
                    <td className="py-1.5 text-xs">IPRES (Compte 4313)</td>
                    <td className="py-1.5 text-right text-xs">{fmt(payroll.total_ipres_employee)} F</td>
                    <td className="py-1.5 text-right text-xs">{fmt(payroll.total_ipres_employer)} F</td>
                    <td className="py-1.5 text-right text-xs font-bold">{fmt(payroll.total_ipres_employee + payroll.total_ipres_employer)} F</td>
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="py-1.5 text-xs">CSS (Compte 4311)</td>
                    <td className="py-1.5 text-right text-xs">{fmt(payroll.total_css_employee)} F</td>
                    <td className="py-1.5 text-right text-xs">{fmt(payroll.total_css_employer)} F</td>
                    <td className="py-1.5 text-right text-xs font-bold">{fmt(payroll.total_css_employee + payroll.total_css_employer)} F</td>
                  </tr>
                  <tr className="border-b border-gray-50">
                    <td className="py-1.5 text-xs">IRPP (Compte 447)</td>
                    <td className="py-1.5 text-right text-xs">{fmt(payroll.total_irpp)} F</td>
                    <td className="py-1.5 text-right text-xs">—</td>
                    <td className="py-1.5 text-right text-xs font-bold">{fmt(payroll.total_irpp)} F</td>
                  </tr>
                  <tr className="bg-amber-50 font-bold">
                    <td className="py-2 text-xs">TOTAL DETTES SOCIALES</td>
                    <td className="py-2 text-right text-xs">{fmt(payroll.total_ipres_employee + payroll.total_css_employee + payroll.total_irpp)} F</td>
                    <td className="py-2 text-right text-xs">{fmt(payroll.total_ipres_employer + payroll.total_css_employer)} F</td>
                    <td className="py-2 text-right text-xs">{fmt(payroll.total_ipres_employee + payroll.total_ipres_employer + payroll.total_css_employee + payroll.total_css_employer + payroll.total_irpp)} F</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {payroll.by_month.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700">Détail mensuel</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                      <th className="py-1">Mois</th>
                      <th className="py-1 text-right">Employés</th>
                      <th className="py-1 text-right">Brut</th>
                      <th className="py-1 text-right">Net</th>
                      <th className="py-1 text-right">Coût employeur<br />(sans l&apos;assurance)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <PaginatedRows colSpan={5}>
                    {payroll.by_month.map((m: any) => (
                      <tr key={m.period_month} className="border-b border-gray-50">
                        <td className="py-1.5 text-xs">{m.period_month}/{exercice}</td>
                        <td className="py-1.5 text-right text-xs">{m.employee_count}</td>
                        <td className="py-1.5 text-right text-xs">{fmt(m.gross_salary)} F</td>
                        <td className="py-1.5 text-right text-xs">{fmt(m.net_salary)} F</td>
                        <td className="py-1.5 text-right text-xs">{fmt(m.employer_charges)} F</td>
                      </tr>
                    ))}
                    </PaginatedRows>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <p className="py-4 text-sm text-gray-500">Aucune donnée de paie pour cet exercice.</p>
        )}
      </section>

      <div className="print-spacer" />
      {/* ===== 10. SIGNATURE ET VALIDATION (print only) ===== */}
      <section className="print-section print-page-start print-last-page hidden print:block rounded-lg border border-cabinet-200 p-5">
        <h2 className="print-section-title mb-4 border-b border-gray-100 pb-2 text-lg font-semibold text-cabinet-800">
          Signature et Validation
        </h2>
        <p className="text-xs leading-relaxed text-gray-700">
          Je soussigné(e) {userName}, certifie que le présent rapport financier de l&apos;exercice {exercice} présente fidèlement
          la situation comptable et financière de {cabinet.raisonSociale}.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-gray-700">
          Le présent rapport comprend l&apos;ensemble des écritures comptables, le bilan, le compte de résultat, les soldes
          intermédiaires de gestion et le tableau des flux de trésorerie, conformément au système comptable OHADA.
        </p>
        <p className="mt-4 text-xs text-gray-700">
          Fait à  .................................., le {dateGeneree}
        </p>
        <div className="mt-8 flex justify-between gap-8">
          <div className="flex-1 text-center">
            <p className="text-xs font-semibold text-gray-700">Le Responsable</p>
            <p className="mt-1 text-xs text-gray-500">{userName}</p>
            <p className="mt-12 text-xs text-gray-400">Cachet et signature</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-xs font-semibold text-gray-700">Le Comptable</p>
            <p className="mt-1 text-xs text-gray-500">Service Comptable</p>
            <p className="mt-12 text-xs text-gray-400">Cachet et signature</p>
          </div>
        </div>
      </section>

              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
