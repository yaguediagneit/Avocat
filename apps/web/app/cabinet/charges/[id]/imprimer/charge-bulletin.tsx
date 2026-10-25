"use client";

import { PrintButton } from "@/app/cabinet/personnel/paie/imprimer/print-button";

interface ChargeBulletinProps {
  charge: any;
  company: {
    name: string;
    logoUrl: string | null;
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

export function ChargeBulletin({ charge, company, theme }: ChargeBulletinProps) {
  const footerContacts = [company.website, company.phone, company.email]
    .filter(Boolean)
    .join(" | ");

  const totalHt = charge.totalHt ?? Number(charge.amount);
  const taxAmount = charge.taxAmount ?? 0;
  const totalTtc = Number(charge.amount);

  return (
    <div className="mx-auto max-w-4xl py-4 print:max-w-none print:py-0">
      <div className="mb-3 flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">Aperçu charge</h1>
        <PrintButton />
      </div>

      <div
        className="page flex flex-col bg-white p-4 print:shadow-none print:rounded-none print:border-0"
      >
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
            Charge
          </h3>
          <p className="text-xs font-medium text-gray-600">
            {new Date(charge.chargeDate).toLocaleDateString("fr-FR")}
          </p>
        </div>

        {/* Infos charge */}
        <div className="mt-2 grid gap-2 sm:grid-cols-[3fr_2fr]">
          <div className="rounded border border-gray-200 p-1.5 text-xs leading-tight">
            <h4
              className="mb-0.5 text-xs font-bold uppercase"
              style={{ color: theme.primary }}
            >
              Détails charge
            </h4>
            <div className="space-y-0">
              <p>
                <span className="text-gray-500">Catégorie :</span> {charge.category?.label || "—"}
              </p>
              <p>
                <span className="text-gray-500">Date :</span> {fmtDate(charge.chargeDate)}
              </p>
              <p>
                <span className="text-gray-500">Mode paiement :</span> {charge.paymentMethod}
              </p>
              {charge.supplierName && (
                <p>
                  <span className="text-gray-500">Fournisseur :</span> {charge.supplierName}
                </p>
              )}
              {charge.supplierInvoiceRef && (
                <p>
                  <span className="text-gray-500">Réf. facture :</span> {charge.supplierInvoiceRef}
                </p>
              )}
              <p>
                <span className="text-gray-500">Statut :</span>{" "}
                {charge.isPaid ? "Payée" : "Impayée"}
              </p>
            </div>
          </div>

          <div className="rounded border border-gray-200 p-1.5 text-xs leading-tight">
            <h4
              className="mb-0.5 text-xs font-bold uppercase"
              style={{ color: theme.primary }}
            >
              Montants
            </h4>
            <div className="space-y-0">
              <p>
                <span className="text-gray-500">HT :</span> {fmt(totalHt)} FCFA
              </p>
              {charge.tvaEnabled && (
                <p>
                  <span className="text-gray-500">TVA :</span> {fmt(taxAmount)} FCFA
                </p>
              )}
              <p className="font-semibold">
                <span className="text-gray-500">TTC :</span> {fmt(totalTtc)} FCFA
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {charge.description && (
          <div className="mt-2 text-xs text-gray-700">
            <span className="font-medium">Description : </span>
            {charge.description}
          </div>
        )}

        {/* Lignes de charge */}
        {charge.lines && charge.lines.length > 0 && (
          <div className="mt-3">
            <table className="w-full border-collapse text-xs">
              <thead style={{ color: "#000000" }}>
                <tr>
                  <th className="px-2 py-0.5 text-left font-semibold">Désignation</th>
                  <th className="px-2 py-0.5 text-right font-semibold">Qté</th>
                  <th className="px-2 py-0.5 text-right font-semibold">P.U.</th>
                  <th className="px-2 py-0.5 text-right font-semibold">TVA</th>
                  <th className="px-2 py-0.5 text-right font-semibold">HT</th>
                  <th className="px-2 py-0.5 text-right font-semibold">TTC</th>
                </tr>
              </thead>
              <tbody>
                {charge.lines.map((l: any) => (
                  <tr key={l.id} className="border-b">
                    <td className="px-2 py-0.5">{l.description}</td>
                    <td className="px-2 py-0.5 text-right">{l.quantite}</td>
                    <td className="px-2 py-0.5 text-right">{fmt(l.prixUnitaire)}</td>
                    <td className="px-2 py-0.5 text-right">{l.tauxTva}%</td>
                    <td className="px-2 py-0.5 text-right">{fmt(l.totalHt)}</td>
                    <td className="px-2 py-0.5 text-right font-medium">{fmt(l.totalTtc)}</td>
                  </tr>
                ))}
                <tr className="border-b-2 font-bold" style={{ borderColor: theme.primary }}>
                  <td colSpan={4} className="px-2 py-0.5 text-right">Total TTC</td>
                  <td className="px-2 py-0.5 text-right" colSpan={2}>{fmt(totalTtc)} FCFA</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Signatures */}
        <div className="mt-6 flex justify-between gap-8">
          <div className="flex-1">
            <p className="text-xs font-medium">Responsable : Admin Cabinet</p>
            <p className="mt-1 text-xs text-gray-500">Cachet et signature</p>
          </div>
          <div className="flex-1 text-right">
            <p className="text-xs font-medium">Le Comptable : Service Comptable</p>
            <p className="mt-1 text-xs text-gray-500">Cachet et signature</p>
          </div>
        </div>

        {/* Footer */}
        <div className="page-footer mt-auto border-t pt-1 pb-1 text-center text-xs text-gray-500">
          {company.name}
          {company.details && ` | ${company.details}`}
          {footerContacts && ` | ${footerContacts}`}
        </div>
      </div>
    </div>
  );
}
