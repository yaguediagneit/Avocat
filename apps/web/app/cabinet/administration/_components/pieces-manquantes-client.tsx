"use client";

import { useEffect, useMemo, useState } from "react";
import { TableActions } from "./table-actions";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";
import { DETAIL_LABELS, formatDetailValue, type DetailFormatterContext } from "./detail-formatter";

interface MissingDoc {
  id: string;
  dossierId: string;
  typeDocument: string;
  description: string | null;
  status: string;
  relanceDate: string | null;
  notes: string | null;
  createdAt: string;
}

interface Dossier {
  id: string;
  referenceInterne: string;
  statut: string;
  client: { raisonSociale: string; telephone: string } | null;
}

interface User {
  id: string;
  prenom: string;
  nom: string;
}

interface ExpectedDocType {
  id: string;
  code: string;
  libelle: string;
  description: string | null;
  obligatoire: boolean;
}

const STATUSES = [
  { value: "manquant", label: "Manquant" },
  { value: "relance", label: "Relance envoyée" },
  { value: "reçu", label: "Reçu" },
  { value: "annule", label: "Annulé" },
];

export function PiecesManquantesClient() {
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const [items, setItems] = useState<MissingDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [expectedTypes, setExpectedTypes] = useState<ExpectedDocType[]>([]);
  const dossierMap = useMemo(() => new Map(dossiers.map((d) => [d.id, d])), [dossiers]);
  const formatDossier = (id: string | null) => {
    if (!id) return "—";
    const d = dossierMap.get(id);
    if (!d) return `${id.slice(0, 8)}…`;
    const label = `${d.referenceInterne}${d.client ? ` — ${d.client.raisonSociale}` : ""}`;
    return label.length > 60 ? `…${label.slice(-60)}` : label;
  };
  const [selected, setSelected] = useState<MissingDoc | null>(null);
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});

  const isActive = (id: string) => activeMap[id] !== false;
  const [form, setForm] = useState({
    dossierId: "",
    selectedTypes: [] as string[],
    description: "",
    status: "manquant",
    relanceDate: "",
    notes: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const url = filter ? `/api/administration/pieces-manquantes?status=${filter}` : "/api/administration/pieces-manquantes";
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
  }, [filter]);

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

  useEffect(() => {
    setExpectedTypes([]);
    setForm((f) => ({ ...f, selectedTypes: [] }));
    if (!form.dossierId) return;
    fetch(`/api/administration/pieces-manquantes/types?dossierId=${encodeURIComponent(form.dossierId)}`)
      .then(async (res) => (res.ok ? res.json() : []))
      .then((data: ExpectedDocType[]) => setExpectedTypes(data))
      .catch(() => setExpectedTypes([]));
  }, [form.dossierId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (form.selectedTypes.length === 0) {
      setError("Veuillez cocher au moins un type de pièce.");
      return;
    }
    const res = await fetch("/api/administration/pieces-manquantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dossierId: form.dossierId,
        types: form.selectedTypes,
        relanceDate: form.relanceDate || null,
        description: form.description || null,
        status: form.status,
        notes: form.notes || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.formErrors?.[0] || "Erreur lors de la création");
      return;
    }
    setForm({ dossierId: "", selectedTypes: [], description: "", status: "manquant", relanceDate: "", notes: "" });
    load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-[6fr_1fr_7fr]">
        <div>
          <label className="mb-1 block text-sm font-medium">Dossier</label>
          <select
            className="input w-full"
            value={form.dossierId}
            onChange={(e) => setForm({ ...form, dossierId: e.target.value })}
            required
          >
            <option value="">Sélectionner</option>
            {dossiers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.referenceInterne} {d.client ? `— ${d.client.raisonSociale}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Types de pièce attendus</label>
          <div className="input w-full max-h-40 overflow-y-auto rounded border bg-white p-2 space-y-1">
            {expectedTypes.length === 0 && <div className="text-sm text-gray-500">Aucune pièce attendue.</div>}
            {expectedTypes.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.selectedTypes.includes(t.libelle)}
                  onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      selectedTypes: e.target.checked
                        ? [...f.selectedTypes, t.libelle]
                        : f.selectedTypes.filter((x) => x !== t.libelle),
                    }));
                  }}
                />
                <span>{t.libelle}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="hidden sm:block" />
        <div>
          <label className="mb-1 block text-sm font-medium">Statut</label>
          <select
            className="input !w-[62.5%]"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Date de relance</label>
          <input
            type="date"
            className="input w-full"
            value={form.relanceDate}
            onChange={(e) => setForm({ ...form, relanceDate: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <input
            className="input w-full"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="sm:col-span-3">
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            className="input w-full"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="sm:col-span-3 flex justify-end">
          <button type="submit" className="btn-primary">Enregistrer</button>
        </div>
      </form>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Filtre statut :</label>
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
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
              {sortTh("pieces", "dossier", "Dossier", "w-64 px-1 py-1 text-left")}
              {sortTh("pieces", "client", "Client", "w-24 px-1 py-1 text-left")}
              {sortTh("pieces", "tel", "Tél.", "w-20 px-1 py-1 text-left")}
              {sortTh("pieces", "piece", "Pièce", "w-24 px-1 py-1 text-left")}
              {sortTh("pieces", "description", "Description", "w-24 px-1 py-1 text-left")}
              {sortTh("pieces", "statut", "Statut", "w-14 px-1 py-1 text-left")}
              {sortTh("pieces", "relance", "Relance", "w-14 px-1 py-1 text-left")}
              {sortTh("pieces", "cree", "Créé le", "w-16 px-1 py-1 text-left")}
              <th className="w-16 px-1 py-1 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-1 py-3 text-center text-gray-500">Chargement...</td></tr>}
            {!loading && items.length === 0 && <tr><td colSpan={9} className="px-1 py-3 text-center text-gray-500">Aucune pièce manquante.</td></tr>}
            <PaginatedRows colSpan={9}>
            {sortRows("pieces", items, {
              dossier: (d) => formatDossier(d.dossierId),
              client: (d) => dossierMap.get(d.dossierId)?.client?.raisonSociale,
              tel: (d) => dossierMap.get(d.dossierId)?.client?.telephone,
              piece: (d) => d.typeDocument,
              description: (d) => d.description,
              statut: (d) => STATUSES.find((s) => s.value === d.status)?.label || d.status,
              relance: (d) => d.relanceDate ? new Date(d.relanceDate).toLocaleDateString("fr-FR") : "—",
              cree: (d) => new Date(d.createdAt).toLocaleDateString("fr-FR"),
            }).map((d) => {
              const dossier = dossierMap.get(d.dossierId);
              return (
                <tr key={d.id} className={`border-t ${isActive(d.id) ? "" : "opacity-50"}`}>
                  <td className="px-1 py-1 truncate" title={formatDossier(d.dossierId)}>
                    {formatDossier(d.dossierId)}
                  </td>
                  <td className="px-1 py-1 truncate" title={dossier?.client?.raisonSociale || undefined}>
                    {dossier?.client?.raisonSociale || "—"}
                  </td>
                  <td className="px-1 py-1 truncate">{dossier?.client?.telephone || "—"}</td>
                  <td className="px-1 py-1 truncate" title={d.typeDocument}>{d.typeDocument}</td>
                  <td className="px-1 py-1 truncate" title={d.description || undefined}>{d.description || "—"}</td>
                  <td className="px-1 py-1 whitespace-nowrap">{STATUSES.find((s) => s.value === d.status)?.label || d.status}</td>
                  <td className="px-1 py-1 whitespace-nowrap">{d.relanceDate ? new Date(d.relanceDate).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-1 py-1 whitespace-nowrap">{new Date(d.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td className="px-1 py-1 text-right">
                    <TableActions
                      isActive={isActive(d.id)}
                      onView={() => setSelected(d)}
                      onPrint={() => window.print()}
                      onToggle={() => setActiveMap((map) => ({ ...map, [d.id]: !isActive(d.id) }))}
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
