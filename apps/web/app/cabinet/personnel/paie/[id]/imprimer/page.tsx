import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { publicPrisma } from "@/lib/prisma";
import { serverHasPermission, getServerAuth } from "@/lib/server-auth";
import { getSession } from "@/lib/session";
import { PayrollBulletin } from "../../imprimer/payroll-bulletin";
import { PrintButton } from "../../imprimer/print-button";

export default async function PrintPayrollPage({
  params,
}: {
  params: { id: string };
}) {
  if (!(await serverHasPermission("comptabilite", "read"))) {
    redirect("/cabinet");
  }

  await getServerAuth();
  const session = await getSession();
  const tenantId = session.tenantId || process.env.DEFAULT_TENANT_ID;

  const payroll = await prisma.payroll.findUnique({
    where: { id: params.id },
    include: {
      employee: true,
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!payroll) {
    redirect("/cabinet/personnel");
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

  return (
    <div className="mx-auto max-w-4xl py-4 print:max-w-none print:py-0">
      <div className="mb-3 flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">Aperçu du bulletin</h1>
        <PrintButton />
      </div>

      <PayrollBulletin payroll={payroll} company={company} theme={theme} />
    </div>
  );
}
