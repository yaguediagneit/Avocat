import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { publicPrisma } from "@/lib/prisma";
import { serverHasPermission, getServerAuth } from "@/lib/server-auth";
import { getSession } from "@/lib/session";
import { PayrollBulletin } from "./payroll-bulletin";
import { PrintButton } from "./print-button";

export default async function PrintMonthPayrollsPage({
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
    where: { periodMonth: month, periodYear: year },
    include: {
      employee: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
  });

  if (payrolls.length === 0) {
    return (
      <div className="mx-auto max-w-4xl py-8">
        <div className="rounded-md bg-amber-50 p-4 text-center text-amber-700">
          Aucun bulletin de paie pour {month}/{year}.
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
  const phone = String(config.telephonePrincipal || "");
  const slogan = String(config.slogan || "");
  const address = tenant?.adresse || "";
  const identificationLegale = String(config.identificationLegale || "");
  const identifiantFiscal = tenant?.identifiantFiscal || "";
  const email = String(config.email || "");
  const website = String(config.siteWeb || "");

  const company = {
    name: companyName,
    logoUrl,
    slogan,
    phone,
    address,
    identificationLegale,
    identifiantFiscal,
    email,
    website,
  };

  const monthYearLabel = new Date(year, month - 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-4xl py-4 print:max-w-none print:py-0">
      <div className="mb-3 flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">
          Bulletins de salaire — {monthYearLabel} ({payrolls.length})
        </h1>
        <PrintButton label={`Imprimer les ${payrolls.length} bulletins`} />
      </div>

      <div className="space-y-0">
        {payrolls.map((p) => (
          <PayrollBulletin key={p.id} payroll={p} company={company} theme={theme} />
        ))}
      </div>
    </div>
  );
}
