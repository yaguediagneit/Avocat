"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TableActions } from "./table-actions";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";
import { DETAIL_LABELS, formatDetailValue, type DetailFormatterContext } from "./detail-formatter";

interface MailItem {
  id: string;
  direction: string;
  mailDate: string;
  reference: string | null;
  structure: string | null;
  contact: string | null;
  subject: string;
  body: string | null;
  status: string;
  dossierId: string | null;
  dossierLabel: string | null;
  signataireId: string | null;
  createdBy: string | null;
}

const STATUSES = [
  { value: "recu", label: "Reçu" },
  { value: "a_traiter", label: "À traiter" },
  { value: "traite", label: "Traité" },
  { value: "envoye", label: "Envoyé" },
  { value: "brouillon", label: "Brouillon" },
  { value: "signe", label: "Signé" },
];

export function CourrierClient() {
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const [items, setItems] = useState<MailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directionFilter, setDirectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tab, setTab] = useState<"entrant" | "sortant" | "lettre">("entrant");
  const router = useRouter();
  const searchParams = useSearchParams();
  const signerParam = searchParams.get("signer");
  const [dossiers, setDossiers] = useState<{ id: string; referenceInterne: string; statut: string; client: { raisonSociale: string } | null }[]>([]);
  const dossierMap = useMemo(() => new Map(dossiers.map((d) => [d.id, d])), [dossiers]);
  const [signataires, setSignataires] = useState<{ id: string; prenom: string; nom: string; email: string; role: { nom: string } }[]>([]);
  const signatairesMap = useMemo(() => new Map(signataires.map((s) => [s.id, s])), [signataires]);
  const [users, setUsers] = useState<{ id: string; prenom: string; nom: string }[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; role?: { estClient?: boolean | null } } | null>(null);
  const formatDossier = (id: string | null) => {
    if (!id) return "—";
    const d = dossierMap.get(id);
    if (!d) return `${id.slice(0, 8)}…`;
    const label = `${d.referenceInterne}${d.client ? ` — ${d.client.raisonSociale}` : ""}`;
    return label.length > 60 ? `…${label.slice(-60)}` : label;
  };
  const [selected, setSelected] = useState<MailItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inactive, setInactive] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    direction: "entrant" as "entrant" | "sortant",
    mailDate: new Date().toISOString().slice(0, 10),
    reference: "",
    structure: "",
    contact: "",
    subject: "",
    body: "",
    status: "recu",
    dossierId: "",
    dossierLabel: "",
    signataireId: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (directionFilter) params.set("direction", directionFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/administration/courrier?${params.toString()}`);
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

    async function loadMe() {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) throw new Error("Erreur utilisateur");
        setCurrentUser(await res.json());
      } catch {
        setCurrentUser(null);
      }
    }

    async function loadSignataires() {
      try {
        const res = await fetch("/api/administration/courrier/signataires");
        if (!res.ok) throw new Error("Erreur signataires");
        setSignataires(await res.json());
      } catch {
        setSignataires([]);
      }
    }

    async function loadDossiers() {
      try {
        const res = await fetch("/api/administration/courrier/dossiers");
        if (!res.ok) throw new Error("Erreur dossiers");
        const data = (await res.json()) as { id: string; referenceInterne: string; statut: string; client: { raisonSociale: string } | null }[];
        setDossiers(data);
      } catch {
        // silencieux
      }
    }

    async function loadUsers() {
      try {
        const res = await fetch("/api/parametres/users");
        if (!res.ok) throw new Error("Erreur utilisateurs");
        const data = (await res.json()) as { id: string; prenom: string; nom: string }[];
        setUsers(data);
      } catch {
        // silencieux
      }
    }

    loadDossiers();
    loadSignataires();
    loadMe();
    loadUsers();
  }, [directionFilter, statusFilter]);

  useEffect(() => {
    const status = tab === "entrant" ? "recu" : tab === "sortant" ? "a_traiter" : "brouillon";
    const direction = tab === "lettre" ? "sortant" : tab;
    setForm((f) => ({ ...f, direction, status }));
  }, [tab]);

  useEffect(() => {
    if (!signerParam || !items.length) return;
    const item = items.find((m) => m.id === signerParam);
    if (item) {
      setTab("lettre");
      edit(item);
    }
  }, [signerParam, items]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const url = editingId
      ? `/api/administration/courrier/${editingId}`
      : "/api/administration/courrier";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        reference: form.reference || null,
        structure: form.structure || null,
        contact: form.contact || null,
        body: form.body || null,
        dossierId: form.dossierId || null,
        signataireId: form.signataireId || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      const fieldError = Object.values(data.error?.fieldErrors ?? {}).flat()[0];
      setError(data.error?.formErrors?.[0] || (typeof fieldError === "string" ? fieldError : null) || `Erreur lors de ${editingId ? "la modification" : "la création"}`);
      return;
    }
    resetForm();
    setEditingId(null);
    load();
  }

  function resetForm() {
    setForm({
      direction: tab === "entrant" ? "entrant" : "sortant",
      mailDate: new Date().toISOString().slice(0, 10),
      reference: "",
      structure: "",
      contact: "",
      subject: "",
      body: "",
      status: tab === "entrant" ? "recu" : tab === "sortant" ? "a_traiter" : "brouillon",
      dossierId: "",
      dossierLabel: "",
      signataireId: "",
    });
  }

  function edit(item: MailItem) {
    setEditingId(item.id);
    setForm({
      direction: item.direction as "entrant" | "sortant",
      mailDate: item.mailDate.slice(0, 10),
      reference: item.reference || "",
      structure: item.structure || "",
      contact: item.contact || "",
      subject: item.subject,
      body: item.body || "",
      status: item.status,
      dossierId: item.dossierId || "",
      dossierLabel: item.dossierLabel || formatDossier(item.dossierId),
      signataireId: item.signataireId || "",
    });
  }

  const isLetter = tab === "lettre";
  const displayItems = items.filter((m) => {
    if (tab === "lettre") return m.direction === "sortant";
    if (tab === "entrant") return m.direction === "entrant";
    if (tab === "sortant") return m.direction === "sortant";
    return true;
  });

  async function printLetter(item: {
    mailDate: string;
    reference: string | null;
    structure: string | null;
    contact: string | null;
    subject: string;
    body: string | null;
    dossierId: string | null;
    dossier: string;
    signataireId: string | null;
  }) {
    try {
      const res = await fetch("/api/administration/courrier/lettre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailDate: item.mailDate,
          reference: item.reference,
          structure: item.structure,
          contact: item.contact,
          subject: item.subject,
          body: item.body,
          dossierId: item.dossierId,
          dossier: formatDossier(item.dossierId),
          signataireId: item.signataireId,
        }),
      });
      if (!res.ok) throw new Error("Erreur lors de la génération");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'impression de la lettre");
    }
  }

  function imprimerLettre() {
    printLetter({
      mailDate: form.mailDate,
      reference: form.reference,
      structure: form.structure,
      contact: form.contact,
      subject: form.subject,
      body: form.body,
      dossierId: form.dossierId,
      dossier: formatDossier(form.dossierId),
      signataireId: form.signataireId,
    });
  }

  async function signerEtImprimer() {
    if (!editingId) return;
    try {
      const res = await fetch(`/api/administration/courrier/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "signe" }),
      });
      if (!res.ok) throw new Error("Erreur lors du marquage signé");
      setForm((f) => ({ ...f, status: "signe" }));
      imprimerLettre();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la signature");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-200">
        {(["entrant", "sortant", "lettre"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-b-2 border-gold-500 text-gold-700" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "lettre" ? "Rédiger une lettre" : t}
          </button>
        ))}
      </div>

      <form onSubmit={save} className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-2">
        <div
          className="grid gap-4 sm:col-span-2"
          style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium">Date</label>
            <input
              type="date"
              className="input w-full"
              value={form.mailDate}
              onChange={(e) => setForm({ ...form, mailDate: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Référence</label>
            <input
              className="input w-full bg-gray-100"
              value={form.reference || "Généré automatiquement"}
              disabled
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Structure</label>
            <input
              className="input w-full"
              value={form.structure}
              onChange={(e) => setForm({ ...form, structure: e.target.value })}
              placeholder={form.direction === "entrant" ? "Expéditeur" : "Destinataire"}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Contact</label>
            <input
              className="input w-full"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />
          </div>
        </div>
        <div
          className="grid gap-4 sm:col-span-2"
          style={{ gridTemplateColumns: isLetter ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr" }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium">Sujet</label>
            <input
              className="input w-full"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder={isLetter ? "Objet de la lettre" : ""}
              required
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
            <label className="mb-1 block text-sm font-medium">Dossier</label>
            <select
              className="input w-full"
              value={form.dossierId}
              onChange={(e) =>
                setForm({
                  ...form,
                  dossierId: e.target.value,
                  dossierLabel: formatDossier(e.target.value || null),
                })
              }
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
          {isLetter && (
            <div>
              <label className="mb-1 block text-sm font-medium">Signataire</label>
              <select
                className="input w-full"
                value={form.signataireId}
                onChange={(e) => setForm({ ...form, signataireId: e.target.value })}
                required
              >
                <option value="">— Sélectionner —</option>
                {signataires.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.prenom} {s.nom} — {s.role?.nom} ({s.email})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium">{isLetter ? "Corps de la lettre" : "Notes / Contenu"}</label>
          <textarea
            className="input w-full"
            rows={isLetter ? 10 : 3}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder={isLetter ? "Madame..., Monsieur le .... ou Cher...\n.....................................................................................................\ntout le message de la lettre\n.....................................................................................................\nSalutations" : ""}
          />
        </div>
        <div className="sm:col-span-2 flex justify-end gap-3">
          {editingId && (
            <button
              type="button"
              onClick={() => { resetForm(); setEditingId(null); }}
              className="btn-secondary"
            >
              Annuler
            </button>
          )}
          {isLetter && editingId && currentUser?.id === form.signataireId && (
            <button
              type="button"
              onClick={signerEtImprimer}
              className="btn-primary"
              disabled={!form.body.trim()}
            >
              Je signe
            </button>
          )}
          <button type="submit" className="btn-primary">
            {editingId ? "Modifier" : isLetter ? "Enregistrer la lettre" : "Enregistrer"}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Direction :</label>
        <select className="input" value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)}>
          <option value="">Toutes</option>
          <option value="entrant">Entrant</option>
          <option value="sortant">Sortant</option>
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

      <div className="overflow-x-auto rounded-lg border bg-white p-0">
        <table className="table-fixed w-full text-[10px]">
          <thead className="bg-cabinet-100 text-cabinet-900">
            <tr>
              {sortTh("courrier", "date", "Date", "w-14 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("courrier", "dir", "Dir.", "w-14 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("courrier", "reference", "Référence", "w-20 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("courrier", "structure", "Structure", "w-24 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("courrier", "contact", "Contact", "w-24 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("courrier", "sujet", "Sujet", "w-28 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("courrier", "statut", "Statut", "w-14 px-1 py-1 text-left whitespace-nowrap")}
              {sortTh("courrier", "dossier", "Dossier", "w-64 px-1 py-1 text-left whitespace-nowrap")}
              <th className="w-16 px-1 py-1 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-1 py-3 text-center text-gray-500">Chargement...</td></tr>}
            {!loading && displayItems.length === 0 && <tr><td colSpan={9} className="px-1 py-3 text-center text-gray-500">Aucun courrier.</td></tr>}
            <PaginatedRows colSpan={9}>
            {sortRows("courrier", displayItems, {
              date: (m) => m.mailDate,
              dir: (m) => m.direction,
              reference: (m) => m.reference,
              structure: (m) => m.structure,
              contact: (m) => m.contact,
              sujet: (m) => m.subject,
              statut: (m) => STATUSES.find((s) => s.value === m.status)?.label || m.status,
              dossier: (m) => m.dossierLabel || formatDossier(m.dossierId),
            }).map((m) => (
              <tr key={m.id} className={`border-t ${inactive.has(m.id) ? "opacity-50" : ""}`}>
                <td className="px-1 py-1 whitespace-nowrap">{new Date(m.mailDate).toLocaleDateString("fr-FR")}</td>
                <td className="px-1 py-1 whitespace-nowrap capitalize">{m.direction}</td>
                <td className="px-1 py-1 truncate" title={m.reference || undefined}>{m.reference || "—"}</td>
                <td className="px-1 py-1 truncate" title={m.structure || undefined}>{m.structure || "—"}</td>
                <td className="px-1 py-1 truncate" title={m.contact || undefined}>{m.contact || "—"}</td>
                <td className="px-1 py-1 truncate" title={m.subject}>{m.subject}</td>
                <td className="px-1 py-1 whitespace-nowrap">{STATUSES.find((s) => s.value === m.status)?.label || m.status}</td>
                <td className="px-1 py-1 truncate" title={m.dossierLabel || formatDossier(m.dossierId)}>{m.dossierLabel || formatDossier(m.dossierId)}</td>
                <td className="px-1 py-1 text-right">
                  <TableActions
                    isActive={!inactive.has(m.id)}
                    onView={() => setSelected(m)}
                    onPrint={
                      (currentUser?.id === m.signataireId ||
                        (m.status === "signe" && !currentUser?.role?.estClient))
                        ? () => printLetter({ ...m, dossier: m.dossierLabel || formatDossier(m.dossierId) })
                        : undefined
                    }
                    onEdit={m.status === "brouillon" ? () => edit(m) : undefined}
                    onToggle={() => setInactive((prev) => {
                      const next = new Set(prev);
                      if (next.has(m.id)) next.delete(m.id);
                      else next.add(m.id);
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
              <h3 className="text-lg font-bold text-cabinet-900">{selected.subject}</h3>
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
