"use client";

// Affiche un bulletin de salaire formaté pour impression (1 page).
// Peut être utilisé seul ou en série ; chaque bulletin est découpé par page.

interface PayrollBulletinProps {
  payroll: any;
  company: {
    name: string;
    logoUrl: string | null;
    slogan: string;
    phone: string;
    address: string;
    identificationLegale: string;
    identifiantFiscal: string;
    email: string;
    website: string;
  };
  theme: { primary: string; secondary: string };
}

export function PayrollBulletin({ payroll, company, theme }: PayrollBulletinProps) {
  const fmt = (n: number) =>
    Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 });

  const fmtRate = (n: number) =>
    `${Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;

  const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("fr-FR");

  const periodLabel = `${payroll.periodMonth}/${payroll.periodYear}`;

  const seniority = (() => {
    const hire = new Date(payroll.employee.hireDate);
    const now = new Date();
    let months =
      (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
    if (now.getDate() < hire.getDate()) months -= 1;
    if (months < 0) months = 0;
    if (months === 0) return "0 mois";
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    const yearLabel = `${years} an${years > 1 ? "s" : ""}`;
    if (years > 0 && remMonths > 0) return `${yearLabel} ${remMonths} mois`;
    if (years > 0) return yearLabel;
    return `${remMonths} mois`;
  })();

  const gainLines = payroll.lines.filter(
    (l: any) => l.rubricType === "gain" && Number(l.computedAmount) !== 0
  );

  const retenueLines = payroll.lines.filter(
    (l: any) =>
      (l.rubricType === "deduction" || l.rubricType === "cotisation") &&
      Number(l.computedAmount) !== 0
  );

  const totalRetenues =
    Number(payroll.totalDeductions || 0) +
    Number(payroll.totalCotisations || 0) +
    Number(payroll.cssAmount || 0) +
    Number(payroll.ipresAmount || 0) +
    Number(payroll.irppAmount || 0);

  const calcLabel = (calcType: string) => {
    if (calcType === "fixed") return "—";
    if (calcType === "percent_base") return "% base";
    if (calcType === "percent_gross") return "% brut";
    return calcType;
  };

  const footerLine1 = [
    company.address,
    company.phone,
    company.identificationLegale,
    company.identifiantFiscal,
  ].filter(Boolean).join(" | ");

  const footerLine2 = [
    company.email,
    company.website,
  ].filter(Boolean).join(" | ");

  return (
    <div
      className="page flex flex-col bg-white p-4 print:shadow-none print:rounded-none print:border-0"
    >
      <style jsx>{`
        @media print {
          .page {
            page-break-inside: avoid;
          }
          .page + .page {
            page-break-before: always;
          }
          .page-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 4mm 14mm;
            background: white;
          }
        }
      `}</style>

      {/* En-tête société */}
      <div className="border-b-2 pb-4" style={{ borderColor: theme.primary }}>
        <div className="flex items-start gap-4">
          {company.logoUrl && (
            <img
              src={company.logoUrl}
              alt="Logo"
              className="h-16 w-auto object-contain print:h-14"
            />
          )}
          <div className="flex-1">
            <h2
              className="text-xl font-bold uppercase tracking-wide print:text-base"
              style={{ color: theme.primary }}
            >
              {company.name}
            </h2>
            {company.slogan && (
              <p className="mt-0.5 text-sm italic text-gray-600 print:text-xs">
                {company.slogan}
              </p>
            )}
            {company.phone && (
              <p className="mt-0.5 text-sm text-gray-700 print:text-xs">
                {company.phone}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Titre et période */}
      <div className="mt-2 text-center">
        <h3 className="text-xl font-bold uppercase" style={{ color: theme.primary }}>
          Bulletin de salaire
        </h3>
        <p className="text-xs font-medium text-gray-600">Période : {periodLabel}</p>
      </div>

      {/* Blocs employé / employeur */}
      <div className="mt-2 grid gap-2 sm:grid-cols-[3fr_2fr]">
        <div className="rounded border border-gray-200 p-1.5 text-xs leading-tight">
          <h4
            className="mb-0.5 text-xs font-bold uppercase"
            style={{ color: theme.primary }}
          >
            Employé
          </h4>
          <div className="grid grid-cols-[3fr_2fr] gap-2">
            <div className="space-y-0">
              <p>
                <span className="text-gray-500">Matricule :</span> {payroll.employee.employeeCode}
              </p>
              <p>
                <span className="text-gray-500">Nom & Prénom :</span>{" "}
                {payroll.employee.firstName} {payroll.employee.lastName}
              </p>
              <p>
                <span className="text-gray-500">Poste :</span>{" "}
                {payroll.employee.position || "—"}
              </p>
              <p>
                <span className="text-gray-500">Département :</span>{" "}
                {payroll.employee.department || "—"}
              </p>
              <p>
                <span className="text-gray-500">Date d&apos;embauche :</span>{" "}
                {fmtDate(payroll.employee.hireDate)}
              </p>
            </div>
            <div className="space-y-0">
              <p>
                <span className="text-gray-500">Statut :</span>{" "}
                {payroll.ipresRate >= 8 ? "Cadre" : "Régime général"}
              </p>
              <p>
                <span className="text-gray-500">Statut marital :</span>{" "}
                {payroll.employee.maritalStatus === "married" && "Marié(e)"}
                {payroll.employee.maritalStatus === "single" && "Célibataire"}
                {payroll.employee.maritalStatus === "divorced" && "Divorcé(e)"}
                {payroll.employee.maritalStatus === "widowed" && "Veuf/Veuve"}
                {!payroll.employee.maritalStatus && "—"}
              </p>
              <p>
                <span className="text-gray-500">Nombre de parts :</span> {payroll.irppShares}
              </p>
              <p>
                <span className="text-gray-500">Ancienneté :</span> {seniority}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded border border-gray-200 p-1.5 text-xs leading-tight">
          <h4
            className="mb-0.5 text-xs font-bold uppercase"
            style={{ color: theme.primary }}
          >
            Employeur
          </h4>
          <div className="space-y-0">
            <p>
              <span className="text-gray-500">Cabinet :</span> {company.name}
            </p>
            {company.phone && (
              <p>
                <span className="text-gray-500">Téléphone :</span> {company.phone}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tableau des rubriques */}
      <div className="mt-3">
        <table className="w-full border-collapse text-xs">
          <thead style={{ color: "#000000" }}>
            <tr>
              <th className="px-2 py-0.5 text-left font-semibold">Désignation</th>
              <th className="px-2 py-0.5 text-right font-semibold">Base</th>
              <th className="px-2 py-0.5 text-right text-[10px] font-semibold">Taux / Nb</th>
              <th className="px-2 py-0.5 text-right font-semibold">Montant</th>
            </tr>
          </thead>
          <tbody>
            {/* GAINS */}
            <tr style={{ backgroundColor: "#f8f9fa" }}>
              <td
                colSpan={4}
                className="px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{ color: theme.primary }}
              >
                Gains
              </td>
            </tr>
            {Number(payroll.baseSalary) > 0 && (
              <tr className="border-b">
                <td className="px-2 py-0.5">Salaire de base</td>
                <td className="px-2 py-0.5 text-right">{fmt(payroll.baseSalary)}</td>
                <td className="px-2 py-0.5 text-right">—</td>
                <td className="px-2 py-0.5 text-right">{fmt(payroll.baseSalary)}</td>
              </tr>
            )}
            {gainLines.map((l: any) => (
              <tr key={l.id} className="border-b">
                <td className="px-2 py-0.5">{l.rubricLabel}</td>
                <td className="px-2 py-0.5 text-right">
                  {l.baseAmount > 0 ? fmt(l.baseAmount) : "—"}
                </td>
                <td className="px-2 py-0.5 text-right">
                  {l.calcType === "fixed" ? (
                    "—"
                  ) : (
                    <>
                      {fmtRate(l.rateOrAmount)}
                      <span className="ml-1 text-[10px] text-gray-500">{calcLabel(l.calcType)}</span>
                    </>
                  )}
                </td>
                <td className="px-2 py-0.5 text-right">{fmt(l.computedAmount)}</td>
              </tr>
            ))}
            <tr
              className="border-b-2 font-bold"
              style={{ borderColor: theme.primary }}
            >
              <td className="px-2 py-0.5">Salaire Brut</td>
              <td className="px-2 py-0.5 text-right">—</td>
              <td className="px-2 py-0.5 text-right">—</td>
              <td className="px-2 py-0.5 text-right">{fmt(payroll.grossSalary)}</td>
            </tr>

            {/* RETENUES */}
            <tr style={{ backgroundColor: "#f8f9fa" }}>
              <td
                colSpan={4}
                className="px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{ color: theme.primary }}
              >
                Retenues
              </td>
            </tr>
            <tr className="border-b">
              <td className="px-2 py-0.5">Cotisation CNSS (part salariale)</td>
              <td className="px-2 py-0.5 text-right">{fmt(payroll.cssBase)}</td>
              <td className="px-2 py-0.5 text-right">{fmtRate(payroll.cssRate)}</td>
              <td className="px-2 py-0.5 text-right">{fmt(payroll.cssAmount)}</td>
            </tr>
            <tr className="border-b">
              <td className="px-2 py-0.5">Cotisation IPRES (part salariale)</td>
              <td className="px-2 py-0.5 text-right">{fmt(payroll.ipresBase)}</td>
              <td className="px-2 py-0.5 text-right">{fmtRate(payroll.ipresRate)}</td>
              <td className="px-2 py-0.5 text-right">{fmt(payroll.ipresAmount)}</td>
            </tr>
            <tr className="border-b">
              <td className="px-2 py-0.5">IRPP</td>
              <td className="px-2 py-0.5 text-right">{fmt(payroll.irppTaxableBase)}</td>
              <td className="px-2 py-0.5 text-right">—</td>
              <td className="px-2 py-0.5 text-right">{fmt(payroll.irppAmount)}</td>
            </tr>
            {retenueLines.map((l: any) => (
              <tr key={l.id} className="border-b">
                <td className="px-2 py-0.5">{l.rubricLabel}</td>
                <td className="px-2 py-0.5 text-right">
                  {l.baseAmount > 0 ? fmt(l.baseAmount) : "—"}
                </td>
                <td className="px-2 py-0.5 text-right">
                  {l.calcType === "fixed" ? (
                    "—"
                  ) : (
                    <>
                      {fmtRate(l.rateOrAmount)}
                      <span className="ml-1 text-[10px] text-gray-500">{calcLabel(l.calcType)}</span>
                    </>
                  )}
                </td>
                <td className="px-2 py-0.5 text-right">{fmt(l.computedAmount)}</td>
              </tr>
            ))}
            <tr
              className="border-b-2 font-bold"
              style={{ borderColor: theme.primary }}
            >
              <td className="px-2 py-0.5">Total Retenues</td>
              <td className="px-2 py-0.5 text-right">—</td>
              <td className="px-2 py-0.5 text-right">—</td>
              <td className="px-2 py-0.5 text-right">{fmt(totalRetenues)}</td>
            </tr>

            <tr className="border-b text-xs text-gray-500">
              <td className="px-3 py-1">
                Cotisation IPRES (part patronale)
                <span className="ml-1 italic">— Non pris en compte dans le calcul du net</span>
              </td>
              <td className="px-3 py-1 text-right">{fmt(payroll.ipresBase)}</td>
              <td className="px-3 py-1 text-right">
                {fmtRate(
                  payroll.ipresBase > 0 ? (payroll.ipresEmployerAmount / payroll.ipresBase) * 100 : 0
                )}
              </td>
              <td className="px-3 py-1 text-right">{fmt(payroll.ipresEmployerAmount)}</td>
            </tr>

            <tr className="border-b text-xs text-gray-500">
              <td className="px-3 py-1">
                Cotisation CNSS (part patronale)
                <span className="ml-1 italic">— Non pris en compte dans le calcul du net</span>
              </td>
              <td className="px-3 py-1 text-right">{fmt(payroll.cssBase)}</td>
              <td className="px-3 py-1 text-right">
                {fmtRate(
                  payroll.cssBase > 0 ? (payroll.cssEmployerAmount / payroll.cssBase) * 100 : 0
                )}
              </td>
              <td className="px-3 py-1 text-right">{fmt(payroll.cssEmployerAmount)}</td>
            </tr>

            {/* NET */}
            <tr className="bg-emerald-50 font-bold">
              <td className="px-3 py-2 text-base whitespace-nowrap">NET À PAYER</td>
              <td className="px-3 py-2 text-right text-base">—</td>
              <td className="px-3 py-2 text-right text-base">—</td>
              <td className="px-3 py-2 text-right text-base whitespace-nowrap">
                {fmt(payroll.netSalary)} FCFA
              </td>
            </tr>
          </tbody>

          <tbody>
            {/* CHARGES PATRONALES */}
            <tr style={{ backgroundColor: "#f8f9fa" }}>
              <td
                colSpan={4}
                className="px-3 py-1 text-xs font-bold uppercase"
                style={{ color: theme.primary }}
              >
                Charge globale employeur
              </td>
            </tr>
            <tr
              className="border-b-2 font-bold"
              style={{ borderColor: theme.primary }}
            >
              <td className="px-3 py-1">Coût total employeur (sans les frais d&apos;assurance)</td>
              <td className="px-3 py-1 text-right">—</td>
              <td className="px-3 py-1 text-right">—</td>
              <td className="px-3 py-1 text-right">{fmt(payroll.totalEmployerCost)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {payroll.notes && (
        <div className="mt-2 text-sm text-gray-600">
          <span className="font-medium">Note :</span> {payroll.notes}
        </div>
      )}

      {/* Signatures */}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium">Signature de l&apos;employé</p>
          <p className="mt-3 text-xs text-gray-500">Lu et approuvé</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">Cachet & Signature de l&apos;employeur</p>
          <p className="mt-3 text-xs font-medium">{company.name}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="page-footer mt-auto border-t pt-1 pb-1 text-center text-xs text-gray-500">
        {footerLine1 && <p>{footerLine1}</p>}
        {footerLine2 && <p>{footerLine2}</p>}
      </div>
    </div>
  );
}
