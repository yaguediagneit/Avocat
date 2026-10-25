import { redirect } from "next/navigation";
import { publicPrisma } from "@/lib/prisma";
import { serverHasPermission } from "@/lib/server-auth";
import PaymentsSection from "../payments-section";

export default async function VersementsPage() {
  if (!(await serverHasPermission("comptabilite", "read"))) {
    redirect("/cabinet");
  }

  const tenantId = process.env.DEFAULT_TENANT_ID!;
  const tenant = await publicPrisma.tenant.findUnique({
    where: { id: tenantId },
    select: { raisonSociale: true, adresse: true, logoUrl: true, configuration: true },
  });
  const config = (tenant?.configuration as Record<string, unknown> | null) || {};
  const pdfTheme = (config.pdfTheme as Record<string, unknown> | null) || {};
  const cabinet = {
    raisonSociale: tenant?.raisonSociale || "",
    adresse: tenant?.adresse || "",
    telephonePrincipal: String(config.telephonePrincipal || ""),
    email: String(config.email || ""),
    logoUrl: tenant?.logoUrl || "",
    pdfTheme: {
      primaryColor: String(pdfTheme.primaryColor || "#2c4c7c"),
      secondaryColor: String(pdfTheme.secondaryColor || "#c78124"),
      fontFamily: String(pdfTheme.fontFamily || "Helvetica"),
      fontSize: Number(pdfTheme.fontSize) || 11,
      headerText: String(pdfTheme.headerText || ""),
      footerText: String(pdfTheme.footerText || ""),
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Versements sociaux et fiscaux</h1>
        <p className="text-sm text-gray-600">Suivi et impression des versements</p>
      </div>
      <PaymentsSection cabinet={cabinet} />
    </div>
  );
}
