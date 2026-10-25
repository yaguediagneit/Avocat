import { prisma } from "@/lib/prisma";
import { getServerDossierScopedFilter, getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { notFound } from "next/navigation";
import Link from "next/link";
import { RowActions } from "@/components/row-actions";
import { MissionStatutSelect } from "@/components/mission-statut-select";
import { PaginatedRows } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

const PROFESSIONS: Record<string, { model: string; label: string; intervenantLabel: string; idField: string }> = {
  architecte: { model: "missionArchitecte", label: "Missions d'architecte", intervenantLabel: "Architecte", idField: "architecteId" },
  "conseiller-juridique": { model: "missionConseillerJuridique", label: "Missions de conseiller juridique", intervenantLabel: "Conseiller juridique", idField: "conseillerJuridiqueId" },
  clerc: { model: "missionClerc", label: "Missions de clerc", intervenantLabel: "Clerc", idField: "clercId" },
};

const STATUT_BADGES: Record<string, string> = {
  "En préparation": "bg-gray-100 text-gray-700",
  "Tentée": "bg-amber-100 text-amber-700",
  "Remise": "bg-emerald-100 text-emerald-700",
  "Annulée": "bg-red-100 text-red-700",
  "Échouée": "bg-red-100 text-red-700",
};

export default async function MissionsProfessionPage({
  params,
  searchParams,
}: {
  params: { profession: string };
  searchParams: { sort?: string; dir?: string };
}) {
  const profession = PROFESSIONS[params.profession];
  const sort = getSortSpec(searchParams);
  const thProps = { path: `/cabinet/missions/profession/${params.profession}`, params: searchParams };
  if (!profession) {
    notFound();
  }

  const accessFilter = await getServerDossierScopedFilter("missions");
  const auth = await getServerAuth();
  const canEditMissions = hasPermission(auth.role, "missions", "write");
  const [missions, users] = await Promise.all([
    (prisma as any)[profession.model].findMany({
      where: accessFilter,
      take: 200,
      include: { dossier: { select: { referenceInterne: true } } },
      orderBy: { createdAt: "desc" },
    }) as Promise<
      {
        id: string;
        dossierId: string;
        [key: string]: any;
        dossier: { referenceInterne: string };
      }[]
    >,
    prisma.user.findMany({
      take: 200,
      where: { actif: true },
      select: { id: true, prenom: true, nom: true },
    }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, `${u.prenom} ${u.nom}`]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{profession.label}</h1>
        <Link href={`/cabinet/missions/profession/${params.profession}/nouvelle`} className="btn-primary">
          + Nouvelle mission
        </Link>
      </div>
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="dossier" label="Dossier" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="type" label="Type" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="intervenant" label={profession.intervenantLabel} className="px-2 py-3 text-xs whitespace-nowrap" />
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
                type: (m) => m.typeActe,
                intervenant: (m) => userMap.get(m[profession.idField]) || m[profession.idField],
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
                  <Link href={`/cabinet/missions/profession/${params.profession}/${m.id}`} className="text-cabinet-700 hover:underline">
                    {m.typeActe}
                  </Link>
                </td>
                <td className="px-4 py-3">{userMap.get(m[profession.idField]) || m[profession.idField]}</td>
                <td className="px-4 py-3">{m.destinataire || "—"}</td>
                <td className="px-4 py-3">
                  {m.datePrevue ? new Date(m.datePrevue).toLocaleString("fr-FR") : "—"}
                </td>
                <td className="px-4 py-3">
                  {canEditMissions ? (
                    <MissionStatutSelect
                      missionId={m.id}
                      current={m.statut}
                      apiPath={`/api/missions/profession/${params.profession}/${m.id}`}
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
                      href={`/cabinet/missions/profession/${params.profession}/${m.id}`}
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
                      customApiPath={`/api/missions/profession/${params.profession}/${m.id}`}
                      entityLabel={`${m.typeActe} — ${m.dossier.referenceInterne}`}
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
