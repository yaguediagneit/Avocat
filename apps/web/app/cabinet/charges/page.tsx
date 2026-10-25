import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { tableSearchWhere, numericClauses, dateClauses, boolClauses } from "@/lib/search";
import {
  serverHasPermission,
  getServerAuth,
  getServerDossierScopedFilter,
} from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { RowActions } from "@/components/row-actions";
import { SearchInput } from "@/components/search-input";
import { formatPeriode } from "@/lib/immobilisation";
import { DotationsButton } from "./dotations-button";
import { ChargePayerButton } from "./payer-button";
import { PaginatedList } from "@/components/pagination";

export default async function ChargesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  // Isolation : réservé aux rôles ayant la permission comptabilite.
  if (!(await serverHasPermission("comptabilite", "read"))) {
    redirect("/cabinet");
  }

  const auth = await getServerAuth();
  const q = (searchParams.q || "").trim();

  const accessFilter = await getServerDossierScopedFilter("comptabilite");
  const dossierIds = (accessFilter as any).dossierId?.in as string[] | undefined;

  const accessWhere =
    !dossierIds || dossierIds.length === 0
      ? undefined
      : {
          OR: [
            { dossierId: null },
            { dossierId: { in: dossierIds } },
            { tache: { dossierId: { in: dossierIds } } },
            { missionHuissier: { dossierId: { in: dossierIds } } },
          ],
        };

  const charges = await prisma.charge.findMany({
    where: {
      ...tableSearchWhere(
        q,
        [
          "description",
          "supplierName",
          "supplierInvoiceRef",
          "paymentMethod",
          "immobilisationAccountCode",
          "category.label",
          "category.code",
          "dossier.referenceInterne",
          "tache.titre",
          "missionHuissier.typeActe",
          "lines.some.description",
        ],
        (t) => [
          ...numericClauses(t, [
            "amount",
            "totalHt",
            "taxAmount",
            "monthlyPayment",
            "lines.some.quantite",
            "lines.some.prixUnitaire",
            "lines.some.totalHt",
            "lines.some.totalTtc",
          ]),
          ...dateClauses(t, ["chargeDate", "createdAt"]),
          ...boolClauses(t, ["isPaid"], {
            true: ["payée", "payee", "payé", "paye"],
            false: ["impayée", "impayee", "impayé", "impaye"],
          }),
          ...boolClauses(t, ["isImmobilisation"], {
            true: ["immobilisation", "immobilisations", "immo"],
            false: [],
          }),
        ]
      ),
      ...(accessWhere ? accessWhere : {}),
    },
    take: 100,
    include: {
      category: true,
      tvaRate: { select: { code: true, rate: true } },
      dossier: { select: { referenceInterne: true } },
      tache: { select: { titre: true } },
      missionHuissier: { select: { typeActe: true } },
      lines: { orderBy: { ordre: "asc" } },
      amortissements: { orderBy: { numero: "asc" } },
    },
    orderBy: { chargeDate: "desc" },
  });

  // Dotations échues non encore comptabilisées (toutes immobilisations).
  const dueDotations = await prisma.chargeAmortissement.findMany({
    where: {
      isPosted: false,
      dueDate: { lte: new Date() },
      charge: { actif: true, isImmobilisation: true },
    },
    select: { amount: true },
  });
  const dueTotal =
    Math.round(dueDotations.reduce((s, d) => s + Number(d.amount || 0), 0) * 100) / 100;
  const canWrite = hasPermission(auth.role, "comptabilite", "write");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Charges du cabinet</h1>
        <Link href="/cabinet/charges/nouvelle" className="btn-primary">
          + Nouvelle charge
        </Link>
      </div>
      <SearchInput placeholder="Filtrer charges..." />
      {canWrite && <DotationsButton count={dueDotations.length} totalAmount={dueTotal} />}

      <div className="space-y-4">
        {charges.length === 0 && (
          <div className="card px-4 py-6 text-center text-sm text-gray-500">
            Aucune charge enregistrée.
          </div>
        )}
        <PaginatedList>
        {charges.map((c) => (
          <div key={c.id} className="card overflow-hidden p-0">
            {/* En-tête de la charge */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-cabinet-900">
                  {new Date(c.chargeDate).toLocaleDateString("fr-FR")}
                </span>
                <span className="rounded-full bg-cabinet-100 px-2 py-0.5 text-xs font-medium text-cabinet-800">
                  {c.category.label}
                </span>
                {c.isImmobilisation && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Immobilisation {c.immobilisationAccountCode}
                  </span>
                )}
                {c.supplierName && (
                  <span className="text-gray-600">{c.supplierName}</span>
                )}
                {c.supplierInvoiceRef && (
                  <span className="text-xs text-gray-400">Réf. {c.supplierInvoiceRef}</span>
                )}
                <span className="text-xs text-gray-400">· {c.paymentMethod}</span>
                {c.dossier && (
                  <span className="text-xs text-cabinet-600">
                    <Link href={`/cabinet/dossiers/${c.dossierId}`} className="hover:underline">
                      {c.dossier.referenceInterne}
                    </Link>
                  </span>
                )}
                {c.tache && <span className="text-xs text-gray-500">· {c.tache.titre}</span>}
                {c.missionHuissier && (
                  <span className="text-xs text-gray-500">· {c.missionHuissier.typeActe}</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs text-gray-500">TTC</span>{" "}
                  <span className="font-semibold text-cabinet-900">
                    {Number(c.amount).toLocaleString("fr-FR")} FCFA
                  </span>
                  {c.tvaEnabled && (
                    <span className="ml-2 text-xs text-gray-500">
                      (TVA : {Number(c.taxAmount).toLocaleString("fr-FR")} FCFA)
                    </span>
                  )}
                  {!c.isPaid && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Impayée
                    </span>
                  )}
                  {c.isPaid && (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      Payée
                    </span>
                  )}
                </div>
                {canWrite && !c.isPaid && (
                  <ChargePayerButton charge={{ id: c.id, amount: Number(c.amount) }} />
                )}
                <Link
                  href={`/cabinet/charges/${c.id}/imprimer`}
                  className="rounded-md p-1.5 text-cabinet-700 transition hover:bg-cabinet-100"
                  title="Imprimer"
                  aria-label="Imprimer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                </Link>
                <RowActions
                  resource="charges"
                  id={c.id}
                  active={c.actif}
                  isAdmin={auth.estAdmin}
                  canEdit={canWrite}
                  editHref={`/cabinet/charges/${c.id}/modifier`}
                  entityLabel={`charge du ${new Date(c.chargeDate).toLocaleDateString("fr-FR")}`}
                />
              </div>
            </div>

            {/* Détail des lignes si elles existent */}
            {c.lines.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-cabinet-50/80 text-xs uppercase text-cabinet-700">
                    <tr>
                      <th className="px-2 py-2 text-xs whitespace-nowrap">Désignation</th>
                      <th className="px-2 py-2 text-right text-xs whitespace-nowrap">Qté</th>
                      <th className="px-2 py-2 text-right text-xs whitespace-nowrap">P.U.</th>
                      <th className="px-2 py-2 text-right text-xs whitespace-nowrap">TVA</th>
                      <th className="px-2 py-2 text-right text-xs whitespace-nowrap">HT</th>
                      <th className="px-2 py-2 text-right text-xs whitespace-nowrap">TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.lines.map((l) => (
                      <tr key={l.id} className="border-t border-gray-50">
                        <td className="px-2 py-2 text-gray-800">{l.description}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{l.quantite}</td>
                        <td className="px-2 py-2 text-right text-gray-600">
                          {Number(l.prixUnitaire).toLocaleString("fr-FR")}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-500">{l.tauxTva}%</td>
                        <td className="px-2 py-2 text-right text-gray-600">
                          {Number(l.totalHt).toLocaleString("fr-FR")}
                        </td>
                        <td className="px-2 py-2 text-right font-medium text-cabinet-900">
                          {Number(l.totalTtc).toLocaleString("fr-FR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-gray-600">
                {c.description || "—"}
              </div>
            )}

            {/* Plan d'amortissement */}
            {c.isImmobilisation && c.amortissements.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-3">
                <p className="mb-2 text-xs font-medium uppercase text-cabinet-700">
                  Plan d&apos;amortissement —{" "}
                  {c.immobilisationMode === "taux"
                    ? `taux ${c.immobilisationRate}% / an`
                    : "dotation fixe"}{" "}
                  · {Number(c.monthlyPayment || 0).toLocaleString("fr-FR")} FCFA ×{" "}
                  {c.amortissements.length} mois
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {c.amortissements.map((d) => (
                    <span
                      key={d.id}
                      title={`${Number(d.amount).toLocaleString("fr-FR")} FCFA — VNC ${Number(
                        d.vnc
                      ).toLocaleString("fr-FR")} FCFA${d.isPosted ? " — comptabilisée" : ""}`}
                      className={`rounded px-2 py-0.5 text-xs ${
                        d.isPosted
                          ? "bg-green-100 text-green-800"
                          : new Date(d.dueDate) <= new Date()
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {formatPeriode(d.periodYear, d.periodMonth)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        </PaginatedList>
      </div>
    </div>
  );
}
