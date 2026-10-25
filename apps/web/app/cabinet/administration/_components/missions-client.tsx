"use client";

import { useEffect, useMemo, useState } from "react";
import { TableActions } from "./table-actions";
import { MissionProfessionForm } from "./mission-profession-form";
import { getMissionFormDefaults, type MissionFormData } from "@/lib/mission-form";
import { resolveMissionTemplateKey } from "@/lib/mission-templates";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";
import { DETAIL_LABELS, formatDetailValue, type DetailFormatterContext } from "./detail-formatter";

interface Mission {
  id: string;
  profession: string;
  providerName: string;
  reference: string | null;
  description: string | null;
  status: string;
  amount: number | null;
  dueDate: string | null;
  completedDate: string | null;
  dossierId: string | null;
  notes: string | null;
}

interface ProviderUser {
  id: string;
  prenom: string;
  nom: string;
}

interface Dossier {
  id: string;
  referenceInterne: string;
  statut: string;
  client: { raisonSociale: string } | null;
}

interface RoleOption {
  id: string;
  nom: string;
}

interface User {
  id: string;
  prenom: string;
  nom: string;
}

const STATUSES = [
  { value: "a_faire", label: "À faire" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminé" },
  { value: "facture", label: "Facturé" },
  { value: "paye", label: "Payé" },
];

const PROFESSIONS = [
  { value: "huissier", label: "Huissier" },
  { value: "avocat", label: "Avocat" },
  { value: "expert", label: "Expert" },
  { value: "architecte", label: "Architecte" },
  { value: "conseiller", label: "Conseiller juridique" },
  { value: "clerc", label: "Clerc" },
  { value: "autre", label: "Autre" },
];

export function MissionsClient() {
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const [items, setItems] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profFilter, setProfFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({
    profession: "huissier",
    providerName: "",
    description: "",
    status: "a_faire",
    amount: "",
    dueDate: "",
    completedDate: "",
    dossierId: "",
  });
  const [formData, setFormData] = useState<MissionFormData>(() => getMissionFormDefaults("huissier"));
  const [providers, setProviders] = useState<ProviderUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const dossierMap = useMemo(() => new Map(dossiers.map((d) => [d.id, d])), [dossiers]);
  const formatDossier = (id: string | null) => {
    if (!id) return "—";
    const d = dossierMap.get(id);
    if (!d) return `${id.slice(0, 8)}…`;
    const label = `${d.referenceInterne}${d.client ? ` — ${d.client.raisonSociale}` : ""}`;
    return label.length > 60 ? `…${label.slice(-60)}` : label;
  };
  const [selected, setSelected] = useState<Mission | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});

  const isActive = (id: string) => activeMap[id] !== false;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (profFilter) params.set("profession", profFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/administration/missions?${params.toString()}`);
      if (!res.ok) throw new Error("Erreur lors du chargement");
      setItems(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [profFilter, statusFilter]);

  useEffect(() => {
    Promise.all([
      fetch("/api/dossiers").then((res) => res.json()),
      fetch("/api/parametres/users").then((res) => res.json()),
    ])
      .then(([dossiersData, usersData]: [Dossier[], User[]]) => {
        setDossiers(dossiersData);
        setUsers(usersData);
      })
      .catch(() => {
        setDossiers([]);
        setUsers([]);
      });
  }, []);

  // Mêmes rôles que « Nouvel utilisateur » / « Modifier un utilisateur »
  useEffect(() => {
    fetch("/api/parametres/roles")
      .then(async (res) => (res.ok ? res.json() : []))
      .then((data: RoleOption[]) => setRoles(data || []))
      .catch(() => setRoles([]));
  }, []);

  // Options « Profession » : les rôles du cabinet + les professions
  // historiques non couvertes par un rôle (« autre » toujours disponible).
  const professionOptions = useMemo(() => {
    const coveredKeys = new Set(roles.map((r) => resolveMissionTemplateKey(r.nom)));
    const options: { value: string; label: string }[] = roles.map((r) => ({
      value: r.nom,
      label: r.nom,
    }));
    for (const p of PROFESSIONS) {
      const key = resolveMissionTemplateKey(p.value);
      if (key !== "autre" && coveredKeys.has(key)) continue;
      if (!options.some((o) => o.value === p.value)) options.push(p);
    }
    // En édition, la valeur stockée peut ne pas être dans la liste.
    if (form.profession && !options.some((o) => o.value === form.profession)) {
      const legacy = PROFESSIONS.find((p) => p.value === form.profession);
      options.unshift({ value: form.profession, label: legacy?.label || form.profession });
    }
    return options;
  }, [roles, form.profession]);

  const professionLabel = (value: string) =>
    professionOptions.find((o) => o.value === value)?.label ||
    PROFESSIONS.find((p) => p.value === value)?.label ||
    PROFESSIONS.find((p) => p.value === resolveMissionTemplateKey(value))?.label ||
    value;

  useEffect(() => {
    if (!form.dossierId || !form.profession) return;
    fetch(`/api/administration/missions/tache?dossierId=${encodeURIComponent(form.dossierId)}&profession=${encodeURIComponent(form.profession)}`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((titre: string | null) => {
        if (titre) setForm((f) => ({ ...f, description: titre }));
      })
      .catch(() => {});
  }, [form.dossierId, form.profession]);

  useEffect(() => {
    setProviders([]);
    if (!editingId) {
      setForm((f) => ({ ...f, providerName: "" }));
      setFormData(getMissionFormDefaults(form.profession));
    }
    if (!form.profession) return;
    fetch(`/api/intervenants?role=${encodeURIComponent(form.profession)}`)
      .then(async (res) => {
        if (!res.ok) return [];
        return res.json() as Promise<ProviderUser[]>;
      })
      .then(setProviders)
      .catch(() => setProviders([]));
  }, [form.profession, editingId]);

  function onEdit(m: Mission) {
    setEditingId(m.id);
    setForm({
      profession: m.profession,
      providerName: m.providerName,
      description: m.description || "",
      status: m.status,
      amount: m.amount != null ? String(m.amount) : "",
      dueDate: m.dueDate ? new Date(m.dueDate).toISOString().slice(0, 10) : "",
      completedDate: m.completedDate ? new Date(m.completedDate).toISOString().slice(0, 10) : "",
      dossierId: m.dossierId || "",
    });
    try {
      setFormData(m.notes ? (JSON.parse(m.notes) as MissionFormData) : getMissionFormDefaults(m.profession));
    } catch {
      setFormData(getMissionFormDefaults(m.profession));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      amount: form.amount ? parseInt(form.amount, 10) : null,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      completedDate: form.completedDate ? new Date(form.completedDate).toISOString() : null,
      description: form.description || null,
      dossierId: form.dossierId || null,
      notes: JSON.stringify(formData),
    };
    const res = editingId
      ? await fetch(`/api/administration/missions/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/administration/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.formErrors?.[0] || "Erreur lors de l'enregistrement");
      return;
    }
    setForm({
      profession: "huissier",
      providerName: "",
      description: "",
      status: "a_faire",
      amount: "",
      dueDate: "",
      completedDate: "",
      dossierId: "",
    });
    setFormData(getMissionFormDefaults("huissier"));
    setEditingId(null);
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Profession</label>
          <select
            className="input w-full"
            value={form.profession}
            onChange={(e) => setForm({ ...form, profession: e.target.value })}
          >
            {professionOptions.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Prestataire</label>
          <select
            className="input w-full"
            value={form.providerName}
            onChange={(e) => setForm({ ...form, providerName: e.target.value })}
            required
          >
            <option value="">{providers.length === 0 ? "Aucun employé" : "Sélectionner"}</option>
            {providers.map((p) => (
              <option key={p.id} value={`${p.prenom} ${p.nom}`}>
                {p.prenom} {p.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Montant</label>
          <input
            type="number"
            step="1"
            className="input w-full"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Statut</label>
          <select
            className="input w-full"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Échéance</label>
          <input
            type="date"
            className="input w-full"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Date de clôture</label>
          <input
            type="date"
            className="input w-full"
            value={form.completedDate}
            onChange={(e) => setForm({ ...form, completedDate: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Dossier</label>
          <select
            className="input w-full"
            value={form.dossierId}
            onChange={(e) => setForm({ ...form, dossierId: e.target.value })}
          >
            <option value="">—</option>
            {dossiers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.referenceInterne} {d.client ? `— ${d.client.raisonSociale}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-5">
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            className="input w-full"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="sm:col-span-5">
          <label className="mb-1 block text-sm font-medium">Détails de l’ordre de mission par profession</label>
          <MissionProfessionForm profession={form.profession} data={formData} onChange={setFormData} />
        </div>
        <div className="sm:col-span-5 flex justify-end">
          <button type="submit" className="btn-primary">{editingId ? "Mettre à jour" : "Enregistrer l'ordre"}</button>
        </div>
      </form>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Profession :</label>
        <select className="input" value={profFilter} onChange={(e) => setProfFilter(e.target.value)}>
          <option value="">Toutes</option>
          {professionOptions.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <label className="text-sm font-medium">Statut :</label>
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tous</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {selected && (
        <div className="rounded-lg border bg-cabinet-50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Détail</h3>
            <button onClick={() => setSelected(null)} className="text-sm text-cabinet-700 hover:underline" type="button">Fermer</button>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            {Object.entries(selected).map(([k, v]) => (
              <div key={k} className="truncate">
                <span className="font-medium">{DETAIL_LABELS[k] || k}:</span>{" "}
                {formatDetailValue(k, v, {
                  dossiers: dossiers.map((d) => ({ id: d.id, referenceInterne: d.referenceInterne })),
                  users,
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-white p-0">
        <table className="table-fixed w-full text-[10px]">
          <thead className="bg-cabinet-100 text-cabinet-900">
            <tr>
              {sortTh("missions", "prof", "Prof.", "w-16 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("missions", "prest", "Prest.", "w-24 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("missions", "ref", "Réf.", "w-20 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("missions", "description", "Description", "w-28 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("missions", "montant", "Montant", "w-16 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("missions", "ech", "Éch.", "w-14 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("missions", "cloture", "Clôture", "w-14 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("missions", "statut", "Statut", "w-14 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("missions", "dossier", "Dossier", "w-32 px-1 py-1 text-left whitespace-nowrap")}
              <th className="w-28 px-1 py-1 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="px-1 py-3 text-center text-gray-500">Chargement...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={10} className="px-1 py-3 text-center text-gray-500">Aucune mission.</td></tr>}
            <PaginatedRows colSpan={10}>
            {sortRows("missions", items, {
              prof: (m) => professionLabel(m.profession),
              prest: (m) => m.providerName,
              ref: (m) => m.reference,
              description: (m) => m.description,
              montant: (m) => m.amount ? m.amount.toLocaleString("fr-FR") : "—",
              ech: (m) => m.dueDate ? new Date(m.dueDate).toLocaleDateString("fr-FR") : "—",
              cloture: (m) => m.completedDate ? new Date(m.completedDate).toLocaleDateString("fr-FR") : "—",
              statut: (m) => STATUSES.find((s) => s.value === m.status)?.label || m.status,
              dossier: (m) => formatDossier(m.dossierId),
            }).map((m) => {
              const dos = dossiers.find((d) => d.id === m.dossierId);
              return (
                <tr key={m.id} className={`border-t ${isActive(m.id) ? "" : "opacity-50"}`}>
                  <td className="px-1 py-1 whitespace-nowrap">{professionLabel(m.profession)}</td>
                  <td className="px-1 py-1 truncate" title={m.providerName}>{m.providerName}</td>
                  <td className="px-1 py-1 truncate" title={m.reference || undefined}>{m.reference || "—"}</td>
                  <td className="px-1 py-1 truncate" title={m.description || undefined}>{m.description || "—"}</td>
                  <td className="px-1 py-1 whitespace-nowrap">{m.amount ? m.amount.toLocaleString("fr-FR") : "—"}</td>
                  <td className="px-1 py-1 whitespace-nowrap">{m.dueDate ? new Date(m.dueDate).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-1 py-1 whitespace-nowrap">{m.completedDate ? new Date(m.completedDate).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-1 py-1 whitespace-nowrap">{STATUSES.find((s) => s.value === m.status)?.label || m.status}</td>
                  <td className="px-1 py-1 truncate" title={formatDossier(m.dossierId)}>
                    {formatDossier(m.dossierId)}
                  </td>
                  <td className="px-1 py-1 text-right">
                    <TableActions
                      isActive={isActive(m.id)}
                      onView={() => setSelected(m)}
                      onPrint={() => window.open(`/api/administration/missions/${encodeURIComponent(m.id)}/pdf`, "_blank")}
                      onToggle={() => setActiveMap((map) => ({ ...map, [m.id]: !isActive(m.id) }))}
                      onEdit={() => onEdit(m)}
                    />
                  </td>
                </tr>
              );
            })}
            </PaginatedRows>
          </tbody>
        </table>
      </div>
    </div>
  );
}
