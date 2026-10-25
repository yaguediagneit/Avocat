import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { publicPrisma } from "@/lib/prisma";
import { generateFinancialReport } from "@/lib/reporting";
import {
  generateReportPdf,
  type CabinetInfo,
  type PdfThemeConfig,
  type ReportBlock,
  type ReportRow,
} from "@/lib/pdf-generator";
import {
  SIG_ROWS,
  CR_ROWS,
  CR_TOTAL_KEYS,
  FLUX_ROWS,
  CLASS_LABELS,
} from "@/lib/report-rows";

const DEFAULT_PDF_THEME: PdfThemeConfig = {
  primaryColor: "#2c4c7c",
  secondaryColor: "#c78124",
  fontFamily: "Helvetica",
  fontSize: 11,
  headerText: "",
  footerText: "",
};

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("fr-FR");
}

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const exercice = parseInt(
    searchParams.get("exercice") || String(new Date().getFullYear()),
    10
  );
  const mois = searchParams.get("mois");
  const debut = searchParams.get("debut");
  const fin = searchParams.get("fin");

  let dateDebut = new Date(`${exercice}-01-01`);
  let dateFin = new Date(`${exercice}-12-31T23:59:59`);

  if (debut && fin) {
    dateDebut = new Date(debut);
    dateFin = new Date(fin + "T23:59:59");
  } else if (mois) {
    const m = parseInt(mois, 10);
    dateDebut = new Date(`${exercice}-${String(m).padStart(2, "0")}-01`);
    dateFin = new Date(exercice, m, 0, 23, 59, 59);
  }

  const mode = searchParams.get("mode") || "detaille";
  const showTiers = mode === "detaille";
  const isReduit = mode === "reduit";

  const periodeLabel =
    searchParams.get("debut") && searchParams.get("fin")
      ? `du ${new Date(String(searchParams.get("debut"))).toLocaleDateString("fr-FR")} au ${new Date(String(searchParams.get("fin"))).toLocaleDateString("fr-FR")}`
      : searchParams.get("mois")
        ? `${new Date(`${exercice}-${String(searchParams.get("mois")).padStart(2, "0")}-01`).toLocaleString("fr-FR", { month: "long" })} ${exercice}`
        : `Exercice ${exercice}`;

  const prisma = ctx.prisma;
  const report = await generateFinancialReport(prisma, ctx.tenantId, { exercice, dateDebut, dateFin });

  // Infos cabinet + thème PDF (même source que la génération des documents)
  const tenant = await publicPrisma.tenant.findUnique({
    where: { id: ctx.tenantId },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Cabinet non trouvé" }, { status: 404 });
  }
  const config = (tenant.configuration as Record<string, unknown>) || {};
  const pdfTheme = (config.pdfTheme as Partial<PdfThemeConfig>) || {};

  const cabinet: CabinetInfo = {
    raisonSociale: tenant.raisonSociale,
    slogan: String(config.slogan ?? ""),
    adresse: tenant.adresse ?? undefined,
    telephone: String(config.telephonePrincipal ?? ""),
    telephoneSecondaire: String(config.telephoneSecondaire ?? ""),
    email: String(config.email ?? ""),
    siteWeb: String(config.siteWeb ?? ""),
    identifiantFiscal: tenant.identifiantFiscal ?? undefined,
    identificationLegale: String(config.identificationLegale ?? ""),
    logoUrl: tenant.logoUrl,
  };
  const theme: PdfThemeConfig = {
    ...DEFAULT_PDF_THEME,
    ...pdfTheme,
    fontFamily: (pdfTheme.fontFamily as PdfThemeConfig["fontFamily"]) || "Helvetica",
    fontSize: Number(pdfTheme.fontSize) || 11,
  };

  // Nom de l'utilisateur
  let userName = "Utilisateur";
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { prenom: true, nom: true, titre: true },
  });
  if (user) {
    userName = `${user.titre ? user.titre + " " : ""}${user.prenom} ${user.nom}`;
  }

  // Plan comptable : répartition par classe
  const allAccounts = await prisma.accountingAccount.findMany({
    where: { class: { in: [1, 2, 3, 4, 5, 6, 7, 8] } },
    select: { class: true, soldeActuel: true },
  });
  const planComptable = [1, 2, 3, 4, 5, 6, 7, 8].map((cls) => {
    const accountsOfClass = allAccounts.filter((a) => Number(a.class) === cls);
    return {
      classe: cls,
      label: `Classe ${cls} - ${CLASS_LABELS[cls]}`,
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
          tenantId: ctx.tenantId,
          journalId: j.id,
          entryDate: { gte: dateDebut, lte: dateFin },
        },
        select: { id: true },
      });
      const entryIds = entries.map((e) => e.id);
      let totalDebit = 0;
      let totalCredit = 0;
      if (entryIds.length > 0) {
        const sums = await prisma.accountingEntryLine.aggregate({
          where: { tenantId: ctx.tenantId, entryId: { in: entryIds } },
          _sum: { debit: true, credit: true },
        });
        totalDebit = Number(sums._sum.debit) || 0;
        totalCredit = Number(sums._sum.credit) || 0;
      }
      return { code: j.code, libelle: j.label, nbEcritures: entryIds.length, totalDebit, totalCredit };
    })
  );

  const { sig, bilan, flux, payroll, indicateurs: ind, compteResultat } = report;
  const t = compteResultat.totaux;
  const totalDebit = report.entryLines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = report.entryLines.reduce((s, l) => s + l.credit, 0);
  const dateGeneree = new Date().toLocaleDateString("fr-FR");

  // Données de contrôle
  const ecrituresCount = new Set(report.entryLines.map((l) => l.entry_id)).size;
  const lignesCount = report.entryLines.length;
  const ecartDebitCredit = totalDebit - totalCredit;
  const ecartProduitsChargesResultat = ind.totalProduits - ind.totalCharges - ind.resultatNet;
  const ecartResultatBilan = bilan.resultatNet - ind.resultatNet;
  const ecartResultatSIG = sig.resultat_net - ind.resultatNet;
  const ecartTVA = bilan.tvaCollectee - bilan.tvaRecuperable - bilan.tvaNette;
  const payrollOther = payroll.employee_count > 0
    ? payroll.total_gross_salary - payroll.total_net_salary - payroll.total_ipres_employee - payroll.total_css_employee - payroll.total_irpp
    : 0;
  const ecartPayeNet = payroll.employee_count > 0
    ? payroll.total_gross_salary - (payroll.total_ipres_employee + payroll.total_css_employee + payroll.total_irpp + payrollOther) - payroll.total_net_salary
    : 0;
  const ecartCoutEmployeur = payroll.employee_count > 0
    ? payroll.total_gross_salary + payroll.total_ipres_employer + payroll.total_css_employer - payroll.total_employer_charges
    : 0;

  function ctrl(value: number, tolerance = 0.0001): string {
    return Math.abs(value) <= tolerance ? "Conforme" : "À vérifier";
  }

  const blocks: ReportBlock[] = [];

  // 1. Tableau de bord
  blocks.push(
    { type: "sectionTitle", text: "1. Tableau de Bord" },
    {
      type: "stats",
      items: [
        { label: "Total Produits", value: `${fmt(ind.totalProduits)} F`, color: "green" },
        { label: "Total Charges", value: `${fmt(ind.totalCharges)} F`, color: "red" },
        { label: "Résultat Net", value: `${fmt(ind.resultatNet)} F`, color: ind.resultatNet >= 0 ? "green" : "red" },
        { label: "Écritures", value: String(ecrituresCount), color: "primary" },
        { label: "", value: "" },
        { label: "Lignes comptables", value: String(lignesCount), color: "primary" },
        { label: "Total Crédit", value: `${fmt(totalCredit)} F`, color: "primary" },
        { label: "", value: "" },
        { label: "Total Débit", value: `${fmt(totalDebit)} F`, color: "primary" },
      ],
    },
    { type: "sectionTitle", text: "Contrôles de cohérence comptable" },
    {
      type: "table",
      table: {
        columns: [
          { label: "Contrôle", weight: 4 },
          { label: "Attendu", align: "right", weight: 1.2 },
          { label: "Écart", align: "right", weight: 1.2 },
          { label: "Statut", align: "center", weight: 1.4 },
        ],
        rows: [
          { cells: ["Total débit = total crédit", "0 F", `${fmt(ecartDebitCredit)} F`, ctrl(ecartDebitCredit)] },
          { cells: ["Actif = passif", "0 F", `${fmt(bilan.ecart)} F`, ctrl(bilan.ecart)] },
          { cells: ["Produits − charges = résultat", "0 F", `${fmt(ecartProduitsChargesResultat)} F`, ctrl(ecartProduitsChargesResultat)] },
          { cells: ["Résultat SIG = résultat du tableau de bord", "0 F", `${fmt(ecartResultatSIG)} F`, ctrl(ecartResultatSIG)] },
          { cells: ["Résultat du bilan = résultat du compte de résultat (période annuelle)", "0 F", `${fmt(ecartResultatBilan)} F`, ctrl(ecartResultatBilan)] },
          { cells: ["TVA collectée − TVA récupérable = TVA nette", "0 F", `${fmt(ecartTVA)} F`, ctrl(ecartTVA)] },
          ...(payroll.employee_count > 0
            ? [
                { cells: ["Brut − retenues = net", "0 F", `${fmt(ecartPayeNet)} F`, ctrl(ecartPayeNet)] },
                { cells: ["Brut + charges patronales = coût employeur", "0 F", `${fmt(ecartCoutEmployeur)} F`, ctrl(ecartCoutEmployeur)] },
              ]
            : []),
        ],
      },
    }
  );

  // 2. Plan comptable
  blocks.push(
    { type: "sectionTitle", text: "2. Plan Comptable" },
    {
      type: "table",
      table: {
        columns: [
          { label: "Classe", weight: 3 },
          { label: "Nombre de Comptes", align: "right", weight: 1.5 },
          { label: "Solde Total", align: "right", weight: 1.5 },
        ],
        rows: planComptable.map((p) => ({
          cells: [p.label, String(p.nombre), `${fmt(p.soldeTotal)} F`],
        })),
      },
    }
  );

  // 3. Journaux
  blocks.push(
    { type: "sectionTitle", text: "3. Journaux" },
    {
      type: "table",
      table: {
        columns: [
          { label: "Journal", weight: 3 },
          { label: "Écritures", align: "right", weight: 1.2 },
          { label: "Total Débit", align: "right", weight: 1.4 },
          { label: "Total Crédit", align: "right", weight: 1.4 },
        ],
        rows: journalStats.map((j) => ({
          cells: [
            `${j.code} - ${j.libelle}`,
            `${j.nbEcritures} écriture${j.nbEcritures > 1 ? "s" : ""}`,
            `${fmt(j.totalDebit)} F`,
            `${fmt(j.totalCredit)} F`,
          ],
        })),
      },
    }
  );

  // 4. Bilan
  const bilanRow = (a: { accountCode: string; label: string; solde: number }): ReportRow => ({
    cells: [a.accountCode, a.label.substring(0, 55), `${fmt(a.solde)} F`],
  });
  const bilanCols = [
    { label: "Compte", weight: 1 },
    { label: "Libellé", weight: 4 },
    { label: "Montant", align: "right" as const, weight: 1.4 },
  ];
  blocks.push({ type: "spacer", height: 28.35 });
  blocks.push({
    type: "section",
    title: "4. Bilan Comptable",
    keepTogether: true,
    blocks: [
      { type: "paragraph", text: "ACTIF" },
      {
        type: "table",
        keepTogether: true,
        table: {
          columns: bilanCols,
          rows: [
            ...(bilan.actifImmobilisations.length
              ? [{ cells: ["ACTIF IMMOBILISÉ"], style: "group" as const }, ...bilan.actifImmobilisations.map(bilanRow)]
              : []),
            ...(bilan.actifCirculant.length
              ? [{ cells: ["ACTIF CIRCULANT"], style: "group" as const }, ...bilan.actifCirculant.map(bilanRow)]
              : []),
            ...(bilan.tresorerieActif.length
              ? [{ cells: ["TRÉSORERIE - ACTIF"], style: "group" as const }, ...bilan.tresorerieActif.map(bilanRow)]
              : []),
            { cells: ["", "TOTAL ACTIF", `${fmt(bilan.totalActif)} F`], style: "total" },
          ],
        },
      },
      { type: "paragraph", text: "PASSIF" },
      {
        type: "table",
        keepTogether: true,
        table: {
          columns: bilanCols,
          rows: [
            ...(bilan.capitauxPropres.length
              ? [{ cells: ["CAPITAUX PROPRES"], style: "group" as const }, ...bilan.capitauxPropres.map(bilanRow)]
              : []),
            ...(bilan.passifCirculant.length
              ? [{ cells: ["PASSIF CIRCULANT"], style: "group" as const }, ...bilan.passifCirculant.map(bilanRow)]
              : []),
            ...(bilan.tresoreriePassif.length
              ? [{ cells: ["TRÉSORERIE - PASSIF"], style: "group" as const }, ...bilan.tresoreriePassif.map(bilanRow)]
              : []),
            { cells: ["", "TOTAL PASSIF", `${fmt(bilan.totalPassif)} F`], style: "total" },
          ],
        },
      },
    ],
  });

  // 5. Journal des écritures
  blocks.push({ type: "pageBreak" }, { type: "sectionTitle", text: "5. Journal des Écritures" });
  if (report.entryLines.length === 0) {
    blocks.push({ type: "paragraph", text: "Aucune écriture pour la période." });
  } else {
    const journalLines = isReduit
      ? report.entryLines.slice(0, 50)
      : report.entryLines;
    if (isReduit) {
      blocks.push({
        type: "paragraph",
        text: `Les 50 dernières lignes comptables sont affichées sur ${lignesCount} au total. Nombre d'écritures : ${ecrituresCount}.`
      });
    }
    const journalColumns = showTiers
      ? [
          { label: "Date", weight: 0.9 },
          { label: "Compte", weight: 0.8 },
          { label: "Tier", weight: 1.6 },
          { label: "Libellé", weight: 3 },
          { label: "Débit", align: "right" as const, weight: 1.2 },
          { label: "Crédit", align: "right" as const, weight: 1.2 },
        ]
      : [
          { label: "Date", weight: 0.9 },
          { label: "Compte", weight: 0.8 },
          { label: "Libellé", weight: 4 },
          { label: "Débit", align: "right" as const, weight: 1.2 },
          { label: "Crédit", align: "right" as const, weight: 1.2 },
        ];

    const journalRows = journalLines.map((l, i) => {
      const prev = i > 0 ? journalLines[i - 1] : null;
      const showDate = !prev || prev.entry_id !== l.entry_id;
      const base = [showDate ? fmtDate(l.entry_date) : "", l.account_code];
      if (showTiers) base.push((l.tiers_label || l.account_label || "").substring(0, 30));
      base.push(
        (l.libelle || l.entry_libelle || "").substring(0, 45),
        l.debit > 0 ? `${fmt(l.debit)} F` : "",
        l.credit > 0 ? `${fmt(l.credit)} F` : ""
      );
      return { cells: base };
    });

    blocks.push({
      type: "table",
      table: {
        columns: journalColumns,
        rows: journalRows,
      },
    });
  }

  // 6. Compte de résultat
  blocks.push({ type: "pageBreak" });
  blocks.push({
    type: "section",
    title: "6. Compte de Résultat",
    keepTogether: true,
    blocks: [
      {
        type: "paragraph",
        text: `Période du ${fmtDate(report.dateDebut)} au ${fmtDate(report.dateFin)}`,
      },
      {
        type: "table",
        keepTogether: true,
        table: {
          columns: [
            { label: "Ref", weight: 0.6 },
            { label: "Libellé", weight: 4 },
            { label: "+/-", align: "center", weight: 0.7 },
            { label: "Note", align: "center", weight: 0.7 },
            { label: "Montant", align: "right", weight: 1.4 },
          ],
          rows: CR_ROWS.map((row) => {
            const value = row.key
              ? (t as unknown as Record<string, number>)[row.key]
              : (sig as unknown as Record<string, number>)[CR_TOTAL_KEYS[row.ref]] || 0;
            return {
              cells: [row.ref, row.label, row.sign, row.note, `${fmt(value)} F`],
              style: row.isTotal ? "total" : "normal",
            };
          }),
        },
      },
    ],
  });

  // 7. SIG & 8. Flux de trésorerie
  blocks.push({ type: "pageBreak" });
  blocks.push({
    type: "section",
    title: "7. Soldes Intermédiaires de Gestion",
    keepTogether: true,
    blocks: [
      {
        type: "table",
        keepTogether: true,
        table: {
          columns: [
            { label: "Indicateur", weight: 4 },
            { label: "Montant", align: "right", weight: 1.4 },
          ],
          rows: SIG_ROWS.map((row) => ({
            cells: [row.label, `${fmt((sig as unknown as Record<string, number>)[row.key])} F`],
            style: row.isTotal ? "total" : "normal",
          })),
        },
      },
      { type: "sectionTitle", text: "8. Tableau des Flux de Trésorerie" },
      {
        type: "table",
        keepTogether: true,
        table: {
          columns: [
            { label: "Ref", weight: 0.6 },
            { label: "Libellé", weight: 4.4 },
            { label: "Note", align: "center", weight: 0.7 },
            { label: "Montant", align: "right", weight: 1.4 },
          ],
          rows: FLUX_ROWS.map((row) => ({
            cells: [row.ref, row.label, row.note, `${fmt(row.key ? (flux as unknown as Record<string, number>)[row.key] : 0)} F`],
            style: "bold",
          })),
        },
      },
    ],
  });

  // 9. Paie et 10. Signature
  const paieAndSignatureBlocks: ReportBlock[] = [];
  if (payroll.employee_count > 0) {
    paieAndSignatureBlocks.push(
      {
        type: "stats",
        keepTogether: true,
        items: [
          { label: "Total Salaires Bruts", value: `${fmt(payroll.total_gross_salary)} F`, color: "primary" },
          { label: "Total Salaires Nets", value: `${fmt(payroll.total_net_salary)} F`, color: "green" },
          { label: "Coût Total Employeur hors assurance", value: `${fmt(payroll.total_employer_charges)} F`, color: "red" },
        ],
      },
      { type: "paragraph", text: "Détail des charges sociales" },
      {
        type: "table",
        keepTogether: true,
        table: {
          columns: [
            { label: "Type", weight: 3 },
            { label: "Part Salarié", align: "right", weight: 1.4 },
            { label: "Part Patronale", align: "right", weight: 1.4 },
            { label: "Total", align: "right", weight: 1.4 },
          ],
          rows: [
            {
              cells: [
                "IPRES (Compte 4313)",
                `${fmt(payroll.total_ipres_employee)} F`,
                `${fmt(payroll.total_ipres_employer)} F`,
                `${fmt(payroll.total_ipres_employee + payroll.total_ipres_employer)} F`,
              ],
            },
            {
              cells: [
                "CSS (Compte 4311)",
                `${fmt(payroll.total_css_employee)} F`,
                `${fmt(payroll.total_css_employer)} F`,
                `${fmt(payroll.total_css_employee + payroll.total_css_employer)} F`,
              ],
            },
            {
              cells: ["IRPP (Compte 447)", `${fmt(payroll.total_irpp)} F`, "—", `${fmt(payroll.total_irpp)} F`],
            },
            {
              cells: [
                "TOTAL DETTES SOCIALES",
                `${fmt(payroll.total_ipres_employee + payroll.total_css_employee + payroll.total_irpp)} F`,
                `${fmt(payroll.total_ipres_employer + payroll.total_css_employer)} F`,
                `${fmt(payroll.total_ipres_employee + payroll.total_ipres_employer + payroll.total_css_employee + payroll.total_css_employer + payroll.total_irpp)} F`,
              ],
              style: "total",
            },
          ],
        },
      }
    );
    if (payroll.by_month.length > 0) {
      paieAndSignatureBlocks.push(
        { type: "paragraph", text: "Détail mensuel" },
        {
          type: "table",
          keepTogether: true,
          table: {
            columns: [
              { label: "Mois", weight: 1.4 },
              { label: "Employés", align: "right", weight: 1 },
              { label: "Brut", align: "right", weight: 1.4 },
              { label: "Net", align: "right", weight: 1.4 },
              { label: "Coût employeur (sans l'assurance)", align: "right", weight: 1.4 },
            ],
            rows: payroll.by_month.map((m) => ({
              cells: [
                `${m.period_month}/${exercice}`,
                String(m.employee_count),
                `${fmt(m.gross_salary)} F`,
                `${fmt(m.net_salary)} F`,
                `${fmt(m.employer_charges)} F`,
              ],
            })),
          },
        }
      );
    }
  } else {
    paieAndSignatureBlocks.push({ type: "paragraph", text: "Aucune donnée de paie pour cet exercice." });
  }

  paieAndSignatureBlocks.push(
    { type: "spacer", height: 12 },
    { type: "spacer", height: 12 },
    { type: "sectionTitle", text: "10. Signature et Validation" },
    {
      type: "paragraph",
      text: `Je soussigné(e) ${userName}, certifie que le présent rapport financier ${periodeLabel.toLowerCase()} présente fidèlement la situation comptable et financière de ${cabinet.raisonSociale}.`,
    },
    {
      type: "paragraph",
      text: "Le présent rapport comprend l'ensemble des écritures comptables, le bilan, le compte de résultat, les soldes intermédiaires de gestion et le tableau des flux de trésorerie, conformément au système comptable OHADA.",
    },
    { type: "spacer", height: 10 },
    { type: "paragraph", text: `Fait à .................................., le ${dateGeneree}` },
    { type: "spacer", height: 30 },
    {
      type: "signatures",
      items: [
        { role: "Le Responsable", name: userName },
        { role: "Le Comptable", name: "Service Comptable" },
      ],
    }
  );

  blocks.push({ type: "pageBreak" });
  blocks.push({
    type: "section",
    title: "9. Paie et Charges Sociales (SYSCOHADA Révisé)",
    keepTogether: true,
    blocks: paieAndSignatureBlocks,
  });

  const title = `RAPPORT DE COMPTABILITÉ — ${periodeLabel.toUpperCase()}`;

  try {
    const pdfBytes = await generateReportPdf(
      title,
      `Généré le ${dateGeneree} par ${userName}`,
      blocks,
      cabinet,
      theme
    );
    const fileName = encodeURIComponent(`Rapport_Comptabilite_${mode}_${exercice}.pdf`);
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf; charset=utf-8",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Rapport PDF generation error", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
