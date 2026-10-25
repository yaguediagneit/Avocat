import { prisma } from "@/lib/prisma";
import { serverCanAccessDossier } from "@/lib/server-auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PaiementForm } from "./paiement-form";
import { PaginatedRows, PaginatedUl } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

const STATUT_BADGES: Record<string, string> = {
  Brouillon: "bg-gray-100 text-gray-700",
  Emise: "bg-cabinet-100 text-cabinet-800",
  "Partiellement payée": "bg-amber-100 text-amber-700",
  Payée: "bg-emerald-100 text-emerald-700",
};

export default async function FactureDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { sort?: string; dir?: string };
}) {
  const sort = getSortSpec(searchParams);
  const thProps = { path: `/cabinet/factures/${params.id}`, params: searchParams };
  const facture = await prisma.facture.findUnique({
    where: { id: params.id },
    include: {
      dossier: { select: { referenceInterne: true, client: { select: { raisonSociale: true } } } },
      client: { select: { raisonSociale: true } },
      paiements: { orderBy: { datePaiement: "desc" } },
      lines: { orderBy: { ordre: "asc" } },
    },
  });

  if (!facture || !facture.dossierId || !facture.dossier) {
    notFound();
  }

  // Isolation : vérifie l'accès au dossier lié à la facture.
  const canAccess = await serverCanAccessDossier(facture.dossierId, "read");
  if (!canAccess) {
    notFound();
  }

  const paye = facture.paiements.reduce((acc, p) => acc + Number(p.montant), 0);
  const restant = Number(facture.totalTtc) - paye;
  const intervenants = (facture.intervenants as { prenom: string; nom: string; role: string }[] | null) || [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{facture.numero}</h1>
          <p className="text-sm text-gray-600">
            Facture du {new Date(facture.dateEmission).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <Link href="/cabinet/factures" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>

      <div className="card grid gap-4 text-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="text-gray-500">Libellé</span>
            <p>{facture.libelle || "—"}</p>
          </div>
          <div>
            <span className="text-gray-500">Désignation</span>
            <p>{facture.designation || "—"}</p>
          </div>
          <div>
            <span className="text-gray-500">Dossier</span>
            <p>
              <Link href={`/cabinet/dossiers/${facture.dossierId}`} className="text-cabinet-700 hover:underline">
                {facture.dossier?.referenceInterne ?? "—"}
              </Link>
            </p>
          </div>
          <div>
            <span className="text-gray-500">Client</span>
            <p>
              <Link href={`/cabinet/clients/${facture.clientId}`} className="text-cabinet-700 hover:underline">
                {facture.client.raisonSociale}
              </Link>
            </p>
          </div>
          <div>
            <span className="text-gray-500">Statut</span>
            <p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUT_BADGES[facture.statut] || "bg-gray-100 text-gray-700"
                }`}
              >
                {facture.statut}
              </span>
            </p>
          </div>
          <div>
            <span className="text-gray-500">Échéance</span>
            <p>{facture.dateEcheance ? new Date(facture.dateEcheance).toLocaleDateString("fr-FR") : "—"}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="designation" label="Désignation" className="px-4 py-2 text-left" />
                <SortableTh {...thProps} column="qte" label="Qté" className="px-4 py-2 text-right" />
                <SortableTh {...thProps} column="pu" label="P.U." className="px-4 py-2 text-right" />
                <SortableTh {...thProps} column="tva" label="TVA" className="px-4 py-2 text-right" />
                <SortableTh {...thProps} column="ht" label="HT" className="px-4 py-2 text-right" />
                <SortableTh {...thProps} column="ttc" label="TTC" className="px-4 py-2 text-right" />
              </tr>
            </thead>
            <tbody>
              {facture.lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                    Aucune ligne détaillée.
                  </td>
                </tr>
              ) : (
                <PaginatedRows colSpan={6}>
                {sortRows(facture.lines, sort, {
                  designation: (l) => l.description,
                  qte: (l) => Number(l.quantite),
                  pu: (l) => Number(l.prixUnitaire),
                  tva: (l) => Number(l.tauxTva),
                  ht: (l) => Number(l.totalHt),
                  ttc: (l) => Number(l.totalTtc),
                }).map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="px-4 py-2">{l.description}</td>
                    <td className="px-4 py-2 text-right">{Number(l.quantite).toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-2 text-right">{Number(l.prixUnitaire).toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-2 text-right">{l.tauxTva}%</td>
                    <td className="px-4 py-2 text-right">{Number(l.totalHt).toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-2 text-right">{Number(l.totalTtc).toLocaleString("fr-FR")}</td>
                  </tr>
                ))}
                </PaginatedRows>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <span className="text-gray-500">Total HT</span>
            <p className="font-semibold">{Number(facture.totalHt).toLocaleString("fr-FR")} FCFA</p>
          </div>
          <div>
            <span className="text-gray-500">Total TVA</span>
            <p className="font-semibold">{Number(facture.totalTva).toLocaleString("fr-FR")} FCFA</p>
          </div>
          <div>
            <span className="text-gray-500">Total TTC</span>
            <p className="font-semibold">{Number(facture.totalTtc).toLocaleString("fr-FR")} FCFA</p>
          </div>
          <div>
            <span className="text-gray-500">Payé</span>
            <p className="font-semibold text-emerald-700">{paye.toLocaleString("fr-FR")} FCFA</p>
          </div>
          <div>
            <span className="text-gray-500">Restant dû</span>
            <p className={`font-semibold ${restant > 0 ? "text-amber-700" : "text-emerald-700"}`}>
              {restant.toLocaleString("fr-FR")} FCFA
            </p>
          </div>
        </div>

        <div className="md:col-span-2">
          <span className="text-gray-500">Intervenants du dossier</span>
          {intervenants.length === 0 ? (
            <p className="text-gray-500">—</p>
          ) : (
            <ul className="mt-1 space-y-1">
              <PaginatedUl>
              {intervenants.map((i, idx) => (
                <li key={idx} className="text-sm">
                  {i.prenom} {i.nom} <span className="text-gray-500">— {i.role}</span>
                </li>
              ))}
              </PaginatedUl>
            </ul>
          )}
        </div>
      </div>

      {facture.paiements.length > 0 && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Paiements enregistrés</h2>
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="date" label="Date" className="px-4 py-3" />
                <SortableTh {...thProps} column="mode" label="Mode" className="px-4 py-3" />
                <SortableTh {...thProps} column="montant" label="Montant" className="px-4 py-3" />
                <SortableTh {...thProps} column="reference" label="Référence" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              <PaginatedRows colSpan={4}>
              {sortRows(facture.paiements, sort, {
                date: (p) => p.datePaiement,
                mode: (p) => p.mode,
                montant: (p) => Number(p.montant),
                reference: (p) => p.reference,
              }).map((p) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{new Date(p.datePaiement).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">{p.mode}</td>
                  <td className="px-4 py-3">{Number(p.montant).toLocaleString("fr-FR")} FCFA</td>
                  <td className="px-4 py-3">{p.reference || "—"}</td>
                </tr>
              ))}
              </PaginatedRows>
            </tbody>
          </table>
        </div>
      )}

      {restant > 0 && <PaiementForm factureId={facture.id} restant={restant} />}
    </div>
  );
}
