import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { publicPrisma } from "@/lib/prisma";
import { serverHasPermission, getServerAuth } from "@/lib/server-auth";
import { getSession } from "@/lib/session";
import { PrintButton } from "../imprimer/print-button";
import { PaginatedRows } from "@/components/pagination";

export default async function PayrollValidationPage({
  searchParams,
}: {
  searchParams: { m?: string; y?: string };
}) {
  if (!(await serverHasPermission("comptabilite", "read"))) {
    redirect("/cabinet");
  }

  await getServerAuth();
  const session = await getSession();
  const tenantId = session.tenantId || process.env.DEFAULT_TENANT_ID;

  const now = new Date();
  const month = Number(searchParams.m) || now.getMonth() + 1;
  const year = Number(searchParams.y) || now.getFullYear();

  const payrolls = await prisma.payroll.findMany({
    where: {
      periodMonth: month,
      periodYear: year,
      status: "draft",
    },
    include: { employee: true },
    orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
  });

  const irppTotals = await prisma.payroll.groupBy({
    by: ["employeeId"],
    where: {
      periodYear: year,
      periodMonth: { lte: month },
      employeeId: { in: payrolls.map((p: any) => p.employeeId) },
    },
    _sum: { irppAmount: true },
  });

  const irppByEmployee = Object.fromEntries(
    irppTotals.map((t: any) => [t.employeeId, t._sum.irppAmount || 0])
  );

  if (payrolls.length === 0) {
    return (
      <div className="mx-auto max-w-4xl py-8 print:max-w-none print:py-0">
        <div className="rounded-md bg-amber-50 p-4 text-center text-amber-700">
          Aucune paie en brouillon pour {month}/{year}.
        </div>
      </div>
    );
  }

  const tenant = tenantId
    ? await publicPrisma.tenant.findUnique({
        where: { id: tenantId },
      })
    : null;
  const config = (tenant?.configuration as Record<string, unknown>) || {};
  const pdfTheme = (config.pdfTheme as { primaryColor?: string; secondaryColor?: string }) || {};

  const theme = {
    primary: pdfTheme.primaryColor || "#2c4c7c",
    secondary: pdfTheme.secondaryColor || "#c78124",
  };

  const companyName = tenant?.raisonSociale || "Cabinet";
  const logoUrl = tenant?.logoUrl || null;
  const companyAddress = tenant?.adresse || "";
  const ninea = tenant?.identifiantFiscal || String(config.ninea || "");
  const rcc = String(config.identificationLegale || "");
  const rib = String(config.rib || "");
  const phone = String(config.telephonePrincipal || "");
  const email = String(config.email || "");
  const website = String(config.siteWeb || "");

  const companyDetails = [
    companyAddress,
    ninea && `NINEA : ${ninea}`,
    rcc && `N° RCC : ${rcc}`,
    rib && `RIB ${rib}`,
  ]
    .filter(Boolean)
    .join(" - ");

  const fmt = (n: number) =>
    Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 });

  const monthYearLabel = new Date(year, month - 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  const totals = payrolls.reduce(
    (acc: any, p: any) => {
      acc.gross += Number(p.grossSalary || 0);
      acc.net += Number(p.netSalary || 0);
      acc.irpp += Number(irppByEmployee[p.employeeId] || 0);
      acc.employerCost += Number(p.totalEmployerCost || 0);
      return acc;
    },
    { gross: 0, net: 0, irpp: 0, employerCost: 0 }
  );

  const footerContacts = [website, phone, email].filter(Boolean).join(" | ");

  return (
    <div className="mx-auto max-w-4xl py-4 print:max-w-none print:py-0">
      <div className="mb-3 flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">
          Paie à valider — {monthYearLabel} ({payrolls.length})
        </h1>
        <PrintButton label="Imprimer la liste" />
      </div>

      <div
        className="page flex min-h-[calc(100vh-4rem)] flex-col bg-white p-4 print:min-h-[calc(100vh-2rem)]"
        style={{ pageBreakAfter: "auto" }}
      >
        {/* En-tête société */}
        <div className="border-b-2 pb-4" style={{ borderColor: theme.primary }}>
          <div className="flex items-start gap-4">
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                className="h-16 w-auto object-contain print:h-14"
              />
            )}
            <div className="flex-1">
              <h2
                className="text-xl font-bold uppercase tracking-wide print:text-base"
                style={{ color: theme.primary }}
              >
                {companyName}
              </h2>
              <div className="mt-1 text-sm text-gray-700 print:text-xs">
                {companyDetails && <p>{companyDetails}</p>}
                <p className="mt-1">{footerContacts}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Titre et période */}
        <div className="mt-4 text-center">
          <h3 className="text-2xl font-bold uppercase" style={{ color: theme.primary }}>
            Fiche de validation de paie
          </h3>
          <p className="text-sm font-medium text-gray-600">
            Période : {monthYearLabel} — {payrolls.length} employé(s) en brouillon
          </p>
        </div>

        {/* Tableau récapitulatif */}
        <div className="mt-6">
          <table className="w-full border-collapse text-sm">
            <thead style={{ backgroundColor: theme.primary }} className="text-white">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Employé</th>
                <th className="px-3 py-2 text-right font-semibold">Brut</th>
                <th className="px-3 py-2 text-right font-semibold">Net</th>
                <th className="px-3 py-2 text-right font-semibold">Total IRPP</th>
                <th className="px-3 py-2 text-right font-semibold">Coût employeur<br />(sans l&apos;assurance)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <PaginatedRows colSpan={5}>
              {payrolls.map((p: any) => (
                <tr key={p.id} className="border-b">
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">
                      {p.employee.firstName} {p.employee.lastName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {p.employee.employeeCode} — {p.employee.position || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(p.grossSalary)}</td>
                  <td className="px-3 py-2 text-right">{fmt(p.netSalary)}</td>
                  <td className="px-3 py-2 text-right">
                    {fmt(irppByEmployee[p.employeeId] || 0)}
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(p.totalEmployerCost)}</td>
                </tr>
              ))}
              </PaginatedRows>
              <tr
                className="border-t-2 font-bold"
                style={{ borderColor: theme.primary }}
              >
                <td className="px-3 py-2">TOTAUX</td>
                <td className="px-3 py-2 text-right">{fmt(totals.gross)}</td>
                <td className="px-3 py-2 text-right">{fmt(totals.net)}</td>
                <td className="px-3 py-2 text-right">{fmt(totals.irpp)}</td>
                <td className="px-3 py-2 text-right">{fmt(totals.employerCost)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signatures de validation */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded border border-gray-200 p-3">
            <p className="text-sm font-semibold">Préparé par</p>
            <p className="mt-8 text-sm text-gray-500">Nom et signature :</p>
            <div className="mt-2 h-12 border-b border-gray-300"></div>
            <p className="mt-2 text-xs text-gray-500">Date :</p>
          </div>
          <div className="rounded border border-gray-200 p-3">
            <p className="text-sm font-semibold">Validé par</p>
            <p className="mt-8 text-sm text-gray-500">Nom et signature :</p>
            <div className="mt-2 h-12 border-b border-gray-300"></div>
            <p className="mt-2 text-xs text-gray-500">Date :</p>
          </div>
        </div>

        <p className="mt-6 text-xs text-gray-600">
          Cette fiche récapitule les bulletins de salaire en statut « Brouillon » pour la période
          indiquée. Après vérification des montants, la signature du responsable permet de
          procéder à la validation en ligne.
        </p>

        {/* Footer */}
        <div className="mt-auto border-t pt-2 pb-2 text-center text-xs text-gray-500">
          <p>
            {companyName}
            {companyDetails && ` | ${companyDetails}`}
            {website && ` | ${website}`}
            {phone && ` | ${phone}`}
          </p>
        </div>
      </div>
    </div>
  );
}
