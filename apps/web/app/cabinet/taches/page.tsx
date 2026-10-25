import { prisma } from "@/lib/prisma";
import { tableSearchWhere, usersMatchingQuery, userIdsMatchingTerm, dateClauses } from "@/lib/search";
import { getServerDossierScopedFilter, getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import Link from "next/link";
import { RowActions } from "@/components/row-actions";
import { SearchInput } from "@/components/search-input";
import { WordOpenButton } from "../components/word-open-button";
import { WordUploadButton } from "../components/word-upload-button";
import { PaginatedRows } from "@/components/pagination";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

const PRIORITE_BADGES: Record<string, string> = {
  basse: "bg-gray-100 text-gray-700",
  moyenne: "bg-cabinet-50 text-cabinet-700",
  haute: "bg-amber-100 text-amber-700",
  critique: "bg-red-100 text-red-700",
};

const STATUT_BADGES: Record<string, string> = {
  "À faire": "bg-gray-100 text-gray-700",
  "En cours": "bg-cabinet-100 text-cabinet-800",
  "Terminée": "bg-emerald-100 text-emerald-700",
  "Annulée": "bg-red-100 text-red-700",
};

export default async function TachesPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; dir?: string };
}) {
  const accessFilter = await getServerDossierScopedFilter("taches");
  const auth = await getServerAuth();
  const q = (searchParams.q || "").trim();
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/cabinet/taches", params: searchParams };
  // responsableId est une chaîne sans relation : on pré-charge les utilisateurs
  // dont le nom matche pour chercher aussi sur la colonne « Resp. ».
  const searchUsers = q ? await usersMatchingQuery(prisma, q) : [];

  // Les tâches visibles sont celles des dossiers accessibles à l'utilisateur.
  // getDossierScopedAccessFilter inclut : avocat responsable, huissier responsable,
  // collaborateurs (matrice RACI / associés / intervenants), permissions explicites.
  const [taches, users, tacheTemplates] = await Promise.all([
    prisma.tache.findMany({
      where: {
        ...(accessFilter as any),
        ...tableSearchWhere(
          q,
          [
            "titre",
            "description",
            "statut",
            "priorite",
            "dossier.referenceInterne",
            "dossier.client.raisonSociale",
          ],
          (t) => [
            { responsableId: { in: userIdsMatchingTerm(searchUsers, t) } },
            ...dateClauses(t, ["echeance", "createdAt"]),
          ]
        ),
      },
      take: 100,
      include: {
        dossier: {
          select: {
            referenceInterne: true,
            avocatResponsableId: true,
            huissierResponsableId: true,
          },
        },
      },
      orderBy: { echeance: "asc" },
    }),
    prisma.user.findMany({
      take: 200,
      select: { id: true, prenom: true, nom: true },
    }),
    prisma.tacheTemplate.findMany({
      where: { actif: true },
      select: { id: true, titre: true, wordTemplateKey: true },
      orderBy: { titre: "asc" },
    }),
  ]);

  const userMap = new Map(users.map((u) => [u.id, `${u.prenom} ${u.nom}`]));
  const tacheTemplateIdByTitre = new Map<string, string>();
  const tacheTemplateWordByTitre = new Map<string, boolean>();
  for (const t of tacheTemplates) {
    if (!tacheTemplateIdByTitre.has(t.titre)) {
      tacheTemplateIdByTitre.set(t.titre, t.id);
      tacheTemplateWordByTitre.set(t.titre, !!t.wordTemplateKey);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tâches</h1>
        <Link href="/cabinet/taches/nouvelle" className="btn-primary">
          + Nouvelle tâche
        </Link>
      </div>
      <SearchInput placeholder="Filtrer tâches..." />
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <SortableTh {...thProps} column="titre" label="Titre" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="dossier" label="Dossier" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="resp" label="Resp." className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="echeance" label="Échéance" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="priorite" label="Priorité" className="px-2 py-3 text-xs whitespace-nowrap" />
                <SortableTh {...thProps} column="statut" label="Statut" className="px-2 py-3 text-xs whitespace-nowrap" />
                <th className="px-2 py-3 text-right text-xs whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {taches.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-sm text-gray-500">
                    Aucune tâche pour le moment.
                  </td>
                </tr>
              )}
              <PaginatedRows colSpan={7}>
              {sortRows(taches, sort, {
                titre: (t) => t.titre,
                dossier: (t) => t.dossier.referenceInterne,
                resp: (t) => userMap.get(t.responsableId) || t.responsableId,
                echeance: (t) => t.echeance,
                priorite: (t) => t.priorite,
                statut: (t) => t.statut,
              }).map((t) => (
              <tr key={t.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{t.titre}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/cabinet/dossiers/${t.dossierId}`}
                    className="text-cabinet-700 hover:underline"
                  >
                    {t.dossier.referenceInterne}
                  </Link>
                </td>
                <td className="px-4 py-3">{userMap.get(t.responsableId) || t.responsableId}</td>
                <td className="px-4 py-3">
                  {t.echeance ? new Date(t.echeance).toLocaleString("fr-FR") : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      PRIORITE_BADGES[t.priorite] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {t.priorite}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUT_BADGES[t.statut] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {t.statut}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {(() => {
                    /// Modifier / désactiver : réservé à l'admin et au
                    /// responsable du dossier (avocat / huissier).
                    const estResponsableDossier =
                      t.dossier.avocatResponsableId === auth.userId ||
                      t.dossier.huissierResponsableId === auth.userId;
                    const canManageTask = auth.estAdmin || estResponsableDossier;
                    const tacheTemplateId = tacheTemplateIdByTitre.get(t.titre);
                    /// Générer : seulement pour les tâches affectées à
                    /// l'utilisateur, sauf admin et responsable du dossier.
                    const canGenerate =
                      (canManageTask || t.responsableId === auth.userId) &&
                      !!tacheTemplateId &&
                      (auth.estAdmin || hasPermission(auth.role, "documents", "write"));
                    if (!canManageTask) {
                      return (
                        <div className="flex items-center justify-end gap-2">
                          {canGenerate && (
                            <>
                              <Link
                                href={`/cabinet/parametrage/pdf/${tacheTemplateId}?dossierId=${t.dossierId}&tacheId=${t.id}`}
                                className="text-xs font-medium text-cabinet-700 hover:underline"
                              >
                                Générer
                              </Link>
                              {tacheTemplateWordByTitre.get(t.titre) && (
                                <WordOpenButton
                                  templateId={tacheTemplateId}
                                  dossierId={t.dossierId}
                                  tacheId={t.id}
                                  templateTitre={t.titre}
                                />
                              )}
                              {tacheTemplateWordByTitre.get(t.titre) && (
                                <WordUploadButton
                                  templateId={tacheTemplateId}
                                  dossierId={t.dossierId}
                                  tacheId={t.id}
                                  templateTitre={t.titre}
                                />
                              )}
                            </>
                          )}
                          <span className="text-xs text-gray-400">Lecture seule</span>
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-center justify-end gap-2">
                        <RowActions
                          resource="taches"
                          id={t.id}
                          active={t.actif}
                          isAdmin={auth.estAdmin}
                          canEdit={auth.estAdmin || t.createurId === auth.userId}
                          editHref={`/cabinet/taches/${t.id}/modifier`}
                          entityLabel={t.titre}
                        />
                        {canGenerate && (
                          <>
                            <Link
                              href={`/cabinet/parametrage/pdf/${tacheTemplateId}?dossierId=${t.dossierId}&tacheId=${t.id}`}
                              className="text-xs font-medium text-cabinet-700 hover:underline"
                            >
                              Générer
                            </Link>
                            {tacheTemplateWordByTitre.get(t.titre) && (
                              <WordOpenButton
                                templateId={tacheTemplateId}
                                dossierId={t.dossierId}
                                tacheId={t.id}
                                templateTitre={t.titre}
                              />
                            )}
                            {tacheTemplateWordByTitre.get(t.titre) && (
                              <WordUploadButton
                                templateId={tacheTemplateId}
                                dossierId={t.dossierId}
                                tacheId={t.id}
                                templateTitre={t.titre}
                              />
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}
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
