import Link from "next/link";
import { getServerAuth, getServerDossierScopedFilter } from "@/lib/server-auth";
import { tableSearchWhere, dateClauses } from "@/lib/search";
import { hasPermission } from "@/lib/rbac";
import { SearchInput } from "@/components/search-input";
import { PaginatedRows } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";
import {
  DEMARCHE_STATUT_LABELS,
  DEMARCHE_STATUT_BADGES,
  DEMARCHE_FAMILLES,
  STATUTS_ATTENTE_ADMIN,
  STATUTS_TERMINAUX,
} from "@/lib/demarches";

const PRIORITE_BADGES: Record<string, string> = {
  BASSE: "bg-gray-100 text-gray-600",
  NORMALE: "bg-blue-50 text-blue-700",
  HAUTE: "bg-orange-100 text-orange-700",
  URGENTE: "bg-red-100 text-red-700",
};

export default async function DemarchesPage({
  searchParams,
}: {
  searchParams: { q?: string; statut?: string; famille?: string; sort?: string; dir?: string };
}) {
  const auth = await getServerAuth();
  const scopeFilter = await getServerDossierScopedFilter("demarches");
  const canWrite = hasPermission(auth.role, "demarches", "write") || auth.estAdmin;

  const q = (searchParams.q || "").trim();
  const statut = searchParams.statut || "";
  const famille = searchParams.famille || "";
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/cabinet/dossiers/demarches", params: searchParams };

  const types = await auth.prisma.demarcheType.findMany({
    where: { actif: true },
    select: { id: true, code: true, libelle: true, famille: true },
    orderBy: { ordre: "asc" },
  });
  const typeLabels = Object.fromEntries(types.map((t) => [t.code, t.libelle]));

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
        "dossier.referenceInterne",
        "dossier.client.raisonSociale",
        "demandeur.nom",
        "demandeur.raisonSociale",
        "autorite.nom",
        "parcelle.commune",
        "parcelle.nicad",
      ],
      (t) => [
        ...dateClauses(t, ["createdAt", "dateDepot", "prochaineRelance", "recoursEcheance"]),
      ]
    ),
  };

  const [demarches, groupeStatuts, relances, delivresNonRemis, fraisNonRapproches] =
    await Promise.all([
      auth.prisma.demarche.findMany({
        where,
        include: {
          type: { select: { code: true, libelle: true, famille: true, qualificationObligatoire: true } },
          dossier: { select: { id: true, referenceInterne: true, client: { select: { raisonSociale: true } } } },
          demandeur: { select: { nom: true, prenoms: true, raisonSociale: true, typePersonne: true } },
          autorite: { select: { nom: true } },
          parcelle: { select: { commune: true, nicad: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      // Tableau de bord : volumes par statut sur le périmètre visible.
      auth.prisma.demarche.groupBy({
        by: ["statut"],
        where: { ...scopeFilter, archiveLe: null } as any,
        _count: true,
      }),
      auth.prisma.demarche.findMany({
        where: {
          ...scopeFilter,
          archiveLe: null,
          statut: { in: [...STATUTS_ATTENTE_ADMIN] },
          prochaineRelance: { lte: new Date() },
        } as any,
        select: { id: true, reference: true, prochaineRelance: true },
        take: 50,
      }),
      auth.prisma.demarche.count({
        where: {
          ...scopeFilter,
          statut: "DOCUMENT_DELIVRE",
          remisAuClientLe: null,
          archiveLe: null,
        } as any,
      }),
      auth.prisma.demarcheFrais.count({
        where: {
          rapproche: false,
          nature: { in: ["DEBOURS", "TAXE", "TIMBRE"] },
          demarche: { ...scopeFilter, archiveLe: null } as any,
        },
      }),
    ]);

  const parStatut = Object.fromEntries(groupeStatuts.map((g) => [g.statut, g._count]));
  const ouvertes = demarches.length;
  const bloqueesPieces = parStatut["PIECES_PARTIELLES"] || 0;
  const aQualifier = parStatut["A_QUALIFIER"] || 0;
  const attenteAdmin = STATUTS_ATTENTE_ADMIN.reduce((n, s) => n + (parStatut[s] || 0), 0);

  function demandeurNom(d: (typeof demarches)[number]) {
    if (!d.demandeur) return "—";
    return d.demandeur.typePersonne === "MORALE"
      ? d.demandeur.raisonSociale || d.demandeur.nom
      : [d.demandeur.prenoms, d.demandeur.nom].filter(Boolean).join(" ");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Démarches administratives</h1>
          <p className="text-sm text-gray-500">
            Foncier, urbanisme, fiscalité — préparées et suivies par le cabinet ;
            l&apos;acte est délivré par l&apos;administration compétente.
          </p>
        </div>
        {canWrite && (
          <Link href="/cabinet/dossiers/demarches/nouveau" className="btn-primary">
            + Nouvelle démarche
          </Link>
        )}
      </div>

      {/* Tableau de bord synthétique */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          { label: "Démarches ouvertes", value: ouvertes, tone: "text-cabinet-800" },
          { label: "À qualifier", value: aQualifier, tone: "text-amber-600" },
          { label: "Pièces partielles", value: bloqueesPieces, tone: "text-yellow-600" },
          { label: "Attente administration", value: attenteAdmin, tone: "text-sky-600" },
          { label: "Relances à faire", value: relances.length, tone: "text-rose-600" },
          { label: "Délivrés non remis", value: delivresNonRemis, tone: "text-emerald-600" },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <div className={`text-2xl font-bold ${k.tone}`}>{k.value}</div>
            <div className="text-xs text-gray-500">{k.label}</div>
          </div>
        ))}
      </div>

      {relances.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <strong>{relances.length} démarche(s)</strong> attendent une relance auprès de
          l&apos;administration :{" "}
          {relances.slice(0, 8).map((r, i) => (
            <span key={r.id}>
              {i > 0 && ", "}
              <Link href={`/cabinet/dossiers/demarches/${r.id}`} className="font-medium underline">
                {r.reference}
              </Link>
            </span>
          ))}
          {relances.length > 8 && "…"}
        </div>
      )}
      {fraisNonRapproches > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {fraisNonRapproches} débours / taxes / timbres non rapprochés (bloque la clôture des
          démarches concernées).
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-2/5">
          <SearchInput placeholder="Référence, demandeur, parcelle, autorité…" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Statut</label>
          <form method="get">
            <input type="hidden" name="q" value={q} />
            <input type="hidden" name="famille" value={famille} />
            <select
              name="statut"
              defaultValue={statut}
              onChange={undefined}
              className="input text-sm"
            >
              <option value="">Tous</option>
              {Object.entries(DEMARCHE_STATUT_LABELS).map(([code, label]) => (
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
              {DEMARCHE_FAMILLES.map((f) => (
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
                <SortableTh {...thProps} column="type" label="Démarche" className="px-3 py-3 text-xs" />
                <SortableTh {...thProps} column="demandeur" label="Demandeur" className="px-3 py-3 text-xs" />
                <SortableTh {...thProps} column="dossier" label="Dossier / client" className="px-3 py-3 text-xs" />
                <SortableTh {...thProps} column="autorite" label="Autorité" className="px-3 py-3 text-xs" />
                <SortableTh {...thProps} column="statut" label="Statut" className="px-3 py-3 text-xs" />
                <SortableTh {...thProps} column="priorite" label="Priorité" className="px-3 py-3 text-xs" />
                <SortableTh {...thProps} column="relance" label="Prochaine relance" className="px-3 py-3 text-xs" />
                <SortableTh {...thProps} column="cree" label="Créée" className="px-3 py-3 text-xs" />
              </tr>
            </thead>
            <tbody>
              {demarches.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-500">
                    Aucune démarche.{" "}
                    {canWrite && (
                      <Link href="/cabinet/dossiers/demarches/nouveau" className="text-cabinet-700 underline">
                        Créer la première démarche
                      </Link>
                    )}
                  </td>
                </tr>
              )}
              <PaginatedRows colSpan={9} pageSize={15}>
                {sortRows(demarches, sort, {
                  reference: (d) => d.reference,
                  type: (d) => d.type.libelle,
                  demandeur: (d) => demandeurNom(d),
                  dossier: (d) => d.dossier.client.raisonSociale,
                  autorite: (d) => d.autorite?.nom || d.autoriteLibre || "",
                  statut: (d) => DEMARCHE_STATUT_LABELS[d.statut] || d.statut,
                  priorite: (d) => d.priorite,
                  relance: (d) => d.prochaineRelance,
                  cree: (d) => d.createdAt,
                }).map((d) => (
                  <tr key={d.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-3 whitespace-nowrap">
                      <Link
                        href={`/cabinet/dossiers/demarches/${d.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {d.reference}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{d.type.libelle}</div>
                      {d.sousType && (
                        <div className="text-xs text-gray-500">{d.sousType}</div>
                      )}
                    </td>
                    <td className="px-3 py-3">{demandeurNom(d)}</td>
                    <td className="px-3 py-3">
                      <Link href={`/cabinet/dossiers/${d.dossierId}`} className="text-cabinet-700 hover:underline">
                        {d.dossier.referenceInterne}
                      </Link>
                      <div className="text-xs text-gray-500">{d.dossier.client.raisonSociale}</div>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {d.autorite?.nom || d.autoriteLibre || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          DEMARCHE_STATUT_BADGES[d.statut] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {DEMARCHE_STATUT_LABELS[d.statut] || d.statut}
                      </span>
                      {d.type.qualificationObligatoire && d.statut === "A_QUALIFIER" && (
                        <span className="ml-1 text-xs text-amber-600" title="Qualification obligatoire incomplète">
                          ⚠
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${PRIORITE_BADGES[d.priorite] || ""}`}>
                        {d.priorite}
                      </span>
                      {d.urgent && <span className="ml-1 text-xs font-semibold text-red-600">!</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {d.prochaineRelance && STATUTS_ATTENTE_ADMIN.includes(d.statut)
                        ? new Date(d.prochaineRelance).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleDateString("fr-FR")}
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
