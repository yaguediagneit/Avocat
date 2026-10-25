"use client";

import { useEffect, useMemo, useState } from "react";
import { TableActions } from "./table-actions";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";
import { DETAIL_LABELS, formatDetailValue, type DetailFormatterContext } from "./detail-formatter";

interface Formality {
  id: string;
  title: string;
  type: string;
  entity: string;
  status: string;
  dueDate: string | null;
  completedDate: string | null;
  dossierId: string | null;
  notes: string | null;
}

interface Dossier {
  id: string;
  referenceInterne: string;
  statut: string;
  client: { raisonSociale: string } | null;
}

interface User {
  id: string;
  prenom: string;
  nom: string;
}

const STATUSES = [
  { value: "en_cours", label: "En cours" },
  { value: "soumis", label: "Soumis" },
  { value: "finalise", label: "Finalisé" },
  { value: "rejete", label: "Rejeté" },
];

export function FormalitesClient() {
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const [items, setItems] = useState<Formality[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const dossierMap = useMemo(() => new Map(dossiers.map((d) => [d.id, d])), [dossiers]);
  const formatDossier = (id: string | null) => {
    if (!id) return "—";
    const d = dossierMap.get(id);
    if (!d) return `${id.slice(0, 8)}…`;
    const label = `${d.referenceInterne}${d.client ? ` — ${d.client.raisonSociale}` : ""}`;
    return label.length > 60 ? `…${label.slice(-60)}` : label;
  };
  const [selected, setSelected] = useState<Formality | null>(null);
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});

  const isActive = (id: string) => activeMap[id] !== false;
  const entityOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.entity).filter((e): e is string => !!e))),
    [items]
  );
  const titleOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.title).filter((t): t is string => !!t))),
    [items]
  );

  const [form, setForm] = useState({
    title: "",
    type: "tribunal",
    entity: "",
    status: "en_cours",
    dueDate: "",
    completedDate: "",
    dossierId: "",
    notes: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/administration/formalites?${params.toString()}`);
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
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    Promise.all([
      fetch("/api/dossiers").then((res) => res.json()),
      fetch("/api/parametres/users").then((res) => res.json()),
    ])
      .then(([dossiersData, usersData]: [Dossier[], User[]]) => {
        setDossiers(dossiersData.filter((d) => !d.statut.toLowerCase().includes("clôtur")));
        setUsers(usersData);
      })
      .catch(() => {
        setDossiers([]);
        setUsers([]);
      });
  }, []);

  useEffect(() => {
    if (!form.dossierId) return;
    fetch(`/api/administration/taches?dossierId=${encodeURIComponent(form.dossierId)}`)
      .then(async (res) => (res.ok ? res.json() : []))
      .then((data: { titre: string; description: string | null }[]) => {
        const list = data.map((t) => `- ${t.titre}${t.description ? ` : ${t.description}` : ""}`).join("\n");
        setForm((f) => ({ ...f, notes: list }));
      })
      .catch(() => {});
  }, [form.dossierId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/administration/formalites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        completedDate: form.completedDate ? new Date(form.completedDate).toISOString() : null,
        dossierId: form.dossierId || null,
        notes: form.notes || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.formErrors?.[0] || "Erreur lors de la création");
      return;
    }
    setForm({
      title: "",
      type: "tribunal",
      entity: "",
      status: "en_cours",
      dueDate: "",
      completedDate: "",
      dossierId: "",
      notes: "",
    });
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Titre</label>
          <input
            list="title-options"
            className="input w-full"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <datalist id="title-options">
            {titleOptions.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Type</label>
          <select
            className="input w-full"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="tribunal">Tribunal</option>
            <option value="administration">Administration</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Entité</label>
          <input
            list="entity-options"
            className="input w-full"
            value={form.entity}
            onChange={(e) => setForm({ ...form, entity: e.target.value })}
            required
          />
          <datalist id="entity-options">
            {entityOptions.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
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
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            className="input w-full"
            rows={8}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="sm:col-span-4 flex justify-end">
          <button type="submit" className="btn-primary">Enregistrer</button>
        </div>
      </form>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Type :</label>
        <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tous</option>
          <option value="tribunal">Tribunal</option>
          <option value="administration">Administration</option>
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
              {sortTh("formalites", "type", "Type", "w-12 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("formalites", "entite", "Entité", "w-28 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("formalites", "titre", "Titre", "w-32 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("formalites", "ech", "Éch.", "w-14 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("formalites", "cloture", "Clôture", "w-14 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("formalites", "statut", "Statut", "w-14 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("formalites", "dossier", "Dossier", "w-64 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("formalites", "description", "Description", "w-28 px-1 py-1 text-left whitespace-nowrap")}
              <th className="w-16 px-1 py-1 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-1 py-3 text-center text-gray-500">Chargement...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={9} className="px-1 py-3 text-center text-gray-500">Aucune formalité.</td></tr>}
            <PaginatedRows colSpan={9}>
            {sortRows("formalites", items, {
              type: (f) => f.type === "tribunal" ? "Tribunal" : f.type === "administration" ? "Administration" : f.type,
              entite: (f) => f.entity,
              titre: (f) => f.title,
              ech: (f) => f.dueDate ? new Date(f.dueDate).toLocaleDateString("fr-FR") : "—",
              cloture: (f) => f.completedDate ? new Date(f.completedDate).toLocaleDateString("fr-FR") : "—",
              statut: (f) => STATUSES.find((s) => s.value === f.status)?.label || f.status,
              dossier: (f) => formatDossier(f.dossierId),
              description: (f) => f.notes,
            }).map((f) => {
              const dos = dossiers.find((d) => d.id === f.dossierId);
              return (
                <tr key={f.id} className={`border-t ${isActive(f.id) ? "" : "opacity-50"}`}>
                  <td className="px-1 py-1 whitespace-nowrap">{f.type === "tribunal" ? "Tribunal" : f.type === "administration" ? "Administration" : f.type}</td>
                  <td className="px-1 py-1 truncate" title={f.entity || undefined}>{f.entity}</td>
                  <td className="px-1 py-1 truncate" title={f.title}>{f.title}</td>
                  <td className="px-1 py-1 whitespace-nowrap">{f.dueDate ? new Date(f.dueDate).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-1 py-1 whitespace-nowrap">{f.completedDate ? new Date(f.completedDate).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-1 py-1 whitespace-nowrap">{STATUSES.find((s) => s.value === f.status)?.label || f.status}</td>
                  <td className="px-1 py-1 truncate" title={formatDossier(f.dossierId)}>
                    {formatDossier(f.dossierId)}
                  </td>
                  <td className="px-1 py-1 truncate" title={f.notes || undefined}>{f.notes || "—"}</td>
                  <td className="px-1 py-1 text-right">
                    <TableActions
                      isActive={isActive(f.id)}
                      onView={() => setSelected(f)}
                      onPrint={() => window.print()}
                      onToggle={() => setActiveMap((map) => ({ ...map, [f.id]: !isActive(f.id) }))}
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
