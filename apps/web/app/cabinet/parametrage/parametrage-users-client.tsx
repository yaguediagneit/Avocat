"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";

interface Role {
  id: string;
  nom: string;
  estClient?: boolean;
  actif?: boolean;
}

interface ClientOption {
  id: string;
  type: string;
  raisonSociale: string;
  representants?: { nom?: string; prenom?: string }[] | null;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  position: string | null;
  department: string | null;
}

interface User {
  id: string;
  prenom: string;
  nom: string;
  titre: string;
  specialite: string;
  email: string;
  roleId: string;
  role: Role;
  actif: boolean;
  signatureKey?: string | null;
}

interface ParametrageUsersClientProps {
  initialUsers: User[];
  roles: Role[];
  clients: ClientOption[];
  employees: EmployeeOption[];
}

const emptyForm = {
  id: "",
  clientId: "",
  employeeId: "",
  prenom: "",
  nom: "",
  titre: "",
  specialite: "",
  email: "",
  roleId: "",
  actif: true,
  password: "",
  confirmPassword: "",
  signature: "",
  signatureFileName: "",
  signatureKey: "",
};

type FormState = typeof emptyForm;

export function ParametrageUsersClient({ initialUsers, roles, clients, employees }: ParametrageUsersClientProps) {
  const router = useRouter();
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEditing = Boolean(form.id);

  const clientRole = useMemo(() => roles.find((r) => r.estClient), [roles]);

  function handleEmployeeSelect(employeeId: string) {
    if (!employeeId) {
      setForm((f) => ({ ...f, employeeId: "" }));
      return;
    }
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return;

    setForm((f) => ({
      ...f,
      employeeId,
      clientId: "",
      prenom: employee.firstName,
      nom: employee.lastName,
      email: employee.email || "",
      titre: employee.position || "",
      specialite: employee.department || "",
    }));
  }

  function handleClientSelect(clientId: string) {
    if (!clientId) {
      setForm((f) => ({ ...f, clientId: "" }));
      return;
    }
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    const rep = client.representants?.find((r) => r.nom || r.prenom);
    let prenom = rep?.prenom?.trim() || "";
    let nom = rep?.nom?.trim() || "";
    if (!prenom && !nom) {
      const parts = client.raisonSociale.trim().split(/\s+/);
      prenom = parts.length > 1 ? parts[0] : "";
      nom = parts.length > 1 ? parts.slice(1).join(" ") : client.raisonSociale.trim();
    }

    setForm((f) => ({
      ...f,
      clientId,
      employeeId: "",
      prenom,
      nom,
      email: "",
      roleId: clientRole?.id || f.roleId,
      password: "",
      confirmPassword: "",
    }));
  }

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
  }, [users]);

  function openCreate() {
    setForm(emptyForm);
    setError("");
    setIsOpen(true);
  }

  function openEdit(user: User) {
    setForm({
      id: user.id,
      clientId: "",
      employeeId: "",
      prenom: user.prenom,
      nom: user.nom,
      titre: user.titre || "",
      specialite: user.specialite || "",
      email: user.email,
      roleId: user.roleId,
      actif: user.actif,
      password: "",
      confirmPassword: "",
      signature: "",
      signatureFileName: "",
      signatureKey: user.signatureKey || "",
    });
    setError("");
    setIsOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
    setForm(emptyForm);
    setError("");
  }

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSignatureFile(file?: File) {
    if (!file) {
      setForm((f) => ({ ...f, signature: "", signatureFileName: "" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setForm((f) => ({
        ...f,
        signature: (e.target?.result as string) || "",
        signatureFileName: file.name,
        signatureKey: "",
      }));
    };
    reader.readAsDataURL(file);
  }

  function validate() {
    if (!form.prenom.trim() || !form.nom.trim() || !form.email.trim() || !form.roleId) {
      return "Tous les champs obligatoires doivent être renseignés.";
    }
    if (!isEditing || form.password) {
      if (form.password.length < 8) {
        return "Le mot de passe doit faire au moins 8 caractères.";
      }
      if (form.password !== form.confirmPassword) {
        return "Les mots de passe ne correspondent pas.";
      }
    }
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    const body: any = {
      clientId: form.clientId || undefined,
      prenom: form.prenom.trim(),
      nom: form.nom.trim(),
      titre: form.titre.trim(),
      specialite: form.specialite.trim(),
      email: form.email.trim(),
      roleId: form.roleId,
      actif: form.actif,
    };

    if (form.signature && form.signature.startsWith("data:")) {
      body.signature = form.signature;
    }

    if (!isEditing || form.password) {
      body.password = form.password;
    }

    try {
      const url = isEditing ? `/api/parametres/users/${form.id}` : "/api/parametres/users";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          data?.error?.formErrors?.[0] ||
          (typeof data.error === "string" ? data.error : "Erreur lors de l'enregistrement.");
        setError(message);
        return;
      }

      if (isEditing) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === data.id
              ? {
                  id: data.id,
                  prenom: data.prenom,
                  nom: data.nom,
                  titre: data.titre || "",
                  specialite: data.specialite || "",
                  email: data.email,
                  roleId: data.roleId,
                  role: data.role,
                  actif: data.actif,
                }
              : u
          )
        );
      } else {
        setUsers((prev) => [
          ...prev,
          {
            id: data.id,
            prenom: data.prenom,
            nom: data.nom,
            titre: data.titre || "",
            specialite: data.specialite || "",
            email: data.email,
            roleId: data.roleId,
            role: data.role,
            actif: data.actif,
          },
        ]);
      }

      closeModal();
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActif(user: User) {
    const next = !user.actif;
    if (!window.confirm(next ? "Activer ce compte utilisateur ?" : "Désactiver ce compte utilisateur ? Il ne pourra plus se connecter.")) return;

    const res = await fetch(`/api/parametres/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Erreur lors du changement d'état.");
      return;
    }

    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, actif: next } : u)));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Utilisateurs</h2>
        <button type="button" onClick={openCreate} className="btn-primary">
          + Ajouter un utilisateur
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-cabinet-50 text-cabinet-900">
            <tr>
              {sortTh("users", "id", "ID", "px-2 py-2 text-xs whitespace-nowrap")}
              {sortTh("users", "nom", "Nom", "px-2 py-2 text-xs whitespace-nowrap")}
              {sortTh("users", "titre", "Titre", "px-2 py-2 text-xs whitespace-nowrap")}
              {sortTh("users", "spe", "Spé.", "px-2 py-2 text-xs whitespace-nowrap")}
              {sortTh("users", "email", "Email", "px-2 py-2 text-xs whitespace-nowrap")}
              {sortTh("users", "role", "Rôle", "px-2 py-2 text-xs whitespace-nowrap")}
              {sortTh("users", "actif", "Actif", "px-2 py-2 text-xs whitespace-nowrap")}
              <th className="px-2 py-2 text-right text-xs whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            <PaginatedRows colSpan={8}>
            {sortRows("users", sortedUsers, {
              id: (u) => u.id,
              nom: (u) => `${u.nom} ${u.prenom}`,
              titre: (u) => u.titre,
              spe: (u) => u.specialite,
              email: (u) => u.email,
              role: (u) => u.role?.nom,
              actif: (u) => (u.actif ? "Oui" : "Non"),
            }).map((u) => (
              <tr key={u.id} className="border-t hover:bg-gray-50">
                <td className="px-2 py-2 font-mono text-xs">{u.id}</td>
                <td className="px-2 py-2 font-medium">
                  {u.prenom} {u.nom}
                </td>
                <td className="px-2 py-2">{u.titre || "—"}</td>
                <td className="px-2 py-2">{u.specialite || "—"}</td>
                <td className="px-2 py-2">{u.email}</td>
                <td className="px-2 py-2">{u.role?.nom || "—"}</td>
                <td className="px-2 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.actif ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {u.actif ? "Oui" : "Non"}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => openEdit(u)}
                    className="mr-2 text-sm text-cabinet-700 hover:underline"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActif(u)}
                    className={`text-sm hover:underline ${u.actif ? "text-red-700" : "text-emerald-700"}`}
                  >
                    {u.actif ? "Désactiver" : "Activer"}
                  </button>
                </td>
              </tr>
            ))}
            </PaginatedRows>
            {users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-4 text-center text-sm text-gray-500">
                  Aucun utilisateur.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-cabinet-950/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="card flex max-h-[96vh] w-full max-w-lg flex-col p-0">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 p-4">
              <h3 className="text-lg font-semibold">
                {isEditing ? "Modifier un utilisateur" : "Ajouter un utilisateur"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-2xl leading-none text-gray-500 hover:text-gray-800"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            {error && <div className="shrink-0 bg-red-100 p-3 text-sm text-red-700">{error}</div>}

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-[11px] overflow-y-auto p-4">
                <div className="grid gap-[11px] md:grid-cols-2">
                {!isEditing && employees.length > 0 && (
                  <div>
                    <label className="mb-0 block text-sm font-medium">Employé</label>
                    <select
                      value={form.employeeId}
                      onChange={(e) => handleEmployeeSelect(e.target.value)}
                      className="input !py-[6px] !px-[10px]"
                    >
                      <option value="">— Aucun —</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.firstName} {e.lastName}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Sélectionner un employé importe ses informations et pré-remplit le formulaire.
                    </p>
                  </div>
                )}
                {!isEditing && clients.length > 0 && (
                  <div>
                    <label className="mb-0 block text-sm font-medium">Client (espace client)</label>
                    <select
                      value={form.clientId}
                      onChange={(e) => handleClientSelect(e.target.value)}
                      className="input !py-[6px] !px-[10px]"
                    >
                      <option value="">— Aucun (utilisateur cabinet) —</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.raisonSociale}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Sélectionner un client pré-remplit le nom et le prénom, et applique le rôle client.
                    </p>
                  </div>
                )}
                <div>
                  <label className="mb-0 block text-sm font-medium">Prénom</label>
                  <input
                    type="text"
                    value={form.prenom}
                    onChange={(e) => updateField("prenom", e.target.value)}
                    className="input !py-[6px] !px-[10px]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-0 block text-sm font-medium">Nom</label>
                  <input
                    type="text"
                    value={form.nom}
                    onChange={(e) => updateField("nom", e.target.value)}
                    className="input !py-[6px] !px-[10px]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-0 block text-sm font-medium">Titre</label>
                  <input
                    type="text"
                    value={form.titre}
                    onChange={(e) => updateField("titre", e.target.value)}
                    className="input !py-[6px] !px-[10px]"
                    placeholder="Ex. Avocat, Huissier"
                  />
                </div>
                <div>
                  <label className="mb-0 block text-sm font-medium">Spécialité</label>
                  <input
                    type="text"
                    value={form.specialite}
                    onChange={(e) => updateField("specialite", e.target.value)}
                    className="input !py-[6px] !px-[10px]"
                    placeholder="Ex. Droit civil"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-0 block text-sm font-medium">Signature</label>
                  {form.signatureFileName ? (
                    <p className="mb-1 text-xs text-cabinet-700">
                      Fichier sélectionné : {form.signatureFileName}
                    </p>
                  ) : form.signatureKey ? (
                    <p className="mb-1 text-xs text-emerald-700">Signature enregistrée.</p>
                  ) : null}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => handleSignatureFile(e.target.files?.[0])}
                    className="input !py-[6px] !px-[10px]"
                  />
                </div>
                <div>
                  <label className="mb-0 block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    className="input !py-[6px] !px-[10px]"
                    required
                  />
                </div>
                <div>
                  <label className="mb-0 block text-sm font-medium">Rôle</label>
                  <select
                    value={form.roleId}
                    onChange={(e) => updateField("roleId", e.target.value)}
                    className="input !py-[6px] !px-[10px]"
                    required
                  >
                    <option value="">Sélectionner un rôle</option>
                    {roles
                      .filter((r) => r.actif !== false || r.id === form.roleId)
                      .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nom}{r.actif === false ? " (inactif)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {isEditing && (
                  <div className="flex items-center gap-2 md:col-span-2">
                    <input
                      type="checkbox"
                      id="user-actif"
                      checked={form.actif}
                      onChange={(e) => updateField("actif", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-cabinet-700 focus:ring-cabinet-500"
                    />
                    <label htmlFor="user-actif" className="text-sm font-medium">
                      Compte actif
                    </label>
                  </div>
                )}

                <div>
                  <label className="mb-0 block text-sm font-medium">
                    Mot de passe {isEditing && "(laisser vide pour ne pas changer)"}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    className="input !py-[6px] !px-[10px]"
                    required={!isEditing}
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="mb-0 block text-sm font-medium">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => updateField("confirmPassword", e.target.value)}
                    className="input !py-[6px] !px-[10px]"
                    required={!isEditing || Boolean(form.password)}
                  />
                </div>
                </div>
              </div>

              <div className="flex shrink-0 justify-end gap-3 border-t border-gray-200 bg-gray-50 p-4">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? "Enregistrement..." : isEditing ? "Mettre à jour" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
