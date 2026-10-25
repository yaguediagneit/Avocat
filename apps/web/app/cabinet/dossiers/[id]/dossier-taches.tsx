"use client";

import { useState } from "react";
import Link from "next/link";
import { ItemDiscussion } from "@/components/item-discussion";
import { WordOpenButton } from "../../components/word-open-button";
import { WordUploadButton } from "../../components/word-upload-button";
import { TaskUploadButton } from "../../components/task-upload-button";
import { AdminUnlockButton } from "../../components/admin-unlock-button";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";

interface TacheItem {
  id: string;
  titre: string;
  statut: string;
  echeance: Date | null;
  createdAt: Date;
  priorite: string;
  responsableId: string;
  createurId: string;
  description?: string | null;
}

interface DossierTachesProps {
  dossierId: string;
  taches: TacheItem[];
  userMap: Record<string, string>;
  currentUserId: string;
  estAdmin: boolean;
  tacheTemplateIds?: Record<string, string>;
  tacheTemplateWordByTitre?: Record<string, boolean>;
  canCreate?: boolean;
  /// Responsables du dossier (avocat / huissier) : ils gardent la main sur les
  /// tâches même déchargées sur un intervenant.
  dossierResponsableIds?: string[];
}

const STATUT_BADGES: Record<string, string> = {
  "À faire": "bg-gray-100 text-gray-700",
  "En cours": "bg-cabinet-100 text-cabinet-800",
  "Terminée": "bg-emerald-100 text-emerald-700",
  "Annulée": "bg-red-100 text-red-700",
};

const PRIORITE_BADGES: Record<string, string> = {
  basse: "bg-gray-100 text-gray-700",
  moyenne: "bg-cabinet-50 text-cabinet-700",
  haute: "bg-amber-100 text-amber-700",
  critique: "bg-red-100 text-red-700",
};

const STATUTS = ["À faire", "En cours", "Terminée", "Annulée"] as const;

function MessageSquareIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function WrenchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
    </svg>
  );
}

function PencilIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.928a1 1 0 0 0 1.226 1.226l4.928-1.321a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function DossierTaches({
  dossierId,
  taches,
  userMap,
  currentUserId,
  estAdmin,
  tacheTemplateIds = {},
  tacheTemplateWordByTitre = {},
  canCreate = false,
  dossierResponsableIds = [],
}: DossierTachesProps) {
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [discussion, setDiscussion] = useState<{ id: string; titre: string } | null>(null);
  /// Tâches terminées déverrouillées par authentification admin.
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());

  const estResponsableDossier = dossierResponsableIds.includes(currentUserId);

  /// Changement de statut : affectataire, créateur, responsable du dossier ou admin.
  function canChangeStatut(t: TacheItem) {
    return (
      estAdmin ||
      estResponsableDossier ||
      t.responsableId === currentUserId ||
      t.createurId === currentUserId
    );
  }

  /// Modifier / désactiver : réservé à l'admin et au créateur de la tâche.
  function canManage(t: TacheItem) {
    return estAdmin || t.createurId === currentUserId;
  }

  /// Générer un document : seulement pour les tâches affectées à l'utilisateur,
  /// sauf admin et responsable du dossier qui peuvent générer pour toutes.
  function canGenerate(t: TacheItem) {
    return estAdmin || estResponsableDossier || t.responsableId === currentUserId;
  }

  async function changeStatut(tacheId: string, statut: string) {
    setUpdating(tacheId);
    setError("");
    try {
      const res = await fetch(`/api/taches/${tacheId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur lors du changement de statut");
      } else {
        // Recharger la page pour refléter le changement
        window.location.reload();
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <h3 className="font-medium">Tâches</h3>
        <div className="flex gap-4">
          {canCreate && (
            <Link
              href={`/cabinet/taches/nouvelle?dossierId=${dossierId}`}
              className="text-sm text-cabinet-700 hover:underline"
            >
              + Ajouter
            </Link>
          )}
          <Link href="/cabinet/taches" className="text-sm text-cabinet-700 hover:underline">
            Voir tout
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-100 p-2 text-xs text-red-700">{error}</div>
      )}

      {taches.length === 0 ? (
        <p className="text-sm text-gray-500">Aucune tâche.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-50 text-cabinet-900">
              <tr>
                {sortTh("taches", "titre", "Titre", "px-3 py-2")}
                {sortTh("taches", "affectataire", "Affectataire", "px-3 py-2")}
                {sortTh("taches", "cree", "Créée le", "px-3 py-2")}
                {sortTh("taches", "echeance", "Échéance", "px-3 py-2")}
                {sortTh("taches", "priorite", "Priorité", "px-3 py-2")}
                {sortTh("taches", "statut", "Statut", "px-3 py-2")}
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <PaginatedRows colSpan={7}>
              {sortRows("taches", taches, {
                titre: (t) => t.titre,
                affectataire: (t) => userMap[t.responsableId],
                cree: (t) => t.createdAt,
                echeance: (t) => t.echeance,
                priorite: (t) => t.priorite,
                statut: (t) => t.statut,
              }).map((t) => {
                const statutEditable = canChangeStatut(t);
                const manageable = canManage(t);
                const generable = canGenerate(t) && !!tacheTemplateIds[t.titre];
                const isTermine = t.statut === "Terminée";
                const isUnlocked = unlocked.has(t.id);
                /// Les actions de génération sont en pause si la tâche est terminée
                /// et qu'elle n'a pas été déverrouillée par un admin.
                const actionsLocked = isTermine && !isUnlocked && !estAdmin;
                const pdfActive = generable && !actionsLocked;
                const wordActive = generable && tacheTemplateWordByTitre[t.titre] && !actionsLocked;
                const hasActions = statutEditable || manageable || generable;
                return (
                  <tr key={t.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">
                      {t.titre}
                      {t.description && (
                        <p className="mt-0.5 text-xs text-gray-500">{t.description}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {userMap[t.responsableId] || "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {new Date(t.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {t.echeance
                        ? new Date(t.echeance).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          PRIORITE_BADGES[t.priorite] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {t.priorite}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUT_BADGES[t.statut] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {t.statut}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {hasActions ? (
                          <>
                            {statutEditable && t.statut !== "Terminée" && (
                              <button
                                type="button"
                                disabled={updating === t.id}
                                onClick={() => changeStatut(t.id, "Terminée")}
                                className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
                              >
                                Terminer
                              </button>
                            )}
                            {statutEditable && t.statut !== "En cours" && t.statut !== "Terminée" && (
                              <button
                                type="button"
                                disabled={updating === t.id}
                                onClick={() => changeStatut(t.id, "En cours")}
                                className="text-xs font-medium text-cabinet-700 hover:underline disabled:opacity-50"
                              >
                                Démarrer
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDiscussion({ id: t.id, titre: t.titre })}
                              className="text-cabinet-700 transition-colors hover:text-cabinet-900"
                              aria-label="Fil de discussion"
                              title="Fil de discussion"
                            >
                              <MessageSquareIcon />
                            </button>
                            {manageable && (
                              <Link
                                href={`/cabinet/taches/${t.id}/modifier`}
                                className="text-gray-600 transition-colors hover:text-gray-800"
                                aria-label="Modifier"
                                title="Modifier"
                              >
                                <PencilIcon />
                              </Link>
                            )}
                            {pdfActive && (
                              <Link
                                href={`/cabinet/parametrage/pdf/${tacheTemplateIds[t.titre]}?dossierId=${dossierId}&tacheId=${t.id}`}
                                className="text-amber-600 transition-colors hover:text-amber-800"
                                aria-label="Générer PDF"
                                title="Générer PDF"
                              >
                                <WrenchIcon />
                              </Link>
                            )}
                            {generable && !tacheTemplateWordByTitre[t.titre] && !actionsLocked && (
                              <TaskUploadButton
                                dossierId={dossierId}
                                tacheId={t.id}
                                tacheTitre={t.titre}
                                compact
                              />
                            )}
                            {wordActive && (
                              <WordOpenButton
                                templateId={tacheTemplateIds[t.titre]}
                                dossierId={dossierId}
                                tacheId={t.id}
                                templateTitre={t.titre}
                                compact
                              />
                            )}
                            {wordActive && (
                              <WordUploadButton
                                templateId={tacheTemplateIds[t.titre]}
                                dossierId={dossierId}
                                tacheId={t.id}
                                templateTitre={t.titre}
                                compact
                              />
                            )}
                            {actionsLocked && (
                              <AdminUnlockButton
                                compact
                                onUnlock={() =>
                                  setUnlocked((prev) => new Set(prev).add(t.id))
                                }
                              />
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">Lecture seule</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              </PaginatedRows>
            </tbody>
          </table>
        </div>
      )}

      {discussion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDiscussion(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-bold text-cabinet-900">{discussion.titre}</h3>
              <button
                onClick={() => setDiscussion(null)}
                className="text-2xl text-gray-500 hover:text-gray-700"
                aria-label="Fermer"
              >
                &times;
              </button>
            </div>
            <ItemDiscussion
              id={discussion.id}
              kind="tache"
            />
          </div>
        </div>
      )}
    </div>
  );
}
