import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantPrisma, publicPrisma } from "@/lib/prisma";
import { serverHasPermission, getServerAuth } from "@/lib/server-auth";
import { VersementsButton } from "./versements-button";
import { PaginatedRows } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

const cardBase =
  "group flex min-h-[7rem] flex-col rounded-lg border px-4 py-3 shadow-sm transition hover:shadow-md";

export default async function ComptabiliteDashboardPage({
  searchParams,
}: {
  searchParams: { sort?: string; dir?: string };
}) {
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/cabinet/comptabilite", params: searchParams };
  // Isolation : réservé aux rôles ayant la permission comptabilite.
  if (!(await serverHasPermission("comptabilite", "read"))) {
    redirect("/cabinet");
  }

  const canReadFactures = await serverHasPermission("factures", "read");
  const auth = await getServerAuth();
  const canApprove = auth.role.nom.toLowerCase().includes("comptable") || auth.role.estAdmin;

  const prisma = await getTenantPrisma(process.env.DEFAULT_TENANT_ID!);

  const tenantId = process.env.DEFAULT_TENANT_ID!;
  const [accountsCount, journalsCount, entriesCount] = await Promise.all([
    prisma.accountingAccount.count(),
    prisma.accountingJournal.count(),
    prisma.accountingEntry.count({ where: { tenantId } }),
  ]);

  const pendingInvoices = canApprove
    ? await prisma.medicalInvoice.findMany({
        where: { statut: "brouillon" },
        include: {
          insuredEmployee: { include: { employee: true } },
          dependent: true,
          provider: true,
          contract: { include: { insurer: true } },
        },
        orderBy: { dateSoins: "desc" },
        take: 10,
      })
    : [];

  const year = new Date().getFullYear();

  // Infos du cabinet pour l'en-tête d'impression des versements
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comptabilité Syscohada</h1>
          <p className="text-sm text-gray-600">Module de comptabilité automatisée</p>
        </div>
        <div className="flex items-center gap-3">
          {canReadFactures && (
            <Link
              href="/cabinet/factures"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-600"
            >
              Factures
            </Link>
          )}
          <Link
            href="/cabinet/charges"
            className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-600"
          >
            Charges
          </Link>
          <Link
            href="/cabinet/paiements-intervenants"
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-600"
          >
            Paiement Intervenant externe
          </Link>
          <VersementsButton cabinet={cabinet} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Colonne 1 — Comptes */}
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
            <p className="text-sm text-emerald-600">Comptes</p>
            <p className="text-2xl font-bold text-emerald-800">{accountsCount}</p>
          </div>
          <Link
            href="/cabinet/comptabilite/plan"
            className={`${cardBase} border-emerald-200 bg-emerald-50 hover:border-emerald-300`}
          >
            <h3 className="font-semibold text-emerald-800">Plan comptable</h3>
            <p className="mt-1 text-sm text-emerald-600">Consulter et rechercher les comptes Syscohada</p>
          </Link>
          <Link
            href="/cabinet/comptabilite/resultat"
            className={`${cardBase} border-emerald-200 bg-emerald-50 hover:border-emerald-300`}
          >
            <h3 className="font-semibold text-emerald-800">Compte de résultat</h3>
            <p className="mt-1 text-sm text-emerald-600">Charges et produits</p>
          </Link>
        </div>

        {/* Colonne 2 — Journaux */}
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 shadow-sm">
            <p className="text-sm text-yellow-600">Journaux</p>
            <p className="text-2xl font-bold text-yellow-800">{journalsCount}</p>
          </div>
          <Link
            href="/cabinet/comptabilite/journaux"
            className={`${cardBase} border-yellow-200 bg-yellow-50 hover:border-yellow-300`}
          >
            <h3 className="font-semibold text-yellow-800">Journaux</h3>
            <p className="mt-1 text-sm text-yellow-600">Liste des journaux comptables</p>
          </Link>
          <Link
            href="/cabinet/comptabilite/tiers"
            className={`${cardBase} border-yellow-200 bg-yellow-50 hover:border-yellow-300`}
          >
            <h3 className="font-semibold text-yellow-800">Tiers</h3>
            <p className="mt-1 text-sm text-yellow-600">Clients, fournisseurs, employés, collaborateurs externes</p>
          </Link>
        </div>

        {/* Colonne 3 — Écritures */}
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 shadow-sm">
            <p className="text-sm text-orange-600">Écritures</p>
            <p className="text-2xl font-bold text-orange-800">{entriesCount}</p>
          </div>
          <Link
            href="/cabinet/comptabilite/ecritures"
            className={`${cardBase} border-orange-200 bg-orange-50 hover:border-orange-300`}
          >
            <h3 className="font-semibold text-orange-800">Écritures</h3>
            <p className="mt-1 text-sm text-orange-600">Saisie et consultation des écritures</p>
          </Link>
          <Link
            href="/cabinet/comptabilite/grand-livre"
            className={`${cardBase} border-orange-200 bg-orange-50 hover:border-orange-300`}
          >
            <h3 className="font-semibold text-orange-800">Grand-livre</h3>
            <p className="mt-1 text-sm text-orange-600">Mouvements détaillés par compte</p>
          </Link>
        </div>

        {/* Colonne 4 — Exercice */}
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-stone-500">Exercice</p>
            <p className="text-2xl font-bold text-stone-800">{year}</p>
          </div>
          <Link
            href="/cabinet/comptabilite/bilan"
            className={`${cardBase} border-gray-200 bg-white hover:border-gray-300`}
          >
            <h3 className="font-semibold text-stone-800">Bilan</h3>
            <p className="mt-1 text-sm text-stone-500">Bilan actif / passif</p>
          </Link>
          <Link
            href="/cabinet/comptabilite/rapport"
            className={`${cardBase} border-blue-900 bg-blue-900 hover:border-blue-800`}
          >
            <h3 className="font-semibold text-white">Rapport financier</h3>
            <p className="mt-1 text-sm text-white/80">Rapport OHADA complet : bilan, résultat, SIG, flux, paie</p>
          </Link>
        </div>
      </div>

      {canApprove && (
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between p-4">
            <h2 className="font-semibold">Factures d&apos;assurance à approuver</h2>
            <Link href="/cabinet/personnel/assurances" className="text-sm text-emerald-600 hover:underline">
              Voir tout
            </Link>
          </div>
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="ref" label="Réf." className="px-4 py-3" />
                <SortableTh {...thProps} column="date" label="Date" className="px-4 py-3" />
                <SortableTh {...thProps} column="employe" label="Employé" className="px-4 py-3" />
                <SortableTh {...thProps} column="beneficiaire" label="Bénéficiaire" className="px-4 py-3" />
                <SortableTh {...thProps} column="prestataire" label="Prestataire" className="px-4 py-3" />
                <SortableTh {...thProps} column="montant" label="Montant" className="px-4 py-3 text-right" />
              </tr>
            </thead>
            <tbody>
              {pendingInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    Aucune facture à approuver.
                  </td>
                </tr>
              )}
              <PaginatedRows colSpan={6}>
              {sortRows(pendingInvoices, sort, {
                ref: (inv) => inv.referenceInterne,
                date: (inv) => inv.dateSoins,
                employe: (inv) => `${inv.insuredEmployee.employee.lastName} ${inv.insuredEmployee.employee.firstName}`,
                beneficiaire: (inv) => (inv.dependent ? `${inv.dependent.prenom} ${inv.dependent.nom}` : "Employé"),
                prestataire: (inv) => inv.provider.nom,
                montant: (inv) => Number(inv.montantTotal),
              }).map((inv) => (
                <tr key={inv.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{inv.referenceInterne}</td>
                  <td className="px-4 py-3">{inv.dateSoins.toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">{inv.insuredEmployee.employee.firstName} {inv.insuredEmployee.employee.lastName}</td>
                  <td className="px-4 py-3">
                    {inv.dependent ? `${inv.dependent.prenom} ${inv.dependent.nom}` : "Employé"}
                  </td>
                  <td className="px-4 py-3">{inv.provider.nom}</td>
                  <td className="px-4 py-3 text-right">{inv.montantTotal.toLocaleString("fr-FR")} FCFA</td>
                </tr>
              ))}
              </PaginatedRows>
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
