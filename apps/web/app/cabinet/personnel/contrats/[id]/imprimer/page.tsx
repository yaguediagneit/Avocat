import { notFound, redirect } from "next/navigation";
import { prisma, publicPrisma } from "@/lib/prisma";
import { serverHasPermission, getServerAuth } from "@/lib/server-auth";
import { getSession } from "@/lib/session";
import { getPresignedDownloadUrl } from "@/lib/s3";
import { PrintButton } from "./print-button";
import { ApproveButtons } from "./approve-buttons";
import type { PdfThemeConfig } from "@/lib/pdf-generator";
import { resolvePdfThemeText } from "@/lib/pdf-theme-text";

const DEFAULT_PDF_THEME: PdfThemeConfig = {
  primaryColor: "#2c4c7c",
  secondaryColor: "#c78124",
  fontFamily: "Helvetica",
  fontSize: 11,
  headerText: "",
  footerText: "",
};

function toRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(44, 76, 124, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ------------------------------------------------------------- */
/* Mise en forme du champ « Objet / missions » (texte libre)      */
/* ------------------------------------------------------------- */

type ObjetListStyle = "bullet" | "decimal" | "alpha" | "roman";

type ObjetBlock =
  | { kind: "title"; text: string }
  | { kind: "para"; text: string }
  | { kind: "list"; style: ObjetListStyle; items: string[] };

const OBJET_BULLET = /^\s*[-–—•*▪◦·]\s+/;
const OBJET_NUMBERED = /^\s*(\d{1,3}|[a-zA-Z]|[ivxIVX]{1,4})[.)]\s+/;
const OBJET_TITLE_WORDS =
  /^(?:objectifs?|missions?|indicateurs?|activit[eé]s?|t[aâ]ches?|attributions?|responsabilit[eé]s?|r[eé]sultats?|comp[eé]tences?|moyens?|d[eé]lais?|modalit[eé]s?|remarques?|engagements?|obligations?)\b/i;

function objetListStyle(marker: string): "decimal" | "alpha" | "roman" {
  if (/^\d/.test(marker)) return "decimal";
  return /^[ivx]+$/i.test(marker) ? "roman" : "alpha";
}

// Une ligne est un titre si elle se termine par « : », si elle commence
// par un mot-clé de rubrique, ou si elle est entièrement en majuscules.
function objetIsTitle(t: string): boolean {
  if (t.length > 110) return false;
  if (t.endsWith(":")) return true;
  if (OBJET_TITLE_WORDS.test(t)) return true;
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

// Découpe le texte saisi/collé en blocs : titres, paragraphes et listes.
// Les lignes courtes placées juste après un titre sont rendues en puces
// même sans marqueur dans le texte source (cas fréquent du texte collé) ;
// une ligne longue (> 140 car.) reste un paragraphe.
function objetBlocks(text: string): ObjetBlock[] {
  const blocks: ObjetBlock[] = [];
  let para: string[] = [];
  let list: Extract<ObjetBlock, { kind: "list" }> | null = null;
  let afterTitle = false;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "para", text: para.join(" ") });
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };
  const pushItem = (style: ObjetListStyle, item: string) => {
    if (!list || list.style !== style) {
      flushList();
      list = { kind: "list", style, items: [] };
    }
    list.items.push(item);
  };

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const t = raw.trim();
    if (!t) {
      flushPara();
      flushList();
      afterTitle = false;
      continue;
    }
    const bullet = t.match(OBJET_BULLET);
    if (bullet) {
      flushPara();
      pushItem("bullet", t.slice(bullet[0].length).trim());
      afterTitle = false;
      continue;
    }
    const numbered = t.match(OBJET_NUMBERED);
    if (numbered) {
      flushPara();
      pushItem(objetListStyle(numbered[1]), t.slice(numbered[0].length).trim());
      afterTitle = false;
      continue;
    }
    if (objetIsTitle(t)) {
      flushPara();
      flushList();
      blocks.push({ kind: "title", text: t });
      afterTitle = true;
      continue;
    }
    if (afterTitle && t.length <= 140) {
      flushPara();
      pushItem("bullet", t);
      continue;
    }
    flushList();
    para.push(t);
    afterTitle = false;
  }
  flushPara();
  flushList();
  return blocks;
}

const OBJET_LIST_STYLE: Record<ObjetListStyle, string> = {
  bullet: "disc",
  decimal: "decimal",
  alpha: "lower-alpha",
  roman: "lower-roman",
};

function ObjetContent({ text, color }: { text: string; color: string }) {
  return (
    <div className="space-y-2.5 text-justify text-sm leading-relaxed">
      {objetBlocks(text).map((b, i) => {
        if (b.kind === "title") {
          return (
            <p
              key={i}
              className="pt-2 font-bold first:pt-0"
              style={{ color }}
            >
              {b.text}
            </p>
          );
        }
        if (b.kind === "para") {
          return <p key={i}>{b.text}</p>;
        }
        const Tag = b.style === "bullet" ? "ul" : "ol";
        return (
          <Tag
            key={i}
            className="space-y-1 pl-7"
            style={{ listStyleType: OBJET_LIST_STYLE[b.style] }}
          >
            {b.items.map((item, j) => (
              <li key={j} className="pl-1">
                {item}
              </li>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}

export default async function ImprimerContratPage({
  params,
}: {
  params: { id: string };
}) {
  if (!(await serverHasPermission("comptabilite", "read"))) {
    redirect("/cabinet");
  }

  const auth = await getServerAuth();
  const isApprover = auth.estAdmin || /directeur|associé|associe/i.test(auth.role.nom);

  const [contract, clauseParams, activeGeneralInsurance, obligationParams] = await Promise.all([
    prisma.employmentContract.findUnique({
      where: { id: params.id },
      include: {
        employee: {
          include: {
            insuredEmployees: {
              where: { statut: "actif" },
              include: { contract: true },
            },
          },
        },
      },
    }),
    prisma.parametre.findMany({
      where: {
        categorie: "contrats",
        code: { in: ["clause_confidentialite", "clause_non_concurrence"] },
      },
    }),
    prisma.insuranceContract.findFirst({
      where: { statut: { in: ["actif", "brouillon"] } },
      orderBy: { dateDebut: "desc" },
    }),
    prisma.parametre.findMany({
      where: {
        categorie: { in: ["contrat_obligation_employer", "contrat_obligation_employee"] },
        actif: true,
      },
      orderBy: [{ categorie: "asc" }, { ordre: "asc" }],
    }),
  ]);
  if (!contract) notFound();

  const latestPayroll = await prisma.payroll.findFirst({
    where: { employeeId: contract.employee.id },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
  });

  const session = await getSession();
  const tenantId =
    session.tenantId ||
    (process.env.NODE_ENV !== "production" ? process.env.DEFAULT_TENANT_ID : "");

  const tenant = tenantId
    ? await publicPrisma.tenant.findUnique({ where: { id: tenantId } })
    : null;

  const config = (tenant?.configuration as Record<string, unknown>) || {};
  const pdfTheme = (config.pdfTheme as Partial<PdfThemeConfig>) || {};

  const theme: PdfThemeConfig = {
    ...DEFAULT_PDF_THEME,
    ...pdfTheme,
    fontFamily:
      (pdfTheme.fontFamily as PdfThemeConfig["fontFamily"]) ||
      DEFAULT_PDF_THEME.fontFamily,
    fontSize: Number(pdfTheme.fontSize) || DEFAULT_PDF_THEME.fontSize,
  };

  let logoSrc: string | null = tenant?.logoUrl || null;
  if (
    logoSrc &&
    !/^https?:\/\//i.test(logoSrc) &&
    !/^data:/i.test(logoSrc) &&
    !logoSrc.startsWith("/")
  ) {
    try {
      logoSrc = await getPresignedDownloadUrl(logoSrc, 300);
    } catch {
      logoSrc = null;
    }
  }

  const cabinet = {
    raisonSociale: tenant?.raisonSociale || "Cabinet",
    slogan: String(config.slogan ?? ""),
    adresse: tenant?.adresse || undefined,
    telephone: String(config.telephonePrincipal ?? ""),
    telephoneSecondaire: String(config.telephoneSecondaire ?? ""),
    email: String(config.email ?? ""),
    siteWeb: String(config.siteWeb ?? ""),
    identifiantFiscal: tenant?.identifiantFiscal || undefined,
    identificationLegale: String(config.identificationLegale ?? ""),
  };

  const clauseMap = new Map(clauseParams.map((p) => [p.code, p.libelle]));
  const e = contract.employee;
  const grossSalary = latestPayroll?.grossSalary ?? e.baseSalary;

  const activeInsurance = (e as any).insuredEmployees?.[0];
  const tauxParticulier = activeInsurance?.tauxParticulier;
  const tauxGeneral = activeInsurance?.contract?.tauxGeneral;
  const generalTaux = activeGeneralInsurance?.tauxGeneral;
  const assuranceRate =
    tauxParticulier != null
      ? `${Number(tauxParticulier).toLocaleString("fr-FR")}%`
      : tauxGeneral != null
        ? `${Number(tauxGeneral).toLocaleString("fr-FR")}%`
        : generalTaux != null
          ? `${Number(generalTaux).toLocaleString("fr-FR")}%`
          : "—";

  const Check = ({ className = "" }: { className?: string }) => (
    <span
      className={`text-2xl font-bold text-cabinet-700 ${className}`}
    >
      ✓
    </span>
  );

  const now = new Date().toLocaleString("fr-FR");
  const ref = `CT-${contract.id.slice(0, 8).toUpperCase()}`;

  const articlesParticuliers = [
    ...(contract.clauseConfidentialite
      ? [
          clauseMap.get("clause_confidentialite")?.trim() ||
            "Clause de confidentialité applicable.",
        ]
      : []),
    ...(contract.clauseNonConcurrence
      ? [
          clauseMap.get("clause_non_concurrence")?.trim() ||
            "Clause de non-concurrence applicable.",
        ]
      : []),
    contract.conventionCollective
      ? `Convention collective : ${contract.conventionCollective}.`
      : null,
    contract.periodeEssaiJours
      ? `Période d'essai de ${contract.periodeEssaiJours} jours.`
      : null,

  ].filter(Boolean) as string[];

  const primary = theme.primaryColor;
  const secondary = theme.secondaryColor;
  const primaryTint = toRgba(primary, 0.08);
  const tableBorder = { borderColor: secondary };

  const Section = ({
    title,
    children,
    className = "",
  }: {
    title: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <div
      className={`mb-6 ${className}`}
      style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
    >
      <h2
        className="mb-3 border-b pb-1 text-sm font-bold uppercase print-section-title"
        style={{ color: primary, borderColor: secondary }}
      >
        {title}
      </h2>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-white p-6 text-cabinet-900 print:p-0">
      <table className="print-layout w-full border-0 text-sm">
        <thead>
          <tr>
            <td className="print-header border-0 p-0">
              <div
                className="h-2 w-full"
                style={{ backgroundColor: primary }}
              />
              <div
                className="mb-4 flex items-stretch gap-4 border-b-2 pb-4"
                style={{ borderColor: secondary }}
              >
                <div className="w-28 shrink-0 self-center">
                  {logoSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoSrc}
                      alt="logo"
                      className="max-h-20 w-full object-contain"
                    />
                  ) : (
                    <div
                      className="flex h-20 w-full items-center justify-center rounded border"
                      style={{ borderColor: secondary, color: secondary }}
                    >
                      <span className="text-2xl font-bold">
                        {cabinet.raisonSociale.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h2
                    className="text-lg font-bold uppercase"
                    style={{ color: primary }}
                  >
                    {cabinet.raisonSociale}
                  </h2>
                  {cabinet.slogan && (
                    <p
                      className="text-xs font-medium"
                      style={{ color: secondary }}
                    >
                      {cabinet.slogan}
                    </p>
                  )}
                  {cabinet.adresse && (
                    <p className="text-xs text-cabinet-600">{cabinet.adresse}</p>
                  )}
                  {(cabinet.telephone || cabinet.telephoneSecondaire) && (
                    <p className="text-xs text-cabinet-600">
                      Tél : {cabinet.telephone}
                      {cabinet.telephoneSecondaire
                        ? ` / ${cabinet.telephoneSecondaire}`
                        : ""}
                    </p>
                  )}
                  {cabinet.email && (
                    <p className="text-xs text-cabinet-600">{cabinet.email}</p>
                  )}
                </div>
                <div className="text-right text-xs text-cabinet-600">
                  <p>
                    <strong>Réf. :</strong> {ref}
                  </p>
                  <p>
                    <strong>Généré le :</strong> {now}
                  </p>
                  <p>
                    <strong>Statut :</strong> {contract.statut}
                  </p>
                </div>
              </div>
              {theme.headerText && (
                <p
                  className="mb-2 text-xs font-medium"
                  style={{ color: secondary }}
                >
                  {resolvePdfThemeText(theme.headerText)}
                </p>
              )}
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-0 p-0">
              <div className="print-spacer" />

              <h1
                className="mb-6 text-center text-2xl font-bold uppercase tracking-widest"
                style={{ color: primary }}
              >
                Contrat de travail
              </h1>

              <Section title="Article 1 — Parties contractantes">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div
                    className="rounded border p-3"
                    style={{ borderColor: secondary }}
                  >
                    <p className="font-bold" style={{ color: primary }}>
                      L&apos;EMPLOYEUR
                    </p>
                    <p className="text-cabinet-900">
                      {cabinet.raisonSociale}
                    </p>
                    {cabinet.adresse && (
                      <p className="text-cabinet-600">{cabinet.adresse}</p>
                    )}
                  </div>
                  <div
                    className="rounded border p-3"
                    style={{ borderColor: secondary }}
                  >
                    <p className="font-bold" style={{ color: primary }}>
                      LE SALARIÉ
                    </p>
                    <p>
                      {e.firstName} {e.lastName}
                    </p>
                    <p className="text-cabinet-600">
                      Matricule : {e.employeeCode}
                    </p>
                    {e.email && (
                      <p className="text-cabinet-600">{e.email}</p>
                    )}
                    {e.phone && (
                      <p className="text-cabinet-600">{e.phone}</p>
                    )}
                  </div>
                </div>
              </Section>

              <div className="print-spacer" />

              <Section title="Article 2 — Désignation du poste">
                <table
                  className="w-full border-collapse border text-sm"
                  style={tableBorder}
                  role="presentation"
                  aria-label="Désignation du poste"
                >
                  <tbody>
                    <tr>
                      <th
                        className="border px-3 py-2 text-left"
                        style={{ backgroundColor: primaryTint, ...tableBorder }}
                      >
                        Fonction
                      </th>
                      <td
                        className="border px-3 py-2"
                        style={tableBorder}
                      >
                        {contract.fonction || e.position || "—"}
                      </td>
                    </tr>
                    <tr>
                      <th
                        className="border px-3 py-2 text-left"
                        style={{ backgroundColor: primaryTint, ...tableBorder }}
                      >
                        Service
                      </th>
                      <td
                        className="border px-3 py-2"
                        style={tableBorder}
                      >
                        {contract.service || e.department || "—"}
                      </td>
                    </tr>
                    <tr>
                      <th
                        className="border px-3 py-2 text-left"
                        style={{ backgroundColor: primaryTint, ...tableBorder }}
                      >
                        Lieu de travail
                      </th>
                      <td
                        className="border px-3 py-2"
                        style={tableBorder}
                      >
                        {contract.lieuTravail || "Dakar"}
                      </td>
                    </tr>
                    <tr>
                      <th
                        className="border px-3 py-2 text-left"
                        style={{ backgroundColor: primaryTint, ...tableBorder }}
                      >
                        Horaires hebdomadaire
                      </th>
                      <td
                        className="border px-3 py-2"
                        style={tableBorder}
                      >
                        {contract.horaires || "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Section>

              <div className="print-spacer" />

              {contract.objet && (
                <Section
                  title="Objectifs, missions et indicateurs"
                  className="print-page-start"
                >
                  <ObjetContent text={contract.objet} color={primary} />
                </Section>
              )}

              <div className="print-spacer" />

              <Section
                title="Article 3 — Durée du contrat"
                className="print-page-start"
              >
                <table
                  className="w-full border-collapse border text-sm"
                    style={tableBorder}
                    role="presentation"
                    aria-label="Durée du contrat"
                  >
                    <thead>
                      <tr style={{ backgroundColor: primaryTint }}>
                        <th className="border px-3 py-2 text-left" style={tableBorder}>
                          Type
                        </th>
                        <th className="border px-3 py-2 text-left" style={tableBorder}>
                          Date de début
                        </th>
                        <th className="border px-3 py-2 text-left" style={tableBorder}>
                          Date de fin
                        </th>
                        <th className="border px-3 py-2 text-left" style={tableBorder}>
                          Durée
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border px-3 py-2" style={tableBorder}>
                          {contract.typeContrat}
                        </td>
                        <td className="border px-3 py-2" style={tableBorder}>
                          {contract.dateDebut.toLocaleDateString("fr-FR")}
                        </td>
                        <td className="border px-3 py-2" style={tableBorder}>
                          {contract.dateFin
                            ? contract.dateFin.toLocaleDateString("fr-FR")
                            : "—"}
                        </td>
                        <td className="border px-3 py-2" style={tableBorder}>
                          {contract.dureeMois ? `${contract.dureeMois} mois` : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Section>

                <div className="print-spacer" />

                <Section title="Article 4 — Rémunération et avantages">
                  <table
                    className="w-full border-collapse border text-sm"
                    style={tableBorder}
                    role="presentation"
                    aria-label="Rémunération et avantages"
                  >
                    <thead>
                      <tr style={{ backgroundColor: primaryTint }}>
                        <th className="border px-3 py-2 text-left" style={tableBorder}>
                          Désignation
                        </th>
                        <th className="border px-3 py-2 text-left" style={tableBorder}>
                          Montant
                        </th>
                        <th className="border px-3 py-2 text-left" style={tableBorder}>
                          Détail
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border px-3 py-2" style={tableBorder}>
                          Salaire Brut Mensuel
                        </td>
                        <td className="border px-3 py-2" style={tableBorder}>
                          {Number(grossSalary).toLocaleString("fr-FR")} FCFA
                        </td>
                        <td className="border px-3 py-2" style={tableBorder}>
                          Brut
                        </td>
                      </tr>
                      <tr>
                        <td className="border px-3 py-2" style={tableBorder}>
                          Assurance
                        </td>
                        <td className="border px-3 py-2" style={tableBorder}>
                          {assuranceRate}
                        </td>
                        <td className="border px-3 py-2" style={tableBorder}>
                          —
                        </td>
                      </tr>
                      <tr>
                        <td className="border px-3 py-2" style={tableBorder}>
                          Cotisations IPRES
                        </td>
                        <td className="border px-3 py-2" style={tableBorder}>
                          <Check />
                        </td>
                        <td className="border px-3 py-2" style={tableBorder}>
                          —
                        </td>
                      </tr>
                      <tr>
                        <td className="border px-3 py-2" style={tableBorder}>
                          Cotisations CNSS
                        </td>
                        <td className="border px-3 py-2" style={tableBorder}>
                          <Check />
                        </td>
                        <td className="border px-3 py-2" style={tableBorder}>
                          —
                        </td>
                      </tr>
                      <tr>
                        <td className="border px-3 py-2" style={tableBorder}>
                          Congés payés annuels
                        </td>
                        <td className="border px-3 py-2" style={tableBorder}>
                          {contract.congesPayesAnnuel} jours
                        </td>
                        <td className="border px-3 py-2" style={tableBorder}>
                          —
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Section>

                <div className="print-spacer" />

                <Section title="Article 5 — Conditions particulières">
                  {articlesParticuliers.length > 0 ? (
                    <ul className="list-disc pl-5 text-sm">
                      {articlesParticuliers.map((item, i) => (
                        <li key={i} className="mb-2 whitespace-pre-wrap">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-cabinet-500">
                      Aucune condition particulière.
                    </p>
                  )}
                </Section>

                <div
                  className="print-page-start print-last-page"
                  style={{ minHeight: "200mm" }}
                >
                  <Section title="Article 6 — Obligations des parties">
                  {(() => {
                    const employer = obligationParams.filter((p) => p.categorie === "contrat_obligation_employer");
                    const employee = obligationParams.filter((p) => p.categorie === "contrat_obligation_employee");
                    const maxRows = Math.max(employer.length, employee.length, 1);
                    return (
                      <table
                        className="w-full border-collapse border text-sm"
                        style={tableBorder}
                        role="presentation"
                        aria-label="Obligations des parties"
                      >
                        <thead>
                          <tr style={{ backgroundColor: primaryTint }}>
                            <th className="border px-3 py-2 text-left" style={tableBorder}>
                              Obligations de l&apos;employeur
                            </th>
                            <th className="border px-3 py-2 text-left" style={tableBorder}>
                              Obligations du salarié
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {maxRows === 0 ? (
                            <tr>
                              <td colSpan={2} className="border px-3 py-2 text-gray-500" style={tableBorder}>Aucune obligation paramétrée.</td>
                            </tr>
                          ) : (
                            Array.from({ length: maxRows }).map((_, i) => (
                              <tr key={i}>
                                <td className="border px-3 py-2 align-top" style={tableBorder}>
                                  {employer[i]?.libelle || "—"}
                                </td>
                                <td className="border px-3 py-2 align-top" style={tableBorder}>
                                  {employee[i]?.libelle || "—"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    );
                  })()}
                </Section>

                <Section title="Signatures des parties" className="!mb-0">
                  <p className="mb-4 text-sm">
                    Fait en deux exemplaires originaux, à{" "}
                    <span
                      className="inline-block w-32 border-b"
                      style={{ borderColor: secondary }}
                    >
                      {" "}
                    </span>
                    , le{" "}
                    <span
                      className="inline-block w-24 border-b"
                      style={{ borderColor: secondary }}
                    >
                      {" "}
                    </span>
                    .
                  </p>
                  <div className="grid gap-8 text-sm sm:grid-cols-2">
                    <div>
                      <p className="font-bold" style={{ color: primary }}>
                        L&apos;EMPLOYEUR
                      </p>
                      <p className="mt-8 text-cabinet-600">
                        Signature + cachet
                      </p>
                      <p className="mt-2 text-xs">Lu et approuvé</p>
                    </div>
                    <div>
                      <p className="font-bold" style={{ color: primary }}>
                        LE SALARIÉ
                      </p>
                      <p className="mt-8 text-cabinet-600">
                        {e.firstName} {e.lastName}
                      </p>
                      <p className="mt-2 text-xs">Lu et approuvé</p>
                    </div>
                  </div>
                </Section>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="print-footer border-0 p-0">
                <div
                  className="border-t pt-2 text-center text-xs"
                  style={{ borderColor: secondary }}
                >
                  <p className="text-cabinet-600">
                    {[
                      cabinet.adresse,
                      cabinet.telephone
                        ? `Tél : ${cabinet.telephone}${
                            cabinet.telephoneSecondaire
                              ? ` / ${cabinet.telephoneSecondaire}`
                              : ""
                          }`
                        : "",
                      cabinet.email,
                    ]
                      .filter(Boolean)
                      .join("  |  ")}
                  </p>
                  <p className="text-cabinet-600">
                    {[
                      cabinet.identificationLegale,
                      cabinet.identifiantFiscal
                        ? `N° fiscal : ${cabinet.identifiantFiscal}`
                        : "",
                      cabinet.siteWeb,
                    ]
                      .filter(Boolean)
                      .join("  |  ")}
                  </p>
                  {theme.footerText && (
                    <p className="mt-1 font-medium" style={{ color: primary }}>
                      {resolvePdfThemeText(theme.footerText)}
                    </p>
                  )}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>

        {isApprover && contract.statut !== "approuvé" && (
          <ApproveButtons id={contract.id} />
        )}

        <div className="mt-8 text-center print:hidden">
          <PrintButton />
        </div>
      </div>
    );
  }
