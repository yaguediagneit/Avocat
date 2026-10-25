"use client";

import { useEffect, useState } from "react";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";
import { resolvePdfThemeText } from "@/lib/pdf-theme-text";

const PAYMENT_TYPES = [
  { code: "IRPP", label: "Versement IRPP" },
  { code: "IPRES", label: "Versement IPRES" },
  { code: "CNSS_CSS", label: "Versement CNSS/CSS" },
] as const;

type PaymentType = (typeof PAYMENT_TYPES)[number]["code"];

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface Payroll {
  id: string;
  periodYear: number;
  periodMonth: number;
  grossSalary: number;
  netSalary: number;
  irppAmount: number;
  ipresAmount: number;
  ipresEmployerAmount: number;
  cssAmount: number;
  cssEmployerAmount: number;
  totalEmployerCost: number;
  status: string;
  employee: Employee;
}

interface CabinetInfo {
  raisonSociale: string;
  adresse: string;
  telephonePrincipal: string;
  email: string;
  logoUrl?: string;
  pdfTheme?: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    fontSize: number;
    headerText: string;
    footerText: string;
  };
}

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Un versement du type sélectionné est-il dû pour ce bulletin ?
function payrollHasType(p: Payroll, type: PaymentType | null): boolean {
  switch (type) {
    case "IRPP":
      return Number(p.irppAmount) > 0;
    case "IPRES":
      return Number(p.ipresAmount) + Number(p.ipresEmployerAmount) > 0;
    case "CNSS_CSS":
      return Number(p.cssAmount) + Number(p.cssEmployerAmount) > 0;
    default:
      return true;
  }
}

export default function PaymentsSection({ cabinet }: { cabinet: CabinetInfo }) {
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<PaymentType | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  // Les 11 derniers mois jusqu'au mois courant inclus (clé « YYYY-M »)
  const monthOptions = (() => {
    const now = new Date();
    return Array.from({ length: 11 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 10 + i, 1);
      return {
        key: `${d.getFullYear()}-${d.getMonth() + 1}`,
        label: d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" }),
      };
    });
  })();

  const toggleMonth = (key: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/personnel/payrolls?limit=1000");
      if (res.ok) setPayrolls(await res.json());
      else setMessage("Erreur de chargement");
    } catch {
      setMessage("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showIrpp = !selectedType || selectedType === "IRPP";
  const showIpres = !selectedType || selectedType === "IPRES";
  const showCnss = !selectedType || selectedType === "CNSS_CSS";
  const payrollColSpan = 2 + Number(showIrpp) + Number(showIpres) + Number(showCnss);

  const filteredPayrolls = payrolls.filter(
    (p) =>
      p.status === "paid" &&
      payrollHasType(p, selectedType) &&
      (selectedMonths.size === 0 ||
        selectedMonths.has(`${p.periodYear}-${p.periodMonth}`))
  );

  // Si le filtre couvre plusieurs mois, les montants sont cumulés par employé.
  const multiMonth =
    new Set(filteredPayrolls.map((p) => `${p.periodYear}-${p.periodMonth}`)).size > 1;

  interface DisplayRow {
    key: string;
    periodLabel: string;
    employeeName: string;
    irpp: number;
    ipres: number;
    cnss: number;
  }

  const displayRows: DisplayRow[] = multiMonth
    ? [...filteredPayrolls
        .reduce((map, p) => {
          const list = map.get(p.employee.id) ?? [];
          list.push(p);
          map.set(p.employee.id, list);
          return map;
        }, new Map<string, Payroll[]>())
        .values()]
        .map((list) => {
          const sorted = [...list].sort(
            (a, b) => a.periodYear - b.periodYear || a.periodMonth - b.periodMonth
          );
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          return {
            key: first.employee.id,
            periodLabel: `${first.periodMonth}/${first.periodYear} – ${last.periodMonth}/${last.periodYear}`,
            employeeName: `${first.employee.firstName} ${first.employee.lastName}`,
            irpp: list.reduce((s, p) => s + Number(p.irppAmount || 0), 0),
            ipres: list.reduce(
              (s, p) => s + Number(p.ipresEmployerAmount || 0) + Number(p.ipresAmount || 0),
              0
            ),
            cnss: list.reduce(
              (s, p) => s + Number(p.cssEmployerAmount || 0) + Number(p.cssAmount || 0),
              0
            ),
          };
        })
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "fr"))
    : filteredPayrolls.map((p) => ({
        key: p.id,
        periodLabel: `${p.periodMonth}/${p.periodYear}`,
        employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
        irpp: Number(p.irppAmount || 0),
        ipres: Number(p.ipresEmployerAmount || 0) + Number(p.ipresAmount || 0),
        cnss: Number(p.cssEmployerAmount || 0) + Number(p.cssAmount || 0),
      }));

  const payrollTotals = {
    irpp: filteredPayrolls.reduce((s, p) => s + Number(p.irppAmount || 0), 0),
    ipresPP: filteredPayrolls.reduce((s, p) => s + Number(p.ipresEmployerAmount || 0), 0),
    cnssPP: filteredPayrolls.reduce((s, p) => s + Number(p.cssEmployerAmount || 0), 0),
    ipresPE: filteredPayrolls.reduce((s, p) => s + Number(p.ipresAmount || 0), 0),
    cnssPE: filteredPayrolls.reduce((s, p) => s + Number(p.cssAmount || 0), 0),
  };

  const periodeTxt =
    selectedMonths.size > 0
      ? `Mois : ${monthOptions
          .filter((m) => selectedMonths.has(m.key))
          .map((m) => m.label)
          .join(", ")}`
      : "Toutes périodes";

  const printList = () => {
    const typeLabel = selectedType
      ? PAYMENT_TYPES.find((t) => t.code === selectedType)?.label ?? selectedType
      : "Tous les types";
    const subtitle = `${filteredPayrolls.length} bulletin${filteredPayrolls.length > 1 ? "s" : ""} payé${filteredPayrolls.length > 1 ? "s" : ""}`;

    const headCells = [`<th>Période</th>`, `<th>Employé</th>`];
    if (showIrpp) headCells.push(`<th class="num">IRPP</th>`);
    if (showIpres) headCells.push(`<th class="num">IPRES</th>`);
    if (showCnss) headCells.push(`<th class="num">CNSS</th>`);

    const rows = displayRows
      .map((r) => {
        const cells = [
          `<td>${escapeHtml(r.periodLabel)}</td>`,
          `<td>${escapeHtml(r.employeeName)}</td>`,
        ];
        if (showIrpp) cells.push(`<td class="num">${fmt(r.irpp)}</td>`);
        if (showIpres) cells.push(`<td class="num">${fmt(r.ipres)}</td>`);
        if (showCnss) cells.push(`<td class="num">${fmt(r.cnss)}</td>`);
        return `<tr>${cells.join("")}</tr>`;
      })
      .join("");

    const footCells = [`<td colspan="2">TOTAL</td>`];
    if (showIrpp) footCells.push(`<td class="num">${fmt(payrollTotals.irpp)}</td>`);
    if (showIpres) footCells.push(`<td class="num">${fmt(payrollTotals.ipresPP + payrollTotals.ipresPE)}</td>`);
    if (showCnss) footCells.push(`<td class="num">${fmt(payrollTotals.cnssPP + payrollTotals.cnssPE)}</td>`);

    const tableHtml = `<table>
      <thead><tr>${headCells.join("")}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${payrollColSpan}" style="text-align:center;color:#777">Aucun salaire payé</td></tr>`}</tbody>
      <tfoot><tr>${footCells.join("")}</tr></tfoot>
    </table>`;

    const win = window.open("", "_blank", "width=1100,height=700");
    if (!win) {
      alert("Le navigateur a bloqué la fenêtre d'impression");
      return;
    }

    // Thème PDF défini dans Paramétrage (couleurs, police, textes)
    const theme = cabinet.pdfTheme || {
      primaryColor: "#2c4c7c",
      secondaryColor: "#c78124",
      fontFamily: "Helvetica",
      fontSize: 11,
      headerText: "",
      footerText: "",
    };
    const fontStacks: Record<string, string> = {
      Helvetica: "Helvetica, Arial, sans-serif",
      Times: "'Times New Roman', Times, serif",
      Courier: "'Courier New', Courier, monospace",
    };
    const cssFont = fontStacks[theme.fontFamily] || fontStacks.Helvetica;
    const baseSize = Math.min(Math.max(theme.fontSize || 11, 8), 14);

    win.document.write(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Liste des versements</title>
<style>
  body { font-family: ${cssFont}; color: #111; margin: 32px; font-size: ${baseSize}px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid ${theme.primaryColor}; padding-bottom: 10px; margin-bottom: 6px; }
  .head .brand { display: flex; align-items: flex-start; gap: 12px; }
  .head img { max-height: 54px; max-width: 160px; object-fit: contain; }
  .head h1 { font-size: ${baseSize + 5}px; margin: 0 0 4px; text-transform: uppercase; color: ${theme.primaryColor}; }
  .head p { margin: 0; color: #555; font-size: ${baseSize}px; }
  .head .date { color: #555; white-space: nowrap; }
  .header-text { color: ${theme.secondaryColor}; font-size: ${baseSize - 1}px; margin: 0 0 14px; font-style: italic; }
  h2 { font-size: ${baseSize + 3}px; margin: 0 0 4px; color: ${theme.primaryColor}; }
  .meta { color: #555; margin: 0 0 14px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; white-space: nowrap; }
  th { background: ${theme.primaryColor}1a; color: ${theme.primaryColor}; font-size: ${baseSize - 1}px; text-transform: uppercase; }
  td.num, th.num { text-align: right; }
  tfoot td { font-weight: bold; background: #f7f7f7; }
  .foot { margin-top: 18px; padding-top: 8px; border-top: 1px solid ${theme.secondaryColor}; color: #777; font-size: ${baseSize - 1}px; text-align: center; }
  .foot .custom { color: ${theme.secondaryColor}; font-style: italic; }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">
      ${cabinet.logoUrl ? `<img src="${escapeHtml(cabinet.logoUrl)}" alt="Logo" />` : ""}
      <div>
        <h1>${escapeHtml(cabinet.raisonSociale)}</h1>
        ${cabinet.adresse ? `<p>${escapeHtml(cabinet.adresse)}</p>` : ""}
        <p>${cabinet.telephonePrincipal ? `Tél. ${escapeHtml(cabinet.telephonePrincipal)}` : ""}${cabinet.telephonePrincipal && cabinet.email ? " | " : ""}${escapeHtml(cabinet.email || "")}</p>
      </div>
    </div>
    <p class="date">Généré le ${new Date().toLocaleDateString("fr-FR")}</p>
  </div>
  ${theme.headerText ? `<p class="header-text">${escapeHtml(resolvePdfThemeText(theme.headerText))}</p>` : ""}
  <h2>Versements sociaux et fiscaux</h2>
  <p class="meta">${escapeHtml(typeLabel)} — ${escapeHtml(periodeTxt)} — ${escapeHtml(subtitle)}</p>
  ${tableHtml}
  <p class="foot">
    ${theme.footerText ? `<span class="custom">${escapeHtml(resolvePdfThemeText(theme.footerText))}</span><br/>` : ""}
    ${escapeHtml(cabinet.raisonSociale)} — ${escapeHtml(periodeTxt)}
  </p>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <section className="print-section rounded-lg border border-gray-200 bg-white p-5 shadow-sm print:hidden">
      <div className="mb-4 border-b border-gray-100 pb-2">
        <h2 className="text-lg font-semibold text-cabinet-800">
          Versements sociaux et fiscaux
        </h2>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedType(null)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            selectedType === null
              ? "bg-cabinet-900 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Tous
        </button>
        {PAYMENT_TYPES.map((t) => (
          <button
            key={t.code}
            onClick={() => setSelectedType(selectedType === t.code ? null : t.code)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              selectedType === t.code
                ? "bg-cabinet-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={printList}
          className="rounded-md bg-cabinet-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cabinet-800"
        >
          Imprimer la liste
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-gray-700">Mois :</span>
        {monthOptions.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => toggleMonth(m.key)}
            className={`rounded-md border px-2 py-1 text-xs font-medium capitalize transition ${
              selectedMonths.has(m.key)
                ? "border-cabinet-700 bg-cabinet-700 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {message && <p className="mb-4 text-sm text-cabinet-700">{message}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Chargement…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                {sortTh("versements", "periode", "Période", "whitespace-nowrap px-2 py-1.5")}
                {sortTh("versements", "employe", "Employé", "min-w-[150px] whitespace-nowrap px-2 py-1.5")}
                {showIrpp && sortTh("versements", "irpp", "IRPP", "whitespace-nowrap px-2 py-1.5 text-right")}
                {showIpres && sortTh("versements", "ipres", "IPRES", "whitespace-nowrap px-2 py-1.5 text-right")}
                {showCnss && sortTh("versements", "cnss", "CNSS", "whitespace-nowrap px-2 py-1.5 text-right")}
              </tr>
            </thead>
            <tbody>
              {filteredPayrolls.length === 0 && (
                <tr>
                  <td colSpan={payrollColSpan} className="px-2 py-3 text-center text-xs text-gray-500">
                    Aucun salaire payé pour ce filtre.
                  </td>
                </tr>
              )}
              <PaginatedRows colSpan={payrollColSpan}>
              {sortRows("versements", displayRows, {
                periode: (r) => r.periodLabel,
                employe: (r) => r.employeeName,
                irpp: (r) => r.irpp,
                ipres: (r) => r.ipres,
                cnss: (r) => r.cnss,
              }).map((r) => (
                <tr key={r.key} className="border-b hover:bg-gray-50">
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs">{r.periodLabel}</td>
                  <td className="min-w-[150px] whitespace-nowrap px-2 py-1.5 text-xs">{r.employeeName}</td>
                  {showIrpp && <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs">{fmt(r.irpp)}</td>}
                  {showIpres && <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs">{fmt(r.ipres)}</td>}
                  {showCnss && <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs">{fmt(r.cnss)}</td>}
                </tr>
              ))}
              </PaginatedRows>
            </tbody>
            {filteredPayrolls.length > 0 && (
              <tfoot className="bg-cabinet-50 text-cabinet-900">
                <tr className="border-t-2 border-cabinet-300 font-semibold">
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs" colSpan={2}>TOTAL</td>
                  {showIrpp && <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs">{fmt(payrollTotals.irpp)}</td>}
                  {showIpres && <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs">{fmt(payrollTotals.ipresPP + payrollTotals.ipresPE)}</td>}
                  {showCnss && <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs">{fmt(payrollTotals.cnssPP + payrollTotals.cnssPE)}</td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
}
