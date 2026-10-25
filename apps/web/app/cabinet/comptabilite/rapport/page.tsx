import { generateFinancialReport } from "@/lib/reporting";
import { getTenantPrisma, publicPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import Link from "next/link";
import RapportClient from "./rapport-client";
import { PeriodSelector } from "./period-selector";

function monthEnd(year: number, month: number): string {
  const d = new Date(year, month, 0, 23, 59, 59);
  return d.toISOString().split("T")[0];
}

function parsePeriod(params: { exercice?: string; mois?: string; debut?: string; fin?: string }) {
  const currentYear = new Date().getFullYear();
  const year = parseInt(params.exercice || String(currentYear), 10);
  const mois = params.mois ? parseInt(params.mois, 10) : undefined;

  if (params.debut && params.fin) {
    return { exercice: year, dateDebut: new Date(params.debut), dateFin: new Date(params.fin + "T23:59:59") };
  }

  if (mois && mois >= 1 && mois <= 12) {
    return {
      exercice: year,
      dateDebut: new Date(`${year}-${String(mois).padStart(2, "0")}-01`),
      dateFin: new Date(monthEnd(year, mois) + "T23:59:59"),
    };
  }

  return {
    exercice: year,
    dateDebut: new Date(`${year}-01-01`),
    dateFin: new Date(`${year}-12-31T23:59:59`),
  };
}

export default async function RapportPage({
  searchParams,
}: {
  searchParams: { exercice?: string; mois?: string; debut?: string; fin?: string };
}) {
  const tenantId = process.env.DEFAULT_TENANT_ID!;
  const prisma = await getTenantPrisma(tenantId);
  const period = parsePeriod(searchParams);
  const { exercice, dateDebut, dateFin } = period;
  const report = await generateFinancialReport(prisma, tenantId, period);

  // Infos du cabinet pour l'en-tête / pied de page du document imprimable
  const [tenant, session] = await Promise.all([
    publicPrisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        raisonSociale: true,
        adresse: true,
        identifiantFiscal: true,
        logoUrl: true,
        configuration: true,
      },
    }),
    getSession(),
  ]);

  // Nom de l'utilisateur pour le pied de page
  let userName = "Utilisateur";
  let isAdmin = false;
  if (session.userId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { prenom: true, nom: true, titre: true, role: { select: { estAdmin: true } } },
    });
    if (user) {
      userName = `${user.titre ? user.titre + " " : ""}${user.prenom} ${user.nom}`;
      isAdmin = user.role?.estAdmin ?? false;
    }
  }

  // Plan comptable : répartition des comptes par classe
  const allAccounts = await prisma.accountingAccount.findMany({
    where: { class: { in: [1, 2, 3, 4, 5, 6, 7, 8] } },
    select: { class: true, soldeActuel: true },
  });
  const classLabels: Record<number, string> = {
    1: "Capitaux",
    2: "Immobilisations",
    3: "Stocks",
    4: "Tiers",
    5: "Financiers",
    6: "Charges",
    7: "Produits",
    8: "Comptes spéciaux",
  };
  const planComptable = [1, 2, 3, 4, 5, 6, 7, 8].map((cls) => {
    const accountsOfClass = allAccounts.filter((a) => Number(a.class) === cls);
    return {
      classe: cls,
      label: `Classe ${cls} - ${classLabels[cls]}`,
      nombre: accountsOfClass.length,
      soldeTotal: accountsOfClass.reduce((s, a) => s + (Number(a.soldeActuel) || 0), 0),
    };
  });

  // Récapitulatif par journal
  const journals = await prisma.accountingJournal.findMany({
    select: { id: true, code: true, label: true },
    orderBy: { code: "asc" },
  });
  const journalStats = await Promise.all(
    journals.map(async (j) => {
      const entries = await prisma.accountingEntry.findMany({
        where: {
          tenantId,
          journalId: j.id,
          entryDate: { gte: dateDebut, lte: dateFin } },
        select: { id: true },
      });
      const entryIds = entries.map((e) => e.id);
      let totalDebit = 0;
      let totalCredit = 0;
      if (entryIds.length > 0) {
        const sums = await prisma.accountingEntryLine.aggregate({
          where: { tenantId, entryId: { in: entryIds } },
          _sum: { debit: true, credit: true },
        });
        totalDebit = Number(sums._sum.debit) || 0;
        totalCredit = Number(sums._sum.credit) || 0;
      }
      return {
        code: j.code,
        libelle: j.label,
        nbEcritures: entryIds.length,
        totalDebit,
        totalCredit,
      };
    })
  );

  const config = (tenant?.configuration as Record<string, unknown> | null) || {};
  const cabinet = {
    raisonSociale: tenant?.raisonSociale || "",
    description: String(config.description || ""),
    logoUrl: tenant?.logoUrl || "",
    adresse: tenant?.adresse || "",
    identifiantFiscal: tenant?.identifiantFiscal || "",
    identificationLegale: String(config.identificationLegale || ""),
    telephonePrincipal: String(config.telephonePrincipal || ""),
    telephoneSecondaire: String(config.telephoneSecondaire || ""),
    email: String(config.email || ""),
    siteWeb: String(config.siteWeb || ""),
  };

  // Sérialiser les dates pour le client
  const serializable = {
    ...report,
    dateDebut: report.dateDebut.toISOString(),
    dateFin: report.dateFin.toISOString(),
    entryLines: report.entryLines.map((l) => ({
      ...l,
      entry_date: l.entry_date.toISOString(),
    })),
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  const selectedMois = searchParams.mois ? parseInt(searchParams.mois, 10) : undefined;
  const periodeLibre = !!(searchParams.debut && searchParams.fin);

  return (
    <div className="space-y-6">
      <div className="space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Rapport Financier OHADA</h1>
            <p className="text-sm text-gray-600">
              {periodeLibre
                ? `Période du ${new Date(searchParams.debut + "T00:00:00").toLocaleDateString("fr-FR")} au ${new Date(searchParams.fin + "T00:00:00").toLocaleDateString("fr-FR")}`
                : selectedMois
                  ? `${new Date(`${exercice}-${String(selectedMois).padStart(2, "0")}-01`).toLocaleString("fr-FR", { month: "long" })} ${exercice}`
                  : `Exercice ${exercice}`}
            </p>
          </div>
          <Link
            href="/cabinet/comptabilite"
            className="text-sm text-cabinet-700 hover:underline"
          >
            ← Retour
          </Link>
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Exercice :</span>
            {years.map((y) => (
              <Link
                key={y}
                href={`/cabinet/comptabilite/rapport?exercice=${y}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  y === exercice && !selectedMois && !periodeLibre
                    ? "bg-cabinet-700 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {y}
              </Link>
            ))}
          </div>

          <div className="mb-3">
            <span className="mb-2 block text-sm font-medium text-gray-700">Mois :</span>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <Link
                  key={m}
                  href={`/cabinet/comptabilite/rapport?exercice=${exercice}&mois=${m}`}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                    selectedMois === m && !periodeLibre
                      ? "bg-cabinet-700 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {new Date(`${exercice}-${String(m).padStart(2, "0")}-01`).toLocaleString("fr-FR", { month: "short" })}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-gray-700">Période personnalisée :</span>
            <PeriodSelector />
          </div>
        </div>
      </div>

      <RapportClient
        report={serializable}
        exercice={exercice}
        cabinet={cabinet}
        userName={userName}
        isAdmin={isAdmin}
        planComptable={planComptable}
        journalStats={journalStats}
      />
    </div>
  );
}
