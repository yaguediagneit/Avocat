"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { stringListOf } from "@/lib/string-list";

interface UserOption {
  id: string;
  prenom: string;
  nom: string;
  role: { nom: string; estClient: boolean };
}

interface Collaborateur {
  id: string;
  userId: string;
  roleRACI: string;
  discipline: string | null;
  /// Tâches attendues : titres de `TacheTemplate` cochés (multi-choix).
  tacheAttendue: string[];
  implicite?: boolean;
  user?: {
    id: string;
    prenom: string;
    nom: string;
    role: { nom: string; estClient: boolean };
  };
}

interface DossierProps {
  client?: { id: string; raisonSociale: string } | null;
  avocatResponsableId?: string | null;
  huissierResponsableId?: string | null;
}

interface MatriceRACIProps {
  dossierId: string;
  users: UserOption[];
  dossier?: DossierProps;
  /// Indique si l'utilisateur courant peut modifier la matrice (admin ou créateur du dossier).
  canEdit?: boolean;
  /// Titres des modèles de tâches de la spécialité du dossier (suggestions
  /// pour le champ « travail / tâche attendue »).
  tachesAttendues?: string[];
}

const RACI_LABELS: Record<string, string> = {
  R: "Responsable",
  A: "Approuve",
  C: "Consulté",
  I: "Informé",
};

const RACI_BADGES: Record<string, string> = {
  R: "bg-cabinet-700 text-white",
  A: "bg-emerald-600 text-white",
  C: "bg-amber-100 text-amber-700",
  I: "bg-gray-100 text-gray-700",
};

const DISCIPLINES = [
  { code: "avocat", label: "Avocat" },
  { code: "huissier", label: "Huissier" },
  { code: "juriste", label: "Juriste" },
  { code: "greffier", label: "Greffier" },
  { code: "notaire", label: "Notaire" },
  { code: "expert_comptable", label: "Expert-comptable" },
  { code: "assistant", label: "Assistant" },
  { code: "architecte", label: "Architecte" },
  { code: "conseiller_juridique", label: "Conseiller juridique" },
  { code: "clerc", label: "Clerc" },
];

/// Tâche attendue par défaut pour un intervenant « client ».
const CLIENT_TACHE_ATTENDUE = "fournir les documents, suivre le dossier";

function isClientUser(u: UserOption | undefined): boolean {
  return !!u?.role?.estClient;
}

/// Détermine les valeurs par défaut (discipline, roleRACI) à appliquer
/// automatiquement selon le rôle de l'intervenant sélectionné.
/// - Client            → discipline "", RACI "I", tâche prédéfinie
/// - Rôle contenant "avocat" → discipline "avocat", RACI "C"
/// - Rôle contenant "juriste" → discipline "" (Indifférent), RACI "C"
/// - Sinon             → pas de forçage (libre)
function defaultsForRole(u: UserOption | undefined): {
  discipline?: string;
  roleRACI?: "R" | "A" | "C" | "I";
  tacheAttendue?: string[];
} | null {
  if (!u) return null;
  const r = u.role.nom.toLowerCase();
  if (isClientUser(u)) {
    return { discipline: "", roleRACI: "I", tacheAttendue: [CLIENT_TACHE_ATTENDUE] };
  }
  if (r.includes("avocat")) {
    return { discipline: "avocat", roleRACI: "C" };
  }
  if (r.includes("juriste")) {
    return { discipline: "", roleRACI: "C" };
  }
  if (r.includes("directeur")) {
    return { discipline: "", roleRACI: "A" };
  }
  return null;
}

export function MatriceRACI({ dossierId, users, dossier, canEdit = true, tachesAttendues = [] }: MatriceRACIProps) {
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState("R");
  const [newDiscipline, setNewDiscipline] = useState("");
  const [newTacheAttendue, setNewTacheAttendue] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/collaborateurs`);
      if (res.ok) {
        const data = await res.json();
        setCollaborateurs(
          (data as any[]).map((c) => ({ ...c, tacheAttendue: stringListOf(c.tacheAttendue) }))
        );
      }
    } catch (err) {
      console.error(err);
    }
  }, [dossierId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addCollaborateur(e: React.FormEvent) {
    e.preventDefault();
    if (!newUserId || !canEdit) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/dossiers/${dossierId}/collaborateurs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: newUserId,
          roleRACI: newRole,
          discipline: newDiscipline || undefined,
          tacheAttendue: newTacheAttendue.length ? newTacheAttendue : undefined,
        }),
      });

      if (!res.ok) {
        setError("Erreur lors de l'ajout.");
        return;
      }

      await load();
      setNewUserId("");
      setNewRole("R");
      setNewDiscipline("");
      setNewTacheAttendue([]);
      setShowAdd(false);
    } finally {
      setLoading(false);
    }
  }

  async function removeCollaborateur(userId: string) {
    if (!canEdit) return;
    if (!confirm("Retirer ce collaborateur du dossier ?")) return;
    try {
      await fetch(`/api/dossiers/${dossierId}/collaborateurs?userId=${userId}`, {
        method: "DELETE",
      });
      setCollaborateurs((prev) => prev.filter((c) => c.userId !== userId));
    } catch (err) {
      console.error(err);
    }
  }

  async function changeRole(userId: string, newRoleRACI: string) {
    if (!canEdit) return;
    const collab = collaborateurs.find((c) => c.userId === userId);
    if (!collab) return;
    try {
      await fetch(`/api/dossiers/${dossierId}/collaborateurs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          roleRACI: newRoleRACI,
          discipline: collab.discipline || undefined,
          tacheAttendue: collab.tacheAttendue.length ? collab.tacheAttendue : undefined,
        }),
      });
      setCollaborateurs((prev) =>
        prev.map((c) => (c.userId === userId ? { ...c, roleRACI: newRoleRACI } : c))
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function changeTacheAttendue(userId: string, tacheAttendue: string[]) {
    if (!canEdit) return;
    const collab = collaborateurs.find((c) => c.userId === userId);
    if (!collab) return;
    setCollaborateurs((prev) =>
      prev.map((c) => (c.userId === userId ? { ...c, tacheAttendue } : c))
    );
    try {
      await fetch(`/api/dossiers/${dossierId}/collaborateurs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          roleRACI: collab.roleRACI,
          discipline: collab.discipline || undefined,
          tacheAttendue: tacheAttendue.length ? tacheAttendue : undefined,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  }

  const acteursImplicites = useMemo<Collaborateur[]>(() => {
    if (!dossier) return [];
    const list: Collaborateur[] = [];
    if (dossier.client) {
      list.push({
        id: `client-${dossier.client.id}`,
        userId: dossier.client.id,
        roleRACI: "I",
        discipline: null,
        tacheAttendue: [],
        implicite: true,
        user: {
          id: dossier.client.id,
          prenom: "",
          nom: dossier.client.raisonSociale,
          role: { nom: "Client principal", estClient: true },
        },
      });
    }
    if (dossier.avocatResponsableId) {
      const u = users.find((u) => u.id === dossier.avocatResponsableId);
      if (u) {
        list.push({
          id: `avocat-${u.id}`,
          userId: u.id,
          roleRACI: "R",
          discipline: "avocat",
          tacheAttendue: [],
          implicite: true,
          user: u,
        });
      }
    }
    if (dossier.huissierResponsableId) {
      const u = users.find((u) => u.id === dossier.huissierResponsableId);
      if (u) {
        list.push({
          id: `huissier-${u.id}`,
          userId: u.id,
          roleRACI: "C",
          discipline: "huissier",
          tacheAttendue: [],
          implicite: true,
          user: u,
        });
      }
    }
    return list;
  }, [dossier, users]);

  const acteurs = useMemo<Collaborateur[]>(() => {
    return [...acteursImplicites, ...collaborateurs];
  }, [acteursImplicites, collaborateurs]);

  const impliciteIds = useMemo(
    () => new Set(acteursImplicites.map((a) => a.userId)),
    [acteursImplicites]
  );

  // Filtrer les users déjà ajoutés, implicites, et les clients
  // (les clients ne peuvent pas être intervenants RACI)
  const availableUsers = users.filter(
    (u) => !isClientUser(u) && !collaborateurs.some((c) => c.userId === u.id) && !impliciteIds.has(u.id)
  );

  const newIsClient = isClientUser(availableUsers.find((u) => u.id === newUserId));

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Matrice RACI</h2>
          <p className="text-sm text-gray-600">
            Multi-contributeurs par dossier : R (Responsable), A (Approuve), C (Consulté),
            I (Informé).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          disabled={!canEdit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cabinet-700/40 bg-white px-3 py-1.5 text-xs font-medium text-cabinet-900 transition hover:bg-cabinet-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Ajouter
        </button>
      </div>

      {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      {showAdd && canEdit && (
        <form
          onSubmit={addCollaborateur}
          className="grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-4 md:grid-cols-3"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Collaborateur</label>
            <select
              value={newUserId}
              onChange={(e) => {
                const picked = availableUsers.find((u) => u.id === e.target.value);
                const defaults = defaultsForRole(picked);
                const pickedIsClient = isClientUser(picked);
                setNewUserId(e.target.value);
                if (defaults) {
                  if (defaults.discipline !== undefined) setNewDiscipline(defaults.discipline);
                  if (defaults.roleRACI !== undefined) setNewRole(defaults.roleRACI);
                  if (defaults.tacheAttendue !== undefined) setNewTacheAttendue(defaults.tacheAttendue);
                } else if (
                  newRole === "I" &&
                  newTacheAttendue.length === 1 &&
                  newTacheAttendue[0] === CLIENT_TACHE_ATTENDUE
                ) {
                  // Réinitialise si on revient depuis un client.
                  setNewRole("R");
                  setNewTacheAttendue([]);
                }
              }}
              className="input"
              required
            >
              <option value="">Sélectionner</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.prenom} {u.nom} ({u.role.nom})
                </option>
              ))}
            </select>
            {newIsClient && (
              <p className="mt-1 text-xs text-blue-700">
                Client : discipline Indifférent, rôle Informé (I), tâche prédéfinie.
              </p>
            )}
            {!newIsClient && newUserId && defaultsForRole(availableUsers.find((u) => u.id === newUserId)) && (
              <p className="mt-1 text-xs text-cabinet-700">
                Valeurs suggérées appliquées selon le rôle (modifiables).
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Rôle RACI</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className={`input ${newIsClient ? "bg-gray-100" : ""}`}
              disabled={newIsClient}
            >
              {Object.entries(RACI_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {code} — {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Discipline</label>
            <select
              value={newDiscipline}
              onChange={(e) => setNewDiscipline(e.target.value)}
              className={`input ${newIsClient ? "bg-gray-100" : ""}`}
              disabled={newIsClient}
            >
              <option value="">Indifférent</option>
              {DISCIPLINES.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Travail / tâche attendue
            </label>
            {newIsClient ? (
              <p className="text-xs text-gray-500">{CLIENT_TACHE_ATTENDUE}</p>
            ) : (
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-2">
                {tachesAttendues.length === 0 && (
                  <p className="text-xs text-gray-400">Aucune tâche modèle pour cette spécialité.</p>
                )}
                {tachesAttendues.map((t) => (
                  <label
                    key={t}
                    className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={newTacheAttendue.includes(t)}
                      onChange={(e) =>
                        setNewTacheAttendue(
                          e.target.checked
                            ? [...newTacheAttendue, t]
                            : newTacheAttendue.filter((x) => x !== t)
                        )
                      }
                      className="h-3.5 w-3.5 rounded border-gray-300"
                    />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="md:col-span-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Annuler
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "..." : "Ajouter"}
            </button>
          </div>
        </form>
      )}



      {acteurs.length === 0 && !showAdd && (
        <p className="rounded-md bg-gray-50 p-4 text-center text-sm text-gray-500">
          Aucun collaborateur RACI. Cliquez sur « Ajouter » pour définir les rôles.
        </p>
      )}

      {acteurs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {(["R", "A", "C", "I"] as const).map((role) => (
            <div key={role} className="rounded-md border border-gray-200 bg-white p-3">
              <div
                className={`mb-3 rounded-md px-3 py-1.5 text-center text-sm font-semibold ${
                  RACI_BADGES[role] || "bg-gray-100 text-gray-700"
                }`}
              >
                {role} — {RACI_LABELS[role]}
              </div>
              <ul className="space-y-2">
                {acteurs
                  .filter((c) => c.roleRACI === role)
                  .map((c) => {
                    const rowIsClient = !!c.user?.role?.estClient;
                    const rowImplicite = !!c.implicite;
                    return (
                      <li key={c.id} className="rounded-md border border-gray-100 bg-gray-50 p-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-medium">
                              {c.user ? `${c.user.prenom} ${c.user.nom}` : c.userId}
                            </div>
                            {c.user && (
                              <div className="text-xs text-gray-500">{c.user.role.nom}</div>
                            )}
                            <div className="text-xs text-gray-500">
                              {c.discipline
                                ? DISCIPLINES.find((d) => d.code === c.discipline)?.label ||
                                  c.discipline
                                : "—"}
                            </div>
                          </div>
                          {!rowImplicite && canEdit && (
                            <button
                              type="button"
                              onClick={() => removeCollaborateur(c.userId)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Retirer
                            </button>
                          )}
                        </div>
                        <div className="mt-2 max-h-24 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-2">
                          {rowIsClient ? (
                            <p className="text-xs text-gray-500">{CLIENT_TACHE_ATTENDUE}</p>
                          ) : tachesAttendues.length === 0 && c.tacheAttendue.length === 0 ? (
                            <p className="text-xs text-gray-400">—</p>
                          ) : (
                            [...new Set([...tachesAttendues, ...c.tacheAttendue])].map((t) => {
                              const checked = c.tacheAttendue.includes(t);
                              return (
                                <label
                                  key={t}
                                  className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-gray-50"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={rowImplicite || !canEdit}
                                    onChange={(e) =>
                                      changeTacheAttendue(
                                        c.userId,
                                        e.target.checked
                                          ? [...c.tacheAttendue, t]
                                          : c.tacheAttendue.filter((x) => x !== t)
                                      )
                                    }
                                    className="h-3 w-3.5 rounded border-gray-300 disabled:bg-gray-100"
                                  />
                                  <span>{t}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                        <div className="mt-2">
                          <select
                            value={c.roleRACI}
                            onChange={(e) => changeRole(c.userId, e.target.value)}
                            disabled={rowIsClient || rowImplicite || !canEdit}
                            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs disabled:bg-gray-100"
                          >
                            {Object.entries(RACI_LABELS).map(([code, label]) => (
                              <option key={code} value={code}>
                                {code} — {label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </li>
                    );
                  })}
                {acteurs.filter((c) => c.roleRACI === role).length === 0 && (
                  <li className="py-2 text-center text-xs text-gray-400">Aucun</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
