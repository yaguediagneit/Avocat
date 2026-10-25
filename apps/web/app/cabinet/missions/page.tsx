import { prisma } from "@/lib/prisma";
import { tableSearchWhere, codesMatchingLabel, usersMatchingQuery, userIdsMatchingTerm, dateClauses } from "@/lib/search";
import { getServerDossierScopedFilter, getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import Link from "next/link";
import { RowActions } from "@/components/row-actions";
import { MissionStatutSelect } from "@/components/mission-statut-select";
import { SearchInput } from "@/components/search-input";
import { PaginatedRows } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

const TYPE_LABELS: Record<string, string> = {
  signification: "Signification",
  sommation: "Sommation",
  mise_en_demeure: "Mise en demeure",
  constat: "Constat",
  saisie: "Saisie",
  convocation: "Convocation",
};

const TYPE_BADGES: Record<string, string> = {
  signification: "bg-cabinet-100 text-cabinet-800",
  sommation: "bg-amber-100 text-amber-700",
  mise_en_demeure: "bg-red-100 text-red-700",
  constat: "bg-blue-100 text-blue-700",
  saisie: "bg-purple-100 text-purple-700",
  convocation: "bg-emerald-100 text-emerald-700",
};

const STATUT_BADGES: Record<string, string> = {
  "En préparation": "bg-gray-100 text-gray-700",
  "Tentée": "bg-amber-100 text-amber-700",
  "Remise": "bg-emerald-100 text-emerald-700",
  "Annulée": "bg-red-100 text-red-700",
  "Échouée": "bg-red-100 text-red-700",
};

export default async function MissionsPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; dir?: string };
}) {
  const accessFilter = await getServerDossierScopedFilter("missions");
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/cabinet/missions", params: searchParams };
  const auth = await getServerAuth();
  const canEditMissions = hasPermission(auth.role, "missions", "write");
  const q = (searchParams.q || "").trim();
  // huissierId est une chaîne sans relation : pré-chargé pour chercher par nom.
  const searchUsers = q ? await usersMatchingQuery(prisma, q) : [];
  const [missions, users] = await Promise.all([
    prisma.missionHuissier.findMany({
      where: {
        ...accessFilter,
        ...tableSearchWhere(
          q,
          [
            "typeActe",
            "destinataire",
            "statut",
            "adresseSignification",
            "resultat",
            "dossier.referenceInterne",
          ],
          (t) => [
            { typeActe: { in: codesMatchingLabel(t, TYPE_LABELS) } },
            { huissierId: { in: userIdsMatchingTerm(searchUsers, t) } },
            ...dateClauses(t, ["datePrevue", "dateTentative", "dateRemise", "createdAt"]),
          ]
        ),
      },
      take: 200,
      include: { dossier: { select: { referenceInterne: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      take: 200,
      select: { id: true, prenom: true, nom: true },
    }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, `${u.prenom} ${u.nom}`]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Missions d&apos;huissier</h1>
        <Link href="/cabinet/missions/nouvelle" className="btn-primary">
          + Nouvelle mission
        </Link>
      </div>
      <SearchInput placeholder="Filtrer missions..." />
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="dossier" label="Dossier" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="acte" label="Acte" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="huissier" label="Huissier" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="dest" label="Dest." className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="prevue" label="Prévue" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="statut" label="Statut" className="px-2 py-3 text-xs whitespace-nowrap" />
                <th className="px-2 py-3 text-right text-xs whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {missions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-sm text-gray-500">
                    Aucune mission pour le moment.
                  </td>
                </tr>
              )}
              <PaginatedRows colSpan={7}>
              {sortRows(missions, sort, {
                dossier: (m) => m.dossier.referenceInterne,
                acte: (m) => TYPE_LABELS[m.typeActe] || m.typeActe,
                huissier: (m) => userMap.get(m.huissierId) || m.huissierId,
                dest: (m) => m.destinataire,
                prevue: (m) => m.datePrevue,
                statut: (m) => m.statut,
              }).map((m) => (
              <tr key={m.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/cabinet/dossiers/${m.dossierId}`} className="text-cabinet-700 hover:underline">
                    {m.dossier.referenceInterne}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      TYPE_BADGES[m.typeActe] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {TYPE_LABELS[m.typeActe] || m.typeActe}
                  </span>
                </td>
                <td className="px-4 py-3">{userMap.get(m.huissierId) || m.huissierId}</td>
                <td className="px-4 py-3">{m.destinataire || "—"}</td>
                <td className="px-4 py-3">
                  {m.datePrevue ? new Date(m.datePrevue).toLocaleString("fr-FR") : "—"}
                </td>
                <td className="px-4 py-3">
                  {canEditMissions ? (
                    <MissionStatutSelect
                      missionId={m.id}
                      current={m.statut}
                      apiPath={`/api/missions/${m.id}`}
                    />
                  ) : (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUT_BADGES[m.statut] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {m.statut}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/cabinet/missions/${m.id}`}
                      className="text-xs font-medium text-cabinet-700 hover:underline"
                    >
                      Modifier
                    </Link>
                    <Link
                      href={`/cabinet/documents/nouveau?dossierId=${m.dossierId}`}
                      className="text-xs font-medium text-cabinet-700 hover:underline"
                    >
                      Document
                    </Link>
                    <RowActions
                      resource="missions"
                      id={m.id}
                      active={m.actif}
                      isAdmin={auth.estAdmin}
                      canEdit={canEditMissions}
                      entityLabel={`${TYPE_LABELS[m.typeActe] || m.typeActe} — ${m.dossier.referenceInterne}`}
                    />
                  </div>
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
