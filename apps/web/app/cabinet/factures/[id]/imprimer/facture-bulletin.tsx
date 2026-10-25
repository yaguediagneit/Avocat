"use client";

import { PrintButton } from "@/app/cabinet/personnel/paie/imprimer/print-button";

interface FactureBulletinProps {
  facture: any;
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

export function FactureBulletin({ facture, company, theme }: FactureBulletinProps) {
  const totalPaye = (facture.paiements || []).reduce(
    (acc: number, p: any) => acc + Number(p.montant),
    0
  );
  const reste = Number(facture.totalTtc) - totalPaye;

  const estPaye = totalPaye >= Number(facture.totalTtc) || facture.statut === "Payée";
  const docType = estPaye ? "Facture" : "Devis";
  const docNumero = estPaye
    ? facture.numero
    : facture.numero.replace(/^FACT-/, "DEV-");

  const footerContacts = [company.website, company.phone, company.email]
    .filter(Boolean)
    .join(" | ");

  return (
    <div className="mx-auto max-w-4xl py-4 print:max-w-none print:py-0">
      <div className="mb-3 flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">Aperçu {docType.toLowerCase()} {docNumero}</h1>
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
            {docType}
          </h3>
          <p className="text-xs font-medium text-gray-600">N° {docNumero}</p>
        </div>

        {/* Infos client / facture */}
        <div className="mt-2 grid gap-2 sm:grid-cols-[3fr_2fr]">
          <div className="rounded border border-gray-200 p-1.5 text-xs leading-tight">
            <h4
              className="mb-0.5 text-xs font-bold uppercase"
              style={{ color: theme.primary }}
            >
              Client
            </h4>
            <p className="font-medium">{facture.client.raisonSociale}</p>
            {facture.client.adresse && <p>{facture.client.adresse}</p>}
            {facture.client.identifiant && <p>NINEA : {facture.client.identifiant}</p>}
            {facture.client.coordonnees?.telephone && (
              <p>Tél : {facture.client.coordonnees.telephone}</p>
            )}
            {facture.client.coordonnees?.email && (
              <p>Email : {facture.client.coordonnees.email}</p>
            )}
          </div>

          <div className="rounded border border-gray-200 p-1.5 text-xs leading-tight">
            <h4
              className="mb-0.5 text-xs font-bold uppercase"
              style={{ color: theme.primary }}
            >
              {estPaye ? "Détails facture" : "Détails devis"}
            </h4>
            <div className="space-y-0">
              <p>
                <span className="text-gray-500">Émission :</span> {fmtDate(facture.dateEmission)}
              </p>
              {facture.dateEcheance && (
                <p>
                  <span className="text-gray-500">Échéance :</span> {fmtDate(facture.dateEcheance)}
                </p>
              )}
              {facture.dossier?.referenceInterne && (
                <p>
                  <span className="text-gray-500">Dossier :</span>{" "}
                  {facture.dossier.referenceInterne}
                </p>
              )}
              <p>
                <span className="text-gray-500">Statut :</span> {facture.statut}
              </p>
            </div>
          </div>
        </div>

        {facture.libelle && (
          <p className="mt-2 text-sm font-medium">{facture.libelle}</p>
        )}
        {facture.designation && (
          <p className="mt-0.5 text-xs text-gray-600">{facture.designation}</p>
        )}

        {/* Tableau des lignes */}
        <div className="mt-3">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100 text-black">
              <tr>
                <th className="px-2 py-1 text-left font-bold">Description</th>
                <th className="px-2 py-1 text-right font-bold">Qté</th>
                <th className="px-2 py-1 text-right font-bold">Prix unit.</th>
                <th className="px-2 py-1 text-right font-bold">TVA</th>
                <th className="px-2 py-1 text-right font-bold">Total TTC</th>
              </tr>
            </thead>
            <tbody>
              {facture.lines.map((l: any, idx: number) => (
                <tr key={l.id || idx} className="border-b">
                  <td className="px-2 py-0.5">{l.description}</td>
                  <td className="px-2 py-0.5 text-right">{l.quantite}</td>
                  <td className="px-2 py-0.5 text-right">{fmt(l.prixUnitaire)} FCFA</td>
                  <td className="px-2 py-0.5 text-right">{fmt(l.tauxTva)}%</td>
                  <td className="px-2 py-0.5 text-right">{fmt(l.totalTtc)} FCFA</td>
                </tr>
              ))}
              <tr
                className="border-b-2 font-bold"
                style={{ borderColor: theme.primary }}
              >
                <td className="px-2 py-1" colSpan={4}>
                  Total TTC
                </td>
                <td className="px-2 py-1 text-right">{fmt(facture.totalTtc)} FCFA</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totaux + Paiements + Signatures — bloc inséparable */}
        <div className="mt-2" style={{ pageBreakInside: "avoid" }}>
          {/* Totaux */}
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-0 text-sm">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Total HT</span>
                <span>{fmt(facture.totalHt)} FCFA</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Total TVA</span>
                <span>{fmt(facture.totalTva)} FCFA</span>
              </div>
              {facture.tvaRate && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Taux TVA</span>
                  <span>
                    {facture.tvaRate.label} ({fmt(facture.tvaRate.rate)}%)
                  </span>
                </div>
              )}
              <div
                className="flex justify-between border-t-2 pt-0.5 text-sm font-bold"
                style={{ borderColor: theme.primary }}
              >
                <span>Total TTC</span>
                <span>{fmt(facture.totalTtc)} FCFA</span>
              </div>
              {totalPaye > 0 && (
                <div className="flex justify-between text-xs text-emerald-700">
                  <span>Payé</span>
                  <span>{fmt(totalPaye)} FCFA</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-semibold">
                <span>Reste dû</span>
                <span>{fmt(reste)} FCFA</span>
              </div>
            </div>
          </div>

          {/* Paiements reçus */}
          {facture.paiements && facture.paiements.length > 0 && (
            <div className="mt-2 rounded border border-gray-200 p-1.5">
              <h4
                className="mb-0.5 text-xs font-bold uppercase"
                style={{ color: theme.primary }}
              >
                Paiements reçus
              </h4>
              <ul className="space-y-0 text-xs text-gray-700">
                {facture.paiements.map((p: any, idx: number) => (
                  <li key={p.id || idx} className="flex justify-between">
                    <span>
                      {fmtDate(p.datePaiement)} — {p.mode}
                      {p.reference && ` (${p.reference})`}
                    </span>
                    <span>{fmt(p.montant)} FCFA</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Signatures — juste à la suite des paiements */}
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium">Signature du client</p>
              <p className="mt-3 text-xs text-gray-500">Lu et approuvé</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium">Cachet & Signature du prestataire</p>
              <p className="mt-3 text-xs font-medium">{company.name}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="page-footer mt-auto border-t pt-1 pb-1 text-center text-xs text-gray-500">
          <p>
            {company.name}
            {company.details && ` | ${company.details}`}
            {company.website && ` | ${company.website}`}
            {company.phone && ` | ${company.phone}`}
          </p>
        </div>
      </div>
    </div>
  );
}
