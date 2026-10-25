"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PaginatedList } from "@/components/pagination";

interface Role {
  id: string;
  nom: string;
  estAdmin: boolean;
  estClient: boolean;
  actif: boolean;
  permissions: Record<string, string[]>;
}

const RESOURCES = [
  { key: "tableau_de_bord", label: "Tableau de bord" },
  { key: "dossiers", label: "Dossiers" },
  { key: "clients", label: "Clients" },
  { key: "taches", label: "Tâches" },
  { key: "documents", label: "Documents" },
  { key: "missions", label: "Missions" },
  { key: "administration", label: "Administration" },
  { key: "demarches", label: "Démarches administratives" },
  { key: "transactions", label: "Transactions & contrats" },
  { key: "rendezVous", label: "Calendrier / Rendez-vous" },
  { key: "factures", label: "Factures" },
  { key: "comptabilite", label: "Comptabilité / Personnel / Charges" },
  { key: "audit", label: "Audit" },
  { key: "parametres", label: "Paramétrage" },
  { key: "users", label: "Utilisateurs" },
  { key: "roles", label: "Rôles" },
];

const ACTIONS = [
  { key: "read", label: "Voir" },
  { key: "write", label: "Éditer" },
  { key: "validate", label: "Valider" },
  { key: "delete", label: "Supprimer" },
];

interface ParametrageRolesClientProps {
  initialRoles: Role[];
}

export function ParametrageRolesClient({ initialRoles }: ParametrageRolesClientProps) {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [newRoleName, setNewRoleName] = useState("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateRole(id: string, updates: Partial<Role>) {
    setRoles((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  }

  function togglePermission(roleId: string, resource: string, action: string, checked: boolean) {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== roleId) return r;
        const perms = { ...r.permissions };
        const list = new Set(perms[resource] || []);
        if (checked) list.add(action);
        else list.delete(action);
        perms[resource] = Array.from(list);
        return { ...r, permissions: perms };
      })
    );
  }

  async function saveRole(role: Role) {
    setLoading((l) => ({ ...l, [role.id]: true }));
    setErrors((e) => ({ ...e, [role.id]: "" }));

    try {
      const res = await fetch(`/api/parametres/roles/${role.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: role.nom,
          estAdmin: role.estAdmin,
          estClient: role.estClient,
          permissions: role.permissions,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          data?.error?.formErrors?.[0] ||
          (typeof data.error === "string" ? data.error : "Erreur lors de l'enregistrement.");
        setErrors((e) => ({ ...e, [role.id]: message }));
      } else {
        router.refresh();
      }
    } finally {
      setLoading((l) => ({ ...l, [role.id]: false }));
    }
  }

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    try {
      const res = await fetch("/api/parametres/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: newRoleName.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Erreur lors de la création du rôle.");
        return;
      }

      setRoles((prev) => [
        ...prev,
        {
          id: data.id,
          nom: data.nom,
          estAdmin: data.estAdmin || false,
          estClient: data.estClient || false,
          actif: data.actif !== false,
          permissions: (data.permissions as Record<string, string[]>) || {},
        },
      ]);
      setNewRoleName("");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Erreur réseau.");
    }
  }

  async function toggleRoleActif(role: Role) {
    const next = role.actif === false;
    const res = await fetch(`/api/parametres/roles/${role.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Erreur lors du changement d'état.");
      return;
    }

    setRoles((prev) => prev.map((r) => (r.id === role.id ? { ...r, actif: next } : r)));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createRole} className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium">Nouveau rôle</label>
          <input
            type="text"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            className="input"
            placeholder="Nom du rôle"
          />
        </div>
        <button type="submit" className="btn-primary">
          Ajouter
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <PaginatedList pagerClassName="lg:col-span-2">
        {roles.map((role) => (
          <section key={role.id} className={`card space-y-4 ${role.actif === false ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={role.nom}
                  onChange={(e) => updateRole(role.id, { nom: e.target.value })}
                  className="input font-semibold"
                />
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={role.estAdmin}
                      onChange={(e) => updateRole(role.id, { estAdmin: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-cabinet-700 focus:ring-cabinet-500"
                    />
                    Administrateur
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={role.estClient}
                      onChange={(e) => updateRole(role.id, { estClient: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-cabinet-700 focus:ring-cabinet-500"
                    />
                    Client
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {role.actif === false && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Inactif</span>
                )}
                <button
                  type="button"
                  onClick={() => toggleRoleActif(role)}
                  className={`text-sm hover:underline ${role.actif !== false ? "text-red-700" : "text-emerald-700"}`}
                >
                  {role.actif !== false ? "Désactiver" : "Activer"}
                </button>
              </div>
            </div>

            {errors[role.id] && (
              <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">
                {errors[role.id]}
              </div>
            )}

            {role.estAdmin ? (
              <p className="text-sm text-gray-600">
                Ce rôle est administrateur : accès total à l&apos;application.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-cabinet-50 text-cabinet-900">
                    <tr>
                      <th className="px-3 py-2">Onglet / Fenêtre</th>
                      {ACTIONS.map((a) => (
                        <th key={a.key} className="px-3 py-2 text-center">
                          {a.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RESOURCES.map((resource) => (
                      <tr key={resource.key} className="border-t">
                        <td className="px-3 py-2 font-medium">{resource.label}</td>
                        {ACTIONS.map((action) => {
                          const checked = (role.permissions[resource.key] || []).includes(
                            action.key
                          );
                          return (
                            <td key={action.key} className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  togglePermission(
                                    role.id,
                                    resource.key,
                                    action.key,
                                    e.target.checked
                                  )
                                }
                                className="h-4 w-4 rounded border-gray-300 text-cabinet-700 focus:ring-cabinet-500"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => saveRole(role)}
                disabled={loading[role.id]}
                className="btn-primary"
              >
                {loading[role.id] ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </section>
        ))}
        </PaginatedList>
      </div>

      {roles.length === 0 && (
        <p className="text-center text-sm text-gray-500">Aucun rôle défini.</p>
      )}
    </div>
  );
}
