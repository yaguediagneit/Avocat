import { redirect } from "next/navigation";
import { prisma, publicPrisma } from "@/lib/prisma";
import { serverHasPermission } from "@/lib/server-auth";
import { getSession } from "@/lib/session";
import { PrintButton } from "../../paie/imprimer/print-button";

function fmt(n: number) {
  return n.toLocaleString("fr-FR") + " FCFA";
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("fr-FR");
}

export default async function BilanEmployePage({
  searchParams,
}: {
  searchParams: { employe?: string; debut?: string; fin?: string; mois?: string; annee?: string };
}) {
  if (!(await serverHasPermission("comptabilite", "read"))) {
    redirect("/cabinet");
  }

  const session = await getSession();
  const tenantId = session?.tenantId || process.env.DEFAULT_TENANT_ID;

  const now = new Date();
  const year = Number(searchParams.annee) || now.getFullYear();
  const mois = searchParams.mois ? Number(searchParams.mois) : null;

  let debut = searchParams.debut;
  let fin = searchParams.fin;
  let allPeriods = false;

  if (mois) {
    const start = new Date(year, mois - 1, 1);
    const end = new Date(year, mois, 0);
    debut = start.toISOString().slice(0, 10);
    fin = end.toISOString().slice(0, 10);
  } else if (!debut || !fin) {
    allPeriods = true;
    debut = undefined;
    fin = undefined;
  }

  const dateDebut = debut ? new Date(`${debut}T00:00:00`) : null;
  const dateFin = fin ? new Date(`${fin}T23:59:59`) : null;

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
  const address = tenant?.adresse || "";
  const phone = String(config.telephonePrincipal || "");
  const email = String(config.email || "");
  const website = String(config.siteWeb || "");
  const slogan = String(config.slogan || "");
  const dateGeneree = now.toLocaleDateString("fr-FR");

  const employeeId = searchParams.employe || "";

  if (!employeeId) {
    const insured = await prisma.insuredEmployee.findMany({
      include: { employee: true },
      orderBy: { employee: { lastName: "asc" } },
    });
    const seen = new Set<string>();
    const options = insured
      .filter((ie) => (seen.has(ie.employee.id) ? false : (seen.add(ie.employee.id), true)))
      .map((ie) => ie.employee);
    return (
      <div className="mx-auto max-w-xl py-10">
        <h1 className="mb-4 text-2xl font-bold">Bilan employé — Assurance</h1>
        <form method="get" className="card space-y-3 p-4">
          <label className="block text-sm font-medium text-gray-700">Employé</label>
          <select name="employe" required className="input w-full">
            <option value="">— Choisir un employé —</option>
            {options.map((e) => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Du (optionnel)</label>
              <input type="date" name="debut" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Au (optionnel)</label>
              <input type="date" name="fin" className="input w-full" />
            </div>
          </div>
          <p className="text-xs text-gray-500">Sans dates, toutes les périodes sont incluses.</p>
          <button type="submit" className="rounded-lg bg-cabinet-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-cabinet-800">
            Générer le bilan
          </button>
        </form>
      </div>
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      insuredEmployees: {
        include: { contract: { include: { insurer: true } } },
        orderBy: { dateAdhesion: "desc" },
      },
    },
  });

  if (!employee) {
    redirect("/cabinet/personnel/assurances/bilan-employe");
  }

  const insuredIds = employee.insuredEmployees.map((ie) => ie.id);
  const adhesion = employee.insuredEmployees[0] || null;

  const dependents = await prisma.employeeDependent.findMany({
    where: { employeeId: employee.id, statut: "actif" },
    orderBy: { nom: "asc" },
  });

  const invoices = await prisma.medicalInvoice.findMany({
    where: {
      insuredEmployeeId: { in: insuredIds },
      statut: { not: "annulee" },
      ...(dateDebut && dateFin ? { dateSoins: { gte: dateDebut, lte: dateFin } } : {}),
    },
    include: {
      dependent: true,
      provider: true,
      contract: { include: { insurer: true } },
    },
    orderBy: { dateSoins: "desc" },
  });

  const totals = invoices.reduce(
    (acc, inv) => {
      acc.totalFactures += inv.montantTotal;
      acc.totalPartCabinet += inv.partCabinet;
      acc.totalPartEmploye += inv.partEmploye;
      acc.totalPayeEmploye += inv.montantPayeEmploye;
      acc.totalResteEmploye += inv.resteAPayerEmploye;
      return acc;
    },
    { totalFactures: 0, totalPartCabinet: 0, totalPartEmploye: 0, totalPayeEmploye: 0, totalResteEmploye: 0 }
  );

  const totalsByBeneficiary: Record<string, { nom: string; count: number; total: number; partEmploye: number; partCabinet: number }> = {};
  for (const inv of invoices) {
    const key = inv.dependent?.id || "employe";
    const nom = inv.dependent
      ? `${inv.dependent.prenom} ${inv.dependent.nom}`
      : `${employee.firstName} ${employee.lastName}`;
    if (!totalsByBeneficiary[key]) {
      totalsByBeneficiary[key] = { nom, count: 0, total: 0, partEmploye: 0, partCabinet: 0 };
    }
    const t = totalsByBeneficiary[key];
    t.count += 1;
    t.total += inv.montantTotal;
    t.partEmploye += inv.partEmploye;
    t.partCabinet += inv.partCabinet;
  }

  const employeeName = `${employee.firstName} ${employee.lastName}`;
  const periodeLabel = allPeriods
    ? invoices.length
      ? `du ${fmtDate(invoices[invoices.length - 1].dateSoins)} au ${fmtDate(invoices[0].dateSoins)}`
      : "Toutes périodes"
    : `du ${new Date(debut!).toLocaleDateString("fr-FR")} au ${new Date(fin!).toLocaleDateString("fr-FR")}`;

  return (
    <div className="mx-auto max-w-6xl py-4 print:max-w-none print:py-0">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm 12mm; }
          body { background: white; color: black; font-size: 9pt; }
          .print-hide { display: none !important; }
          .print-section { page-break-inside: auto; }
          .print-row { page-break-inside: avoid; }
        }
      `}</style>

      <div className="mb-3 flex items-center justify-between print-hide">
        <h1 className="text-2xl font-bold">Bilan employé — {employeeName}</h1>
        <PrintButton label="Imprimer / PDF" />
      </div>

      <div className="mb-4 print-section">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 pb-3" style={{ borderColor: theme.secondary }}>
          <div className="flex items-start gap-3">
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                className="h-14 w-auto object-contain print:h-12"
              />
            )}
            <div>
              <h2 className="text-2xl font-bold uppercase" style={{ color: theme.primary }}>
                {companyName}
              </h2>
              {slogan && <p className="text-sm italic text-gray-600">{slogan}</p>}
              <p className="text-xs text-gray-600">
                {[address, phone, email, website].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-600">
            <p>Document généré le {dateGeneree}</p>
            <p>Période : {periodeLabel}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded border border-gray-200 p-3 print-section">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
          <p><span className="text-gray-500">Employé : </span><span className="font-semibold">{employeeName}</span></p>
          <p><span className="text-gray-500">Matricule : </span>{employee.employeeCode}</p>
          <p><span className="text-gray-500">N° adhérent : </span>{adhesion?.numeroAdherent || "—"}</p>
          <p><span className="text-gray-500">Formule : </span>{adhesion?.formule || "—"}</p>
          <p><span className="text-gray-500">Contrat : </span>{adhesion ? adhesion.contract.reference : "—"}</p>
          <p><span className="text-gray-500">Assureur : </span>{adhesion ? adhesion.contract.insurer.nom : "—"}</p>
          <p><span className="text-gray-500">Taux : </span>{adhesion ? `${adhesion.tauxParticulier ?? adhesion.contract.tauxGeneral} %` : "—"}</p>
          <p><span className="text-gray-500">Ayants droit : </span>{dependents.length}</p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print-section">
        <div className="rounded border border-gray-200 p-2">
          <p className="text-xs text-gray-500">Total factures</p>
          <p className="text-lg font-bold" style={{ color: theme.primary }}>{fmt(totals.totalFactures)}</p>
        </div>
        <div className="rounded border border-gray-200 p-2">
          <p className="text-xs text-gray-500">Part cabinet</p>
          <p className="text-lg font-bold" style={{ color: theme.primary }}>{fmt(totals.totalPartCabinet)}</p>
        </div>
        <div className="rounded border border-gray-200 p-2">
          <p className="text-xs text-gray-500">Part employé</p>
          <p className="text-lg font-bold" style={{ color: theme.primary }}>{fmt(totals.totalPartEmploye)}</p>
        </div>
        <div className="rounded border border-gray-200 p-2">
          <p className="text-xs text-gray-500">Reste à payer employé</p>
          <p className="text-lg font-bold" style={{ color: theme.primary }}>{fmt(totals.totalResteEmploye)}</p>
        </div>
      </div>

      <h3 className="mb-2 text-lg font-semibold" style={{ color: theme.primary }}>
        Détail des factures ({invoices.length})
      </h3>
      <div className="overflow-x-auto print-section">
        <table className="w-full table-fixed border-collapse border border-gray-300 text-[9px]">
          <thead>
            <tr style={{ backgroundColor: theme.primary }} className="text-white">
              <th className="border border-gray-300 px-2 py-1 text-left w-24 text-[6px]">Réf.</th>
              <th className="border border-gray-300 px-2 py-1 text-left w-20">Date soins</th>
              <th className="border border-gray-300 px-2 py-1 text-left w-40">Bénéficiaire</th>
              <th className="border border-gray-300 px-2 py-1 text-left w-28">Prestataire</th>
              <th className="border border-gray-300 px-2 py-1 text-left w-24">Contrat</th>
              <th className="border border-gray-300 px-2 py-1 text-right w-20">Total</th>
              <th className="border border-gray-300 px-2 py-1 text-right w-20">Part emp.</th>
              <th className="border border-gray-300 px-2 py-1 text-right w-20">Part cab.</th>
              <th className="border border-gray-300 px-2 py-1 text-left w-20">Statut</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr>
                <td colSpan={9} className="px-2 py-4 text-center text-gray-500">
                  Aucune facture sur la période.
                </td>
              </tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="print-row">
                <td className="border border-gray-300 px-2 py-1 w-24 text-[6px] whitespace-nowrap font-medium">{inv.referenceInterne}</td>
                <td className="border border-gray-300 px-2 py-1 w-20 whitespace-nowrap">{fmtDate(inv.dateSoins)}</td>
                <td className="border border-gray-300 px-2 py-1 w-40 whitespace-nowrap overflow-hidden text-ellipsis">
                  {inv.dependent ? `${inv.dependent.prenom} ${inv.dependent.nom}` : "Employé"}
                </td>
                <td className="border border-gray-300 px-2 py-1 w-28 whitespace-nowrap overflow-hidden text-ellipsis">{inv.provider.nom}</td>
                <td className="border border-gray-300 px-2 py-1 w-24 whitespace-nowrap overflow-hidden text-ellipsis">{inv.contract.reference}</td>
                <td className="border border-gray-300 px-2 py-1 w-20 text-right whitespace-nowrap">{fmt(inv.montantTotal)}</td>
                <td className="border border-gray-300 px-2 py-1 w-20 text-right whitespace-nowrap">{fmt(inv.partEmploye)}</td>
                <td className="border border-gray-300 px-2 py-1 w-20 text-right whitespace-nowrap">{fmt(inv.partCabinet)}</td>
                <td className="border border-gray-300 px-2 py-1 w-20 whitespace-nowrap overflow-hidden text-ellipsis">{inv.statut}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold" style={{ backgroundColor: "#f3f4f6" }}>
              <td className="border border-gray-300 px-2 py-1" colSpan={5}>Total</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{fmt(totals.totalFactures)}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{fmt(totals.totalPartEmploye)}</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{fmt(totals.totalPartCabinet)}</td>
              <td className="border border-gray-300 px-2 py-1"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <h3 className="mb-2 mt-6 text-lg font-semibold" style={{ color: theme.primary }}>
        Totaux par bénéficiaire
      </h3>
      <div className="overflow-x-auto print-section">
        <table className="w-full max-w-3xl table-fixed border-collapse border border-gray-300 text-[9px]">
          <thead>
            <tr style={{ backgroundColor: theme.primary }} className="text-white">
              <th className="border border-gray-300 px-2 py-1 text-left w-1/3">Bénéficiaire</th>
              <th className="border border-gray-300 px-2 py-1 text-right w-1/6">Nbre factures</th>
              <th className="border border-gray-300 px-2 py-1 text-right w-1/6">Total factures</th>
              <th className="border border-gray-300 px-2 py-1 text-right w-1/6">Part employé</th>
              <th className="border border-gray-300 px-2 py-1 text-right w-1/6">Part cabinet</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(totalsByBeneficiary).length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-gray-500">
                  Aucun bénéficiaire sur la période.
                </td>
              </tr>
            )}
            {Object.values(totalsByBeneficiary).map((t) => (
              <tr key={t.nom} className="print-row">
                <td className="border border-gray-300 px-2 py-1 w-1/3 whitespace-nowrap overflow-hidden text-ellipsis font-medium">{t.nom}</td>
                <td className="border border-gray-300 px-2 py-1 w-1/6 text-right whitespace-nowrap">{t.count}</td>
                <td className="border border-gray-300 px-2 py-1 w-1/6 text-right whitespace-nowrap">{fmt(t.total)}</td>
                <td className="border border-gray-300 px-2 py-1 w-1/6 text-right whitespace-nowrap">{fmt(t.partEmploye)}</td>
                <td className="border border-gray-300 px-2 py-1 w-1/6 text-right whitespace-nowrap">{fmt(t.partCabinet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-right text-xs text-gray-500">
        <p>Document généré le {dateGeneree} · {companyName}</p>
      </div>
    </div>
  );
}
