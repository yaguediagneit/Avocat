"use client";

import { useEffect, useMemo, useState } from "react";
import { TableActions } from "./table-actions";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";
import { DETAIL_LABELS, formatDetailValue, type DetailFormatterContext } from "./detail-formatter";

interface Hearing {
  id: string;
  type: string;
  title: string;
  date: string;
  location: string | null;
  dossierId: string | null;
  attendees: string | null;
  notes: string | null;
  status: string;
}

interface DossierOption {
  id: string;
  referenceInterne: string;
  statut: string;
  client: { raisonSociale: string } | null;
}

interface Participant {
  id: string;
  prenom: string;
  nom: string;
  role: string;
  roleNom: string;
}

interface User {
  id: string;
  prenom: string;
  nom: string;
}

const STATUSES = [
  { value: "planifie", label: "Planifié" },
  { value: "termine", label: "Terminé" },
  { value: "annule", label: "Annulé" },
];

function toUtcIso(local: string): string {
  const [date, time] = local.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

export function AudiencesClient() {
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const [items, setItems] = useState<Hearing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [dossiers, setDossiers] = useState<DossierOption[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const dossierMap = useMemo(() => new Map(dossiers.map((d) => [d.id, d])), [dossiers]);
  const formatDossier = (id: string | null) => {
    if (!id) return "—";
    const d = dossierMap.get(id);
    if (!d) return `${id.slice(0, 8)}…`;
    const label = `${d.referenceInterne}${d.client ? ` — ${d.client.raisonSociale}` : ""}`;
    return label.length > 60 ? `…${label.slice(-60)}` : label;
  };
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selected, setSelected] = useState<Hearing | null>(null);
  const [inactive, setInactive] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    type: "audience",
    title: "",
    date: "",
    location: "",
    dossierId: "",
    attendees: "",
    notes: "",
    status: "planifie",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const url = filter ? `/api/administration/audiences?type=${filter}` : "/api/administration/audiences";
      const res = await fetch(url);
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

    async function loadDossiers() {
      try {
        const res = await fetch("/api/dossiers");
        if (!res.ok) throw new Error("Erreur dossiers");
        const data = (await res.json()) as DossierOption[];
        setDossiers(data.filter((d) => d.statut !== "Clôturé" && d.statut !== "Archivé"));
      } catch {
        // silencieux
      }
    }

    async function loadUsers() {
      try {
        const res = await fetch("/api/parametres/users");
        if (!res.ok) throw new Error("Erreur utilisateurs");
        const data = (await res.json()) as User[];
        setUsers(data);
      } catch {
        // silencieux
      }
    }

    loadDossiers();
    loadUsers();
  }, [filter]);

  useEffect(() => {
    async function loadParticipants() {
      if (!form.dossierId) {
        setParticipants([]);
        setForm((prev) => ({ ...prev, attendees: "" }));
        return;
      }

      try {
        const res = await fetch(`/api/administration/audiences/participants?dossierId=${form.dossierId}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as Participant[];
        setParticipants(data);
      } catch {
        setParticipants([]);
      }
    }

    loadParticipants();
  }, [form.dossierId]);

  const locations = useMemo(
    () => Array.from(new Set(items.map((i) => i.location).filter((l): l is string => Boolean(l)))),
    [items]
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/administration/audiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        date: toUtcIso(form.date),
        location: form.location || null,
        dossierId: form.dossierId || null,
        attendees: form.attendees || null,
        notes: form.notes || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      const formErrors = data.error?.formErrors || [];
      const fieldErrors = data.error?.fieldErrors || {};
      const msg =
        formErrors[0] ||
        Object.values(fieldErrors).flat()[0] ||
        "Erreur lors de la création";
      setError(msg);
      return;
    }
    setForm({
      type: "audience",
      title: "",
      date: "",
      location: "",
      dossierId: "",
      attendees: "",
      notes: "",
      status: "planifie",
    });
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <div
          className="grid gap-4 sm:col-span-2"
          style={{ gridTemplateColumns: "1fr 50% 1fr 1fr" }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <select
              className="input w-full"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="audience">Audience</option>
              <option value="reunion">Réunion</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Titre</label>
            <input
              className="input w-full"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Date et heure</label>
            <input
              type="datetime-local"
              className="input w-full"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Lieu</label>
            <input
              list="audience-locations"
              className="input w-full"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <datalist id="audience-locations">
              {locations.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Dossier</label>
          <select
            className="input w-full"
            value={form.dossierId}
            onChange={(e) => setForm({ ...form, dossierId: e.target.value })}
          >
            <option value="">— Aucun —</option>
            {dossiers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.referenceInterne}
                {d.client ? ` · ${d.client.raisonSociale}` : ""}
              </option>
            ))}
          </select>
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
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">Participants</label>
          {form.dossierId ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {participants.map((p) => {
                const label = [p.prenom, p.nom].filter(Boolean).join(" ");
                const checked = form.attendees.split(", ").filter(Boolean).includes(label);
                return (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      onChange={(e) => {
                        const current = form.attendees.split(", ").filter(Boolean);
                        const next = e.target.checked
                          ? [...current, label]
                          : current.filter((x) => x !== label);
                        setForm({ ...form, attendees: next.join(", ") });
                      }}
                    />
                    <span>
                      {label}
                      {p.role ? ` — ${p.role}` : ""}
                      {p.roleNom ? ` (${p.roleNom})` : ""}
                    </span>
                  </label>
                );
              })}
              {participants.length === 0 && (
                <span className="text-sm text-gray-500">Aucun participant disponible.</span>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-500">Sélectionnez un dossier pour voir les participants.</span>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            className="input w-full"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" className="btn-primary">Enregistrer</button>
        </div>
      </form>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Filtre type :</label>
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Tous</option>
          <option value="audience">Audience</option>
          <option value="reunion">Réunion</option>
        </select>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-lg border bg-white p-0">
        <table className="table-fixed w-full text-[10px]">
          <thead className="bg-cabinet-100 text-cabinet-900">
            <tr>
              {sortTh("audiences", "date", "Date", "w-24 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("audiences", "type", "Type", "w-12 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("audiences", "titre", "Titre", "w-32 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("audiences", "lieu", "Lieu", "w-28 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("audiences", "participants", "Participants", "w-32 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("audiences", "dossier", "Dossier", "w-64 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("audiences", "statut", "Statut", "w-14 px-1 py-1 text-left whitespace-nowrap")}
              <th className="w-16 px-1 py-1 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-1 py-3 text-center text-gray-500">Chargement...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={8} className="px-1 py-3 text-center text-gray-500">Aucun événement.</td></tr>}
            <PaginatedRows colSpan={8}>
            {sortRows("audiences", items, {
              date: (h) => h.date,
              type: (h) => h.type,
              titre: (h) => h.title,
              lieu: (h) => h.location,
              participants: (h) => h.attendees,
              dossier: (h) => formatDossier(h.dossierId),
              statut: (h) => STATUSES.find((s) => s.value === h.status)?.label || h.status,
            }).map((h) => (
              <tr key={h.id} className={`border-t ${inactive.has(h.id) ? "opacity-50" : ""}`}>
                <td className="px-1 py-1 whitespace-nowrap">{new Date(h.date).toLocaleString("fr-FR")}</td>
                <td className="px-1 py-1 whitespace-nowrap capitalize">{h.type}</td>
                <td className="px-1 py-1 truncate" title={h.title}>{h.title}</td>
                <td className="px-1 py-1 truncate" title={h.location || undefined}>{h.location || "—"}</td>
                <td className="px-1 py-1 truncate" title={h.attendees || undefined}>{h.attendees || "—"}</td>
                <td className="px-1 py-1 truncate" title={formatDossier(h.dossierId)}>{formatDossier(h.dossierId)}</td>
                <td className="px-1 py-1 whitespace-nowrap">{STATUSES.find((s) => s.value === h.status)?.label || h.status}</td>
                <td className="px-1 py-1 text-right">
                  <TableActions
                    isActive={!inactive.has(h.id)}
                    onView={() => setSelected(h)}
                    onPrint={() => window.print()}
                    onToggle={() => setInactive((prev) => {
                      const next = new Set(prev);
                      if (next.has(h.id)) next.delete(h.id);
                      else next.add(h.id);
                      return next;
                    })}
                  />
                </td>
              </tr>
            ))}
            </PaginatedRows>
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-bold text-cabinet-900">{selected.title}</h3>
              <button
                onClick={() => setSelected(null)}
                className="text-2xl text-gray-500 hover:text-gray-700"
                aria-label="Fermer"
              >
                &times;
              </button>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
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
        </div>
      )}
    </div>
  );
}
