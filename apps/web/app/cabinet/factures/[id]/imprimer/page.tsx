import { redirect } from "next/navigation";
import { prisma, publicPrisma } from "@/lib/prisma";
import { serverHasPermission } from "@/lib/server-auth";
import { getSession } from "@/lib/session";
import { FactureBulletin } from "./facture-bulletin";

export default async function PrintFacturePage({ params }: { params: { id: string } }) {
  if (!(await serverHasPermission("factures", "read"))) {
    redirect("/cabinet");
  }

  const session = await getSession();
  const tenantId = session.tenantId || process.env.DEFAULT_TENANT_ID;

  const facture = await prisma.facture.findFirst({
    where: { id: params.id },
    include: {
      client: true,
      dossier: { select: { referenceInterne: true } },
      lines: { orderBy: { ordre: "asc" } },
      paiements: true,
      tvaRate: { select: { label: true, rate: true } },
    },
  });

  if (!facture) {
    redirect("/cabinet/factures");
  }

  const tenant = tenantId
    ? await publicPrisma.tenant.findUnique({ where: { id: tenantId } })
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

  const company = {
    name: companyName,
    logoUrl,
    address: companyAddress,
    details: companyDetails,
    phone,
    email,
    website,
  };

  return <FactureBulletin facture={facture} company={company} theme={theme} />;
}
