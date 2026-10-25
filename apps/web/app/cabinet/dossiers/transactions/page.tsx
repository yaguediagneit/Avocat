import Link from "next/link";
import { getServerAuth, getServerDossierScopedFilter } from "@/lib/server-auth";
import { tableSearchWhere, dateClauses } from "@/lib/search";
import { hasPermission } from "@/lib/rbac";
import { SearchInput } from "@/components/search-input";
import { PaginatedRows } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";
import {
  TRANSACTION_STATUT_LABELS,
  TRANSACTION_STATUT_BADGES,
  TRANSACTION_FAMILLES,
  BLOCAGE_STATUTS,
} from "@/lib/transactions";

const PRIORITE_BADGES: Record<string, string> = {
  BASSE: "bg-gray-100 text-gray-600",
  NORMALE: "bg-blue-50 text-blue-700",
  HAUTE: "bg-orange-100 text-orange-700",
  URGENTE: "bg-red-100 text-red-700",
};

const BLOQUES = new Set<string>(BLOCAGE_STATUTS);

function montant(n?: number | null, devise = "XOF") {
  return n != null ? `${n.toLocaleString("fr-FR")} ${devise}` : "—";
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { q?: string; statut?: string; famille?: string; sort?: string; dir?: string };
}) {
  const auth = await getServerAuth();
  const scopeFilter = await getServerDossierScopedFilter("transactions");
  const canWrite = hasPermission(auth.role, "transactions", "write") || auth.estAdmin;

  const q = (searchParams.q || "").trim();
  const statut = searchParams.statut || "";
  const famille = searchParams.famille || "";
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/cabinet/dossiers/transactions", params: searchParams };

  const types = await auth.prisma.transactionType.findMany({
    where: { actif: true },
    select: { id: true, code: true, libelle: true, famille: true },
    orderBy: { ordre: "asc" },
  });

  const where = {
    ...scopeFilter,
    archiveLe: null,
    ...(statut ? { statut } : {}),
    ...(famille ? { type: { famille } } : {}),
    ...tableSearchWhere(
      q,
      [
        "reference",
        "objet",
        "statut",
        "sousType",
        "type.libelle",
        "notaireNom",
        "dossier.referenceInterne",
        "dossier.client.raisonSociale",
        "parties.nomLibre",
        "parties.demandeur.nom",
        "parties.demandeur.raisonSociale",
        "biens.bien.designation",
        "biens.bien.commune",
      ],
      (t) => [...dateClauses(t, ["createdAt", "signaturePrevue", "acteSigneLe"])]
    ),
  };

  const [transactions, groupeStatuts, paiementsNonRapproches] = await Promise.all([
    auth.prisma.transaction.findMany({
      where,
      include: {
        type: { select: { code: true, libelle: true, famille: true, workflow: true, mutationFonciere: true } },
        dossier: {
          select: { id: true, referenceInterne: true, client: { select: { raisonSociale: true } } },
        },
        parties: {
          select: {
            role: true,
            nomLibre: true,
            demandeur: { select: { nom: true, prenoms: true, raisonSociale: true, typePersonne: true } },
            client: { select: { raisonSociale: true } },
          },
          orderBy: { ordre: "asc" },
        },
        biens: { select: { bien: { select: { designation: true, commune: true } } } },
        _count: { select: { formalites: true, paiements: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    auth.prisma.transaction.groupBy({
      by: ["statut"],
      where: { ...scopeFilter, archiveLe: null } as any,
      _count: true,
    }),
    auth.prisma.transactionPaiement.count({
      where: { rapproche: false, transaction: { ...scopeFilter, archiveLe: null } as any },
    }),
  ]);

  const parStatut = Object.fromEntries(groupeStatuts.map((g) => [g.statut, g._count]));
  const bloquees = [...BLOQUES].reduce((n, s) => n + (parStatut[s] || 0), 0);
  const enCours = Object.entries(parStatut).reduce(
    (n, [s, c]) => (BLOQUES.has(s) || ["CLOTURE", "ANNULEE", "ARCHIVE"].includes(s) ? n : n + (c as number)),
    0
  );
  const cloturees = (parStatut["CLOTURE"] || 0) + (parStatut["ARCHIVE"] || 0);
  const ventesTF = transactions.filter((t) => t.type.workflow === "VENTE_TF").length;

  function partiesLabel(t: (typeof transactions)[number]) {
    return t.parties
      .map((p) => {
        const nom = p.demandeur
          ? p.demandeur.typePersonne === "MORALE"
            ? p.demandeur.raisonSociale
            : [p.demandeur.prenoms, p.demandeur.nom].filter(Boolean).join(" ")
          : p.client?.raisonSociale || p.nomLibre;
        return nom ? `${nom} (${p.role.toLowerCase()})` : null;
      })
      .filter(Boolean)
      .join(" · ");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions &amp; contrats</h1>
          <p className="text-sm text-gray-500">
            Ventes, achats, baux et mandats — le cabinet agit comme conseil et
            intermédiaire : contrôle des pièces, contrats, coordination du notaire,
            suivi des paiements et archivage des preuves.
          </p>
        </div>
        {canWrite && (
          <Link href="/cabinet/dossiers/transactions/nouveau" className="btn-primary">
            + Nouvelle transaction
          </Link>
        )}
      </div>

      {/* Tableau de bord synthétique */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Transactions en cours", value: enCours, tone: "text-cabinet-800" },
          { label: "Ventes sous titre foncier", value: ventesTF, tone: "text-indigo-600" },
          { label: "Bloquées", value: bloquees, tone: "text-red-600" },
          { label: "Paiements à rapprocher", value: paiementsNonRapproches, tone: "text-amber-600" },
          { label: "Clôturées / archivées", value: cloturees, tone: "text-emerald-600" },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <div className={`text-2xl font-bold ${k.tone}`}>{k.value}</div>
            <div className="text-xs text-gray-500">{k.label}</div>
          </div>
        ))}
      </div>

      {bloquees > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>{bloquees} transaction(s) bloquée(s)</strong> — identité, capacité, titre,
          charge, succession, financement ou validation à lever avant de poursuivre.
        </div>
      )}
      {paiementsNonRapproches > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {paiementsNonRapproches} paiement(s) non rapproché(s) — bloque la clôture des
          transactions concernées.
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-2/5">
          <SearchInput placeholder="Référence, partie, bien, notaire, dossier…" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Statut</label>
          <form method="get">
            <input type="hidden" name="q" value={q} />
            <input type="hidden" name="famille" value={famille} />
            <select name="statut" defaultValue={statut} className="input text-sm">
              <option value="">Tous</option>
              {Object.entries(TRANSACTION_STATUT_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary ml-2 px-3 py-2 text-xs">
              Filtrer
            </button>
          </form>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Famille</label>
          <form method="get">
            <input type="hidden" name="q" value={q} />
            <input type="hidden" name="statut" value={statut} />
            <select name="famille" defaultValue={famille} className="input text-sm">
              <option value="">Toutes</option>
              {TRANSACTION_FAMILLES.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary ml-2 px-3 py-2 text-xs">
              Filtrer
            </button>
          </form>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="reference" label="Référence" className="px-3 py-3 text-xs" />
                <SortableTh {...thProps} column="type" label="Transaction" className="px-3 py-3 text-xs" />
                <SortableTh {...thProps} column="parties" label="Parties / bien" className="px-3 py-3 text-xs" />
                <SortableTh {...thProps} column="dossier" label="Dossier / client" className="px-3 py-3 text-xs" />
                <SortableTh {...thProps} column="montant" label="Montant" className="px-3 py-3 text-xs" />
                <SortableTh {...thProps} column="statut" label="Statut" className="px-3 py-3 text-xs" />
                <SortableTh {...thProps} column="cree" label="Créée" className="px-3 py-3 text-xs" />
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                    Aucune transaction.{" "}
                    {canWrite && (
                      <Link href="/cabinet/dossiers/transactions/nouveau" className="text-cabinet-700 underline">
                        Créer la première transaction
                      </Link>
                    )}
                  </td>
                </tr>
              )}
              <PaginatedRows colSpan={7} pageSize={15}>
                {sortRows(transactions, sort, {
                  reference: (t) => t.reference,
                  type: (t) => t.type.libelle,
                  parties: (t) => partiesLabel(t),
                  dossier: (t) => t.dossier.client.raisonSociale,
                  montant: (t) => t.prix ?? t.loyer ?? 0,
                  statut: (t) => TRANSACTION_STATUT_LABELS[t.statut] || t.statut,
                  cree: (t) => t.createdAt,
                }).map((t) => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Link
                        href={`/cabinet/dossiers/transactions/${t.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {t.reference}
                      </Link>
                      {t.type.mutationFonciere && (
                        <div className="text-xs text-indigo-600" title="Mutation foncière à suivre">
                          Titre foncier
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{t.type.libelle}</div>
                      {t.sousType && <div className="text-xs text-gray-500">{t.sousType}</div>}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <div>{partiesLabel(t) || "—"}</div>
                      {t.biens[0]?.bien && (
                        <div className="text-gray-500">
                          {t.biens[0].bien.designation}
                          {t.biens[0].bien.commune ? ` — ${t.biens[0].bien.commune}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/cabinet/dossiers/${t.dossierId}`}
                        className="text-cabinet-700 hover:underline"
                      >
                        {t.dossier.referenceInterne}
                      </Link>
                      <div className="text-xs text-gray-500">{t.dossier.client.raisonSociale}</div>
                    </td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      {t.prix != null
                        ? montant(t.prix, t.devise)
                        : t.loyer != null
                          ? `${montant(t.loyer, t.devise)}/mois`
                          : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          TRANSACTION_STATUT_BADGES[t.statut] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {TRANSACTION_STATUT_LABELS[t.statut] || t.statut}
                      </span>
                      {BLOQUES.has(t.statut) && (
                        <span className="ml-1 text-xs text-red-600" title={t.blocageMotif || "Bloquée"}>
                          ⛔
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </PaginatedRows>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
