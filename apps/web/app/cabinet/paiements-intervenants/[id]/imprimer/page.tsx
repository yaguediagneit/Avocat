import { redirect } from "next/navigation";
import { prisma, publicPrisma } from "@/lib/prisma";
import { serverHasPermission } from "@/lib/server-auth";
import { getSession } from "@/lib/session";
import { PaiementBulletin } from "./paiement-bulletin";

export default async function PrintPaiementIntervenantPage({ params }: { params: { id: string } }) {
  if (!(await serverHasPermission("comptabilite", "read"))) {
    redirect("/cabinet");
  }

  const session = await getSession();
  const tenantId = session.tenantId || process.env.DEFAULT_TENANT_ID;

  const charge = await prisma.charge.findFirst({
    where: { id: params.id },
    include: {
      category: true,
      tvaRate: { select: { label: true, rate: true } },
      lines: { orderBy: { ordre: "asc" } },
      dossier: { select: { referenceInterne: true } },
      tache: { select: { titre: true } },
      missionHuissier: { select: { typeActe: true } },
    },
  });

  if (!charge) {
    redirect("/cabinet/comptabilite");
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

  return <PaiementBulletin charge={charge} company={company} theme={theme} />;
}
