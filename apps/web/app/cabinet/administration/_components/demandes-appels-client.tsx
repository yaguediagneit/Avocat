"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TableActions } from "./table-actions";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";
import { DETAIL_LABELS, formatDetailValue, type DetailFormatterContext } from "./detail-formatter";

interface ClientRequest {
  id: string;
  type: string;
  subject: string;
  description: string | null;
  status: string;
  clientId: string | null;
  requesterName: string | null;
  requesterPhone: string | null;
  requesterEmail: string | null;
  requestDate: string | null;
  responseStatus: string | null;
  responseDate: string | null;
  responseDetail: string | null;
  createdAt: string;
}

interface CallLog {
  id: string;
  direction: string;
  callDate: string;
  endDate: string | null;
  channel: string;
  contactName: string | null;
  structure: string | null;
  subject: string | null;
  notes: string | null;
  clientId: string | null;
  employeeId: string | null;
  createdAt: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface Client {
  id: string;
  raisonSociale: string;
}

interface User {
  id: string;
  prenom: string;
  nom: string;
}

interface TypeDocumentOption {
  id: string;
  code: string;
  libelle: string;
  description: string | null;
  obligatoire: boolean;
}

interface SpecialiteOption {
  id: string;
  code: string;
  libelle: string;
  typesDocuments?: TypeDocumentOption[];
}

const REQUEST_TYPES = [
  { value: "info", label: "Information" },
  { value: "dossier", label: "Dossier" },
  { value: "rendezvous", label: "Rendez-vous" },
  { value: "document", label: "Document" },
  { value: "autre", label: "Autre" },
];

const CALL_CHANNELS = [
  { value: "telephone", label: "Téléphone" },
  { value: "visioconference", label: "Visioconférence" },
  { value: "autre", label: "Autre" },
];

export function DemandesAppelsClient() {
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const [tab, setTab] = useState<"demandes" | "appels">("demandes");
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requestForm, setRequestForm] = useState({
    type: "info",
    subject: "",
    description: "",
    clientId: "",
    requesterName: "",
    requesterPhone: "",
    requesterEmail: "",
    requestDate: new Date().toISOString().slice(0, 10),
    responseStatus: "en_attente",
    responseDate: "",
    responseDetail: "",
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [specialites, setSpecialites] = useState<SpecialiteOption[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ClientRequest | null>(null);
  const [activeRequests, setActiveRequests] = useState<Record<string, boolean>>({});
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [activeCalls, setActiveCalls] = useState<Record<string, boolean>>({});
  const [docSearch, setDocSearch] = useState("");
  const [docTypeId, setDocTypeId] = useState<string | null>(null);

  const filteredSpecialites = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return specialites;
    return specialites.filter(
      (s) => s.libelle.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  }, [specialites, docSearch]);

  const selectedDocType = useMemo(
    () => specialites.find((s) => s.id === docTypeId) || null,
    [specialites, docTypeId]
  );

  const isActive = (id: string, map: Record<string, boolean>) => map[id] !== false;
  const [callForm, setCallForm] = useState({
    direction: "entrant",
    callDate: "",
    endDate: "",
    channel: "telephone",
    contactName: "",
    structure: "",
    subject: "",
    notes: "",
    clientId: "",
    employeeId: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, callRes, empRes, cliRes, usrRes] = await Promise.all([
        fetch("/api/administration/demandes"),
        fetch("/api/administration/appels"),
        fetch("/api/personnel/employees"),
        fetch("/api/clients"),
        fetch("/api/parametres/users"),
      ]);
      if (!reqRes.ok) throw new Error("Erreur lors du chargement des demandes");
      if (!callRes.ok) throw new Error("Erreur lors du chargement des appels");
      if (!empRes.ok) throw new Error("Erreur lors du chargement des employés");
      if (!cliRes.ok) throw new Error("Erreur lors du chargement des clients");
      if (!usrRes.ok) throw new Error("Erreur lors du chargement des utilisateurs");
      setRequests(await reqRes.json());
      setCalls(await callRes.json());
      setEmployees(await empRes.json());
      setClients(await cliRes.json());
      setUsers(await usrRes.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    fetch("/api/specialites?selectionnee=true")
      .then(async (res) => {
        const data = res.ok ? ((await res.json()) as SpecialiteOption[]) : [];
        if (data.length > 0) return data;
        const all = await fetch("/api/specialites");
        return all.ok ? ((await all.json()) as SpecialiteOption[]) : [];
      })
      .then(setSpecialites)
      .catch(() => setSpecialites([]));
  }, []);

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/administration/demandes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: requestForm.type,
        subject: requestForm.subject,
        description: requestForm.description || undefined,
        clientId: requestForm.clientId || null,
        requesterName: requestForm.requesterName,
        requesterPhone: requestForm.requesterPhone,
        requesterEmail: requestForm.requesterEmail,
        requestDate: requestForm.requestDate,
        responseStatus: requestForm.responseStatus,
        responseDate: requestForm.responseDate || null,
        responseDetail: requestForm.responseDetail || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      const msg =
        data.error?.formErrors?.[0] ||
        Object.values(data.error?.fieldErrors || {}).flat().filter(Boolean)[0] ||
        data.error ||
        "Erreur lors de la création";
      setError(msg);
      return;
    }
    setRequestForm({
      type: "info",
      subject: "",
      description: "",
      clientId: "",
      requesterName: "",
      requesterPhone: "",
      requesterEmail: "",
      requestDate: new Date().toISOString().slice(0, 10),
      responseStatus: "en_attente",
      responseDate: "",
      responseDetail: "",
    });
    load();
  }

  async function createCall(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/administration/appels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...callForm,
        endDate: callForm.endDate ? new Date(callForm.endDate).toISOString().slice(0, 16) : null,
        callDate: new Date(callForm.callDate).toISOString().slice(0, 16),
        clientId: callForm.clientId || null,
        employeeId: callForm.employeeId || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      const msg =
        data.error?.formErrors?.[0] ||
        Object.values(data.error?.fieldErrors || {}).flat().filter(Boolean)[0] ||
        data.error ||
        "Erreur lors de la création";
      setError(msg);
      return;
    }
    setCallForm({
      direction: "entrant",
      callDate: "",
      endDate: "",
      channel: "telephone",
      contactName: "",
      structure: "",
      subject: "",
      notes: "",
      clientId: "",
      employeeId: "",
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-200">
        {(["demandes", "appels"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t
                ? "border-b-2 border-gold-500 text-gold-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {tab === "demandes" ? (
        <div className="space-y-6">
          <form onSubmit={createRequest} className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-[7fr_19fr_7fr_7fr]">
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select
                className="input w-full"
                value={requestForm.type}
                onChange={(e) => setRequestForm({ ...requestForm, type: e.target.value })}
              >
                {REQUEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Sujet</label>
              <input
                className="input w-full"
                value={requestForm.subject}
                onChange={(e) => setRequestForm({ ...requestForm, subject: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Demandeur</label>
              <input
                className="input w-full"
                value={requestForm.requesterName}
                onChange={(e) => setRequestForm({ ...requestForm, requesterName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Téléphone</label>
              <input
                className="input w-full"
                type="tel"
                value={requestForm.requesterPhone}
                onChange={(e) => setRequestForm({ ...requestForm, requesterPhone: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Réponse</label>
              <select
                className="input w-full"
                value={requestForm.responseStatus}
                onChange={(e) => setRequestForm({ ...requestForm, responseStatus: e.target.value })}
              >
                <option value="en_attente">En attente</option>
                <option value="repondu">Réponse donnée</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email demandeur</label>
              <input
                className="input w-full"
                type="email"
                value={requestForm.requesterEmail}
                onChange={(e) => setRequestForm({ ...requestForm, requesterEmail: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Date demande</label>
              <input
                type="date"
                className="input w-full"
                value={requestForm.requestDate}
                onChange={(e) => setRequestForm({ ...requestForm, requestDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Date réponse</label>
              <input
                type="date"
                className="input w-full"
                value={requestForm.responseDate}
                onChange={(e) => setRequestForm({ ...requestForm, responseDate: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Spécialité</label>
              <select
                className="input w-full"
                value={requestForm.description}
                onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
              >
                <option value="">—</option>
                {specialites.map((s) => (
                  <option key={s.id} value={s.libelle}>{s.libelle}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-4">
              <label className="mb-1 block text-sm font-medium">Détail Réponse</label>
              <textarea
                className="input w-full"
                rows={3}
                value={requestForm.responseDetail}
                onChange={(e) => setRequestForm({ ...requestForm, responseDetail: e.target.value })}
              />
            </div>
            <div className="sm:col-span-4 flex justify-end">
              <button type="submit" className="btn-primary">Enregistrer la demande</button>
            </div>
          </form>

          {selectedRequest && (
            <div className="rounded-lg border bg-cabinet-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Détail</h3>
                <button onClick={() => setSelectedRequest(null)} className="text-sm text-cabinet-700 hover:underline" type="button">Fermer</button>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                {Object.entries(selectedRequest).map(([k, v]) => (
                  <div key={k} className="truncate">
                    <span className="font-medium">{DETAIL_LABELS[k] || k}:</span>{" "}
                    {formatDetailValue(k, v, { employees, clients, users })}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border bg-white p-0">
            <table className="table-fixed w-full text-[10px]">
              <thead className="bg-cabinet-100 text-cabinet-900">
                <tr>
                  {sortTh("requests", "date", "Date", "w-14 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("requests", "type", "Type", "w-12 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("requests", "sujet", "Sujet", "w-24 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("requests", "demandeur", "Demand.", "w-20 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("requests", "tel", "Tél.", "w-20 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("requests", "email", "Email", "w-24 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("requests", "client", "Client", "w-32 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("requests", "rep", "Rép.", "w-12 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("requests", "dateRep", "Date rép.", "w-14 px-1 py-1 text-left whitespace-nowrap")}
                  <th className="w-16 px-1 py-1 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={10} className="px-1 py-3 text-center text-gray-500">Chargement...</td></tr>}
                {!loading && requests.length === 0 && <tr><td colSpan={10} className="px-1 py-3 text-center text-gray-500">Aucune demande.</td></tr>}
                <PaginatedRows colSpan={10}>
                {sortRows("requests", requests, {
                  date: (r) => r.requestDate,
                  type: (r) => REQUEST_TYPES.find((t) => t.value === r.type)?.label || r.type,
                  sujet: (r) => r.subject,
                  demandeur: (r) => r.requesterName,
                  tel: (r) => r.requesterPhone,
                  email: (r) => r.requesterEmail,
                  client: (r) => {
                    const c = clients.find((x) => x.id === r.clientId);
                    return c ? c.raisonSociale : null;
                  },
                  rep: (r) => (r.responseStatus === "repondu" ? "Réponse donnée" : "En attente"),
                  dateRep: (r) => r.responseDate,
                }).map((r) => (
                  <tr key={r.id} className={`border-t ${isActive(r.id, activeRequests) ? "" : "opacity-50"}`}>
                    <td className="px-1 py-1 whitespace-nowrap">{r.requestDate ? new Date(r.requestDate).toLocaleDateString("fr-FR") : "—"}</td>
                    <td className="px-1 py-1 whitespace-nowrap">{REQUEST_TYPES.find((t) => t.value === r.type)?.label || r.type}</td>
                    <td className="px-1 py-1 truncate" title={r.subject}>{r.subject}</td>
                    <td className="px-1 py-1 truncate" title={r.requesterName || undefined}>{r.requesterName}</td>
                    <td className="px-1 py-1 truncate" title={r.requesterPhone || undefined}>{r.requesterPhone}</td>
                    <td className="px-1 py-1 truncate" title={r.requesterEmail || undefined}>{r.requesterEmail || "—"}</td>
                    <td className="px-1 py-1 truncate" title={clients.find((c) => c.id === r.clientId)?.raisonSociale || undefined}>
                      {clients.find((c) => c.id === r.clientId)?.raisonSociale || "—"}
                    </td>
                    <td className="px-1 py-1 whitespace-nowrap">{r.responseStatus === "repondu" ? "Réponse donnée" : "En attente"}</td>
                    <td className="px-1 py-1 whitespace-nowrap">{r.responseDate ? new Date(r.responseDate).toLocaleDateString("fr-FR") : "—"}</td>
                    <td className="px-1 py-1 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/cabinet/dossiers/demarches/nouveau?objet=${encodeURIComponent(r.subject)}&demandeurNom=${encodeURIComponent(r.requesterName || "")}&demandeurTel=${encodeURIComponent(r.requesterPhone || "")}&demandeurEmail=${encodeURIComponent(r.requesterEmail || "")}&clientId=${r.clientId || ""}&origine=${encodeURIComponent(`Demande client du ${r.requestDate ? new Date(r.requestDate).toLocaleDateString("fr-FR") : new Date(r.createdAt).toLocaleDateString("fr-FR")} : ${r.subject}`)}`}
                          className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-100 whitespace-nowrap"
                          title="Convertir en démarche administrative"
                        >
                          → Démarche
                        </Link>
                        <TableActions
                          isActive={isActive(r.id, activeRequests)}
                          onView={() => setSelectedRequest(r)}
                          onPrint={() => window.print()}
                          onToggle={() => setActiveRequests((map) => ({ ...map, [r.id]: !isActive(r.id, map) }))}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                </PaginatedRows>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <form onSubmit={createCall} className="grid gap-4 rounded-lg border bg-white p-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Direction</label>
              <select
                className="input w-full"
                value={callForm.direction}
                onChange={(e) => setCallForm({ ...callForm, direction: e.target.value })}
              >
                <option value="entrant">Entrant</option>
                <option value="sortant">Sortant</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Date et heure début</label>
              <input
                type="datetime-local"
                className="input w-full"
                value={callForm.callDate}
                onChange={(e) => setCallForm({ ...callForm, callDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Date et heure de fin</label>
              <input
                type="datetime-local"
                className="input w-full"
                value={callForm.endDate}
                onChange={(e) => setCallForm({ ...callForm, endDate: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Canal</label>
              <select
                className="input w-full"
                value={callForm.channel}
                onChange={(e) => setCallForm({ ...callForm, channel: e.target.value })}
              >
                {CALL_CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Contact</label>
              <input
                className="input w-full"
                value={callForm.contactName}
                onChange={(e) => setCallForm({ ...callForm, contactName: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Structure</label>
              <input
                className="input w-full"
                value={callForm.structure}
                onChange={(e) => setCallForm({ ...callForm, structure: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Sujet</label>
              <input
                className="input w-full"
                value={callForm.subject}
                onChange={(e) => setCallForm({ ...callForm, subject: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Interlocuteur interne</label>
              <select
                className="input w-full"
                value={callForm.employeeId}
                onChange={(e) => setCallForm({ ...callForm, employeeId: e.target.value })}
              >
                <option value="">Sélectionner un employé</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea
                className="input w-full"
                rows={3}
                value={callForm.notes}
                onChange={(e) => setCallForm({ ...callForm, notes: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" className="btn-primary">Enregistrer l&apos;appel</button>
            </div>
          </form>

          {selectedCall && (
            <div className="rounded-lg border bg-cabinet-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Détail</h3>
                <button onClick={() => setSelectedCall(null)} className="text-sm text-cabinet-700 hover:underline" type="button">Fermer</button>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                {Object.entries(selectedCall).map(([k, v]) => (
                  <div key={k} className="truncate">
                    <span className="font-medium">{DETAIL_LABELS[k] || k}:</span>{" "}
                    {formatDetailValue(k, v, { employees, clients, users })}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border bg-white p-0">
            <table className="table-fixed w-full text-[10px]">
              <thead className="bg-cabinet-100 text-cabinet-900">
                <tr>
                  {sortTh("calls", "debut", "Début", "w-20 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("calls", "fin", "Fin", "w-20 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("calls", "dir", "Dir.", "w-12 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("calls", "canal", "Canal", "w-14 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("calls", "contact", "Contact", "w-24 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("calls", "structure", "Structure", "w-24 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("calls", "sujet", "Sujet", "w-24 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("calls", "client", "Client", "w-24 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("calls", "interloc", "Interloc.", "w-24 px-1 py-1 text-left whitespace-nowrap")}
                  <th className="w-16 px-1 py-1 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={10} className="px-1 py-3 text-center text-gray-500">Chargement...</td></tr>}
                {!loading && calls.length === 0 && <tr><td colSpan={10} className="px-1 py-3 text-center text-gray-500">Aucun appel.</td></tr>}
                <PaginatedRows colSpan={10}>
                {sortRows("calls", calls, {
                  debut: (c) => c.callDate,
                  fin: (c) => c.endDate,
                  dir: (c) => c.direction,
                  canal: (c) => CALL_CHANNELS.find((ch) => ch.value === c.channel)?.label || c.channel,
                  contact: (c) => c.contactName,
                  structure: (c) => c.structure,
                  sujet: (c) => c.subject,
                  client: (c) => {
                    const cli = clients.find((x) => x.id === c.clientId);
                    return cli ? cli.raisonSociale : null;
                  },
                  interloc: (c) => {
                    const e = employees.find((x) => x.id === c.employeeId);
                    return e ? `${e.firstName} ${e.lastName}` : null;
                  },
                }).map((c) => {
                  const emp = employees.find((e) => e.id === c.employeeId);
                  return (
                    <tr key={c.id} className={`border-t ${isActive(c.id, activeCalls) ? "" : "opacity-50"}`}>
                      <td className="px-1 py-1 whitespace-nowrap">{new Date(c.callDate).toLocaleString("fr-FR")}</td>
                      <td className="px-1 py-1 whitespace-nowrap">{c.endDate ? new Date(c.endDate).toLocaleString("fr-FR") : "—"}</td>
                      <td className="px-1 py-1 capitalize whitespace-nowrap">
                        {c.direction === "entrant" ? "Entrant" : c.direction === "sortant" ? "Sortant" : c.direction}
                      </td>
                      <td className="px-1 py-1 whitespace-nowrap">{CALL_CHANNELS.find((ch) => ch.value === c.channel)?.label || c.channel}</td>
                      <td className="px-1 py-1 truncate" title={c.contactName || undefined}>{c.contactName || "—"}</td>
                      <td className="px-1 py-1 truncate" title={c.structure || undefined}>{c.structure || "—"}</td>
                      <td className="px-1 py-1 truncate" title={c.subject || undefined}>{c.subject || "—"}</td>
                      <td className="px-1 py-1 truncate" title={clients.find((cli) => cli.id === c.clientId)?.raisonSociale || undefined}>
                    {clients.find((cli) => cli.id === c.clientId)?.raisonSociale || "—"}
                  </td>
                      <td className="px-1 py-1 truncate" title={emp ? `${emp.firstName} ${emp.lastName}` : undefined}>{emp ? `${emp.firstName} ${emp.lastName}` : "—"}</td>
                      <td className="px-1 py-1 text-right">
                        <TableActions
                          isActive={isActive(c.id, activeCalls)}
                          onView={() => setSelectedCall(c)}
                          onPrint={() => window.print()}
                          onToggle={() => setActiveCalls((map) => ({ ...map, [c.id]: !isActive(c.id, map) }))}
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
      )}

      <div className="space-y-4 rounded-lg border bg-white p-4">
        <h3 className="text-sm font-semibold text-cabinet-900">
          Documents requis par type de dossier
        </h3>
        <input
          className="input w-full"
          placeholder="Rechercher un type de dossier..."
          value={docSearch}
          onChange={(e) => setDocSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {filteredSpecialites.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setDocTypeId(s.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                docTypeId === s.id
                  ? "border-gold-500 bg-gold-50 font-medium text-gold-700"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              {s.libelle}
            </button>
          ))}
          {filteredSpecialites.length === 0 && (
            <span className="text-sm text-gray-500">Aucun type de dossier trouvé.</span>
          )}
        </div>

        {selectedDocType && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="table-fixed w-full text-[10px]">
              <thead className="bg-cabinet-100 text-cabinet-900">
                <tr>
                  {sortTh("docTypes", "document", "Document requis", "w-40 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("docTypes", "code", "Code", "w-24 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("docTypes", "description", "Description", "w-48 px-1 py-1 text-left whitespace-nowrap")}
                  {sortTh("docTypes", "statut", "Statut", "w-16 px-1 py-1 text-left whitespace-nowrap")}
                </tr>
              </thead>
              <tbody>
                <PaginatedRows colSpan={4}>
                {sortRows("docTypes", [...(selectedDocType.typesDocuments || [])].sort((a, b) => Number(b.obligatoire) - Number(a.obligatoire)), {
                  document: (t) => t.libelle,
                  code: (t) => t.code,
                  description: (t) => t.description,
                  statut: (t) => (t.obligatoire ? "Obligatoire" : "Optionnel"),
                })
                  .map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="px-1 py-1 truncate" title={t.libelle}>{t.libelle}</td>
                      <td className="px-1 py-1 truncate" title={t.code}>{t.code}</td>
                      <td className="px-1 py-1 truncate" title={t.description || undefined}>
                        {t.description || "—"}
                      </td>
                      <td className="px-1 py-1 whitespace-nowrap">
                        {t.obligatoire ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
                            Obligatoire
                          </span>
                        ) : (
                          <span className="text-gray-400">Optionnel</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </PaginatedRows>
                {(selectedDocType.typesDocuments || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-1 py-3 text-center text-gray-500">
                      Aucun document requis pour ce type de dossier.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
