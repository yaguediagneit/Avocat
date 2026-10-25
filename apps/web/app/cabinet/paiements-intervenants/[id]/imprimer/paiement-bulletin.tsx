"use client";

import { PrintButton } from "@/app/cabinet/personnel/paie/imprimer/print-button";

interface PaiementBulletinProps {
  charge: any;
  company: {
    name: string;
    logoUrl: string | null;
    address: string;
    details: string;
    phone: string;
    email: string;
    website: string;
  };
  theme: { primary: string; secondary: string };
}

function fmt(n: number) {
  return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("fr-FR");
}

const INTERVENANT_LABELS: Record<string, string> = {
  huissier: "Huissier",
  clerc: "Clerc",
  architecte: "Architecte",
  conseiller_juridique: "Conseiller Juridique",
  avocat: "Avocat",
};

export function PaiementBulletin({ charge, company, theme }: PaiementBulletinProps) {
  const footerContacts = [company.website, company.phone, company.email]
    .filter(Boolean)
    .join(" | ");

  const metadata = (charge.metadata || {}) as {
    intervenantType?: string;
    intervenantName?: string;
    taxMode?: string;
    withholdingRate?: number;
    referenceType?: string;
    referenceMissionType?: string;
    netAmount?: number;
  };

  const numero = `PAY-${charge.id.slice(-6)}`;
  const totalHt = Number(charge.totalHt ?? charge.amount);
  const taxAmount = Number(charge.taxAmount ?? 0);
  const totalTtc = Number(charge.amount);
  const netAmount =
    metadata.taxMode === "prelevement_impots"
      ? Number(metadata.netAmount ?? totalTtc - taxAmount)
      : totalTtc;

  const referenceLabel =
    metadata.referenceType === "tache" && charge.tache
      ? `Tâche : ${charge.tache.titre}`
      : metadata.referenceType === "mission" && charge.missionHuissier
        ? `Mission : ${charge.missionHuissier.typeActe}`
        : metadata.referenceMissionType
          ? `Mission ${metadata.referenceMissionType}${
              charge.dossier ? ` — ${charge.dossier.referenceInterne}` : ""
            }`
          : charge.dossier?.referenceInterne || "—";

  const taxLabel =
    metadata.taxMode === "tva"
      ? `TVA (${charge.tvaRate?.rate ?? 0}%)`
      : metadata.taxMode === "prelevement_impots"
        ? `Retenue d'impôt (${metadata.withholdingRate ?? 0}%)`
        : "Exonéré";

  return (
    <div className="mx-auto max-w-4xl py-4 print:max-w-none print:py-0">
      <div className="mb-3 flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">Aperçu fiche de paiement {numero}</h1>
        <PrintButton />
      </div>

      <div className="page flex flex-col bg-white p-4 print:shadow-none print:rounded-none print:border-0">
        <style jsx>{`
          @media print {
            .page {
              page-break-after: auto;
              page-break-inside: avoid;
            }
            .page-footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              padding: 2mm 14mm;
              background: white;
              border-top: 1px solid #e5e7eb;
            }
          }
        `}</style>

        {/* En-tête société */}
        <div className="border-b-2 pb-2" style={{ borderColor: theme.primary }}>
          <div className="flex items-start gap-4">
            {company.logoUrl && (
              <img
                src={company.logoUrl}
                alt="Logo"
                className="h-14 w-auto object-contain print:h-12"
              />
            )}
            <div className="flex-1">
              <h2
                className="text-lg font-bold uppercase tracking-wide print:text-base"
                style={{ color: theme.primary }}
              >
                {company.name}
              </h2>
              <div className="mt-0.5 text-xs text-gray-700 print:text-xs">
                {company.details && <p>{company.details}</p>}
                {footerContacts && <p className="mt-0.5">{footerContacts}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Titre */}
        <div className="mt-2 text-center">
          <h3 className="text-xl font-bold uppercase" style={{ color: theme.primary }}>
            Fiche de Paiement
          </h3>
          <p className="text-xs font-medium text-gray-600">N° {numero}</p>
        </div>

        {/* Infos intervenant / référence */}
        <div className="mt-2 grid gap-2 sm:grid-cols-[3fr_2fr]">
          <div className="rounded border border-gray-200 p-1.5 text-xs leading-tight">
            <h4
              className="mb-0.5 text-xs font-bold uppercase"
              style={{ color: theme.primary }}
            >
              Intervenant
            </h4>
            <p className="font-medium">
              {INTERVENANT_LABELS[metadata.intervenantType || ""] || metadata.intervenantType || "—"}
            </p>
            <p>{metadata.intervenantName || charge.supplierName || "—"}</p>
          </div>

          <div className="rounded border border-gray-200 p-1.5 text-xs leading-tight">
            <h4
              className="mb-0.5 text-xs font-bold uppercase"
              style={{ color: theme.primary }}
            >
              Détails paiement
            </h4>
            <div className="space-y-0">
              <p>
                <span className="text-gray-500">Date :</span> {fmtDate(charge.chargeDate)}
              </p>
              <p>
                <span className="text-gray-500">Mode :</span> {charge.paymentMethod}
              </p>
              <p>
                <span className="text-gray-500">Référence :</span> {referenceLabel}
              </p>
              <p>
                <span className="text-gray-500">Fiscalité :</span> {taxLabel}
              </p>
            </div>
          </div>
        </div>

        {charge.description && (
          <p className="mt-2 text-sm font-medium">{charge.description}</p>
        )}
        {charge.supplierInvoiceRef && (
          <p className="mt-0.5 text-xs text-gray-600">{charge.supplierInvoiceRef}</p>
        )}

        {/* Tableau des lignes */}
        <div className="mt-3">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100 text-black">
              <tr>
                <th className="px-2 py-1 text-left font-bold">Description</th>
                <th className="px-2 py-1 text-right font-bold">Qté / Durée</th>
                <th className="px-2 py-1 text-right font-bold">Prix unit.</th>
                {metadata.taxMode === "tva" && (
                  <th className="px-2 py-1 text-right font-bold">TVA</th>
                )}
                <th className="px-2 py-1 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {charge.lines.map((l: any, idx: number) => (
                <tr key={l.id || idx} className="border-b">
                  <td className="px-2 py-0.5">{l.description}</td>
                  <td className="px-2 py-0.5 text-right">{l.quantite}</td>
                  <td className="px-2 py-0.5 text-right">{fmt(l.prixUnitaire)}</td>
                  {metadata.taxMode === "tva" && (
                    <td className="px-2 py-0.5 text-right">{fmt(l.totalTva)}</td>
                  )}
                  <td className="px-2 py-0.5 text-right">{fmt(l.totalTtc)}</td>
                </tr>
              ))}
              <tr
                className="border-b-2 font-bold"
                style={{ borderColor: theme.primary }}
              >
                <td className="px-2 py-1" colSpan={metadata.taxMode === "tva" ? 4 : 3}>
                  Total TTC
                </td>
                <td className="px-2 py-1 text-right">{fmt(totalTtc)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totaux */}
        <div className="mt-2 flex justify-end">
          <div className="w-full max-w-xs space-y-0 text-sm">
            <div className="flex justify-between text-xs">
              <span className="text-gray-600">Total HT</span>
              <span>{fmt(totalHt)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">{taxLabel}</span>
                <span>{fmt(taxAmount)}</span>
              </div>
            )}
            <div
              className="flex justify-between border-t-2 pt-0.5 text-sm font-bold"
              style={{ borderColor: theme.primary }}
            >
              <span>Total TTC</span>
              <span>{fmt(totalTtc)}</span>
            </div>
            {metadata.taxMode === "prelevement_impots" && (
              <div className="flex justify-between text-xs font-semibold text-emerald-700">
                <span>Net à payer</span>
                <span>{fmt(netAmount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-6 flex justify-between gap-8">
          <div className="flex-1">
            <p className="text-xs font-medium">Signature de l&apos;intervenant</p>
            <p className="mt-1 text-xs text-gray-500">Lu et approuvé</p>
          </div>
          <div className="flex-1 text-right">
            <p className="text-xs font-medium">Cachet & Signature du cabinet</p>
            <p className="mt-1 text-xs font-medium">{company.name}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="page-footer mt-auto border-t pt-1 pb-1 text-center text-xs text-gray-500">
          {company.name}
          {company.details && ` | ${company.details}`}
          {company.website && ` | ${company.website}`}
          {company.phone && ` | ${company.phone}`}
        </div>
      </div>
    </div>
  );
}
