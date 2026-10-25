"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ContractUploadButton } from "./upload-contract-button";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";

interface EmployeeList {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

interface Employee extends EmployeeList {
  position: string | null;
  department: string | null;
  baseSalary: number;
  hireDate: string;
  contractEndDate: string | null;
  contractType: string;
}

interface Approbateur {
  id: string;
  prenom: string;
  nom: string;
  roleNom: string;
}

interface Contract {
  id: string;
  employee: Employee;
  typeContrat: string;
  dateDebut: string;
  dateFin: string;
  dureeMois: number | null;
  fonction: string | null;
  service: string | null;
  lieuTravail: string | null;
  horaires: string | null;
  salaireBase: number;
  periodeEssaiJours: number | null;
  congesPayesAnnuel: number;
  conventionCollective: string | null;
  clauseConfidentialite: boolean;
  clauseNonConcurrence: boolean;
  objet: string | null;
  documentPath: string | null;
  approbateurId: string | null;
  statut: string;
  createdAt: string;
  updatedAt: string;
}

const TYPE_OPTIONS = ["CDI", "CDD", "Stage", "Prestation", "Alternance", "Interim"];

interface ParametreObligation {
  id: string;
  code: string;
  libelle: string;
  ordre: number;
  actif: boolean;
}

export function ContratsClient({ employees, contracts, approbateurs, canManage, canValidate }: { employees: Employee[]; contracts: Contract[]; approbateurs: Approbateur[]; canManage: boolean; canValidate: boolean }) {
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const router = useRouter();

  const [obligations, setObligations] = useState<Record<string, ParametreObligation[]>>({});
  const [obligationsLoading, setObligationsLoading] = useState(false);

  useEffect(() => {
    async function loadObligations() {
      setObligationsLoading(true);
      try {
        const [empRes, salRes] = await Promise.all([
          fetch("/api/parametres?categorie=contrat_obligation_employer"),
          fetch("/api/parametres?categorie=contrat_obligation_employee"),
        ]);
        const employer = await empRes.json().catch(() => []);
        const employee = await salRes.json().catch(() => []);
        setObligations({
          contrat_obligation_employer: Array.isArray(employer) ? employer : [],
          contrat_obligation_employee: Array.isArray(employee) ? employee : [],
        });
      } finally {
        setObligationsLoading(false);
      }
    }
    loadObligations();
  }, []);

  async function refreshObligations() {
    const [empRes, salRes] = await Promise.all([
      fetch("/api/parametres?categorie=contrat_obligation_employer"),
      fetch("/api/parametres?categorie=contrat_obligation_employee"),
    ]);
    const employer = await empRes.json().catch(() => []);
    const employee = await salRes.json().catch(() => []);
    setObligations({
      contrat_obligation_employer: Array.isArray(employer) ? employer : [],
      contrat_obligation_employee: Array.isArray(employee) ? employee : [],
    });
  }

  async function toggleObligation(id: string, actif: boolean) {
    const res = await fetch(`/api/parametres/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif }) });
    if (res.ok) await refreshObligations();
  }

  async function editObligation(id: string, current: string) {
    const libelle = window.prompt("Modifier l'obligation", current);
    if (!libelle) return;
    const res = await fetch(`/api/parametres/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ libelle: libelle.trim() }) });
    if (res.ok) await refreshObligations();
  }

  async function addObligation(categorie: string) {
    const libelle = window.prompt(categorie.includes("employer") ? "Nouvelle obligation de l'employeur" : "Nouvelle obligation du salarié");
    if (!libelle) return;
    const res = await fetch("/api/parametres", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorie, code: `obligation_${Date.now()}`, libelle: libelle.trim(), ordre: 0, actif: true }),
    });
    if (res.ok) await refreshObligations();
  }

  const employeeFields = (employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return {};
    const type = TYPE_OPTIONS.includes(emp.contractType) ? emp.contractType : "CDI";
    return {
      typeContrat: type,
      dateDebut: emp.hireDate,
      dateFin: type === "CDI" ? "" : (emp.contractEndDate ?? ""),
      fonction: emp.position ?? "",
      service: emp.department ?? "",
      salaireBase: emp.baseSalary.toString(),
    };
  };

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    employeeId: "",
    typeContrat: "",
    dateDebut: "",
    dateFin: "",
    dureeMois: "",
    fonction: "",
    service: "",
    lieuTravail: "Dakar",
    horaires: "40",
    salaireBase: "",
    periodeEssaiJours: "",
    congesPayesAnnuel: "24",
    conventionCollective: "",
    clauseConfidentialite: false,
    clauseNonConcurrence: false,
    objet: "",
    approbateurId: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const [clauses, setClauses] = useState<Record<string, ParametreObligation | null | undefined>>({});

  async function refreshClauses() {
    try {
      const res = await fetch("/api/parametres?categorie=contrats&actif=true");
      const data = await res.json().catch(() => []);
      const list: ParametreObligation[] = Array.isArray(data) ? data : [];
      const next: Record<string, ParametreObligation | null | undefined> = {};
      next.clause_confidentialite = list.find((p) => p.code === "clause_confidentialite") ?? null;
      next.clause_non_concurrence = list.find((p) => p.code === "clause_non_concurrence") ?? null;
      setClauses(next);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refreshClauses();
  }, []);

  useEffect(() => {
    if (!form.dateDebut || !form.dateFin || !["CDD", "Stage"].includes(form.typeContrat)) return;
    const start = new Date(form.dateDebut);
    const end = new Date(form.dateFin);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return;
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) +
      (end.getDate() - start.getDate()) / 30;
    const rounded = Math.round(months * 10) / 10;
    setForm((prev) => ({ ...prev, dureeMois: rounded > 0 ? rounded.toString() : "" }));
  }, [form.dateDebut, form.dateFin, form.typeContrat]);

  function startEdit(c: Contract) {
    setEditingId(c.id);
    setForm({
      employeeId: c.employee.id,
      typeContrat: c.typeContrat,
      dateDebut: c.dateDebut,
      dateFin: c.dateFin,
      dureeMois: c.dureeMois?.toString() ?? "",
      fonction: c.fonction ?? "",
      service: c.service ?? "",
      lieuTravail: c.lieuTravail ?? "",
      horaires: c.horaires ?? "",
      salaireBase: c.salaireBase.toString(),
      periodeEssaiJours: c.periodeEssaiJours?.toString() ?? "",
      congesPayesAnnuel: c.congesPayesAnnuel.toString(),
      conventionCollective: c.conventionCollective ?? "",
      clauseConfidentialite: c.clauseConfidentialite,
      clauseNonConcurrence: c.clauseNonConcurrence,
      objet: c.objet ?? "",
      approbateurId: c.approbateurId ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({
      employeeId: "",
      typeContrat: "",
      dateDebut: "",
      dateFin: "",
      dureeMois: "",
      fonction: "",
      service: "",
      lieuTravail: "Dakar",
      horaires: "40",
      salaireBase: "",
      periodeEssaiJours: "",
      congesPayesAnnuel: "24",
      conventionCollective: "",
      clauseConfidentialite: false,
      clauseNonConcurrence: false,
      objet: "",
      approbateurId: "",
    });
  }

  async function updateStatus(id: string, newStatut: string) {
    const res = await fetch(`/api/personnel/contracts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: newStatut }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Erreur lors du changement de statut.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const url = editingId ? `/api/personnel/contracts/${editingId}` : "/api/personnel/contracts";
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        statut: "brouillon",
        salaireBase: Number(form.salaireBase),
        dureeMois: form.dureeMois ? Number(form.dureeMois) : undefined,
        periodeEssaiJours: form.periodeEssaiJours ? Number(form.periodeEssaiJours) : undefined,
        congesPayesAnnuel: form.congesPayesAnnuel ? Number(form.congesPayesAnnuel) : 0,
        approbateurId: form.approbateurId || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage(editingId ? "Contrat mis à jour." : "Contrat enregistré.");
      setEditingId(null);
      setForm({
        employeeId: "",
        typeContrat: "",
        dateDebut: "",
        dateFin: "",
        dureeMois: "",
        fonction: "",
        service: "",
        lieuTravail: "Dakar",
        horaires: "40",
        salaireBase: "",
        periodeEssaiJours: "",
        congesPayesAnnuel: "24",
        conventionCollective: "",
        clauseConfidentialite: false,
        clauseNonConcurrence: false,
        objet: "",
        approbateurId: "",
      });
      router.refresh();
    } else {
      setMessage(data.error || "Erreur lors de l'enregistrement.");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {message && <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">{message}</div>}

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">{editingId ? "Modifier le contrat" : "Nouveau contrat"}</h2>
        <form onSubmit={handleSubmit} className="grid gap-2 text-xs lg:grid-cols-5">
          <div>
            <label className="mb-0.5 block font-medium">Employé</label>
            <select
              className="input py-1"
              value={form.employeeId}
              onChange={(e) => {
                const employeeId = e.target.value;
                setForm({ ...form, employeeId, ...employeeFields(employeeId) });
              }}
            >
              <option value="">— Sélectionner —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} ({e.employeeCode})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block font-medium">Type de contrat</label>
            <select
              className="input py-1"
              value={form.typeContrat}
              onChange={(e) => {
                const type = e.target.value;
                setForm({
                  ...form,
                  typeContrat: type,
                  dateFin: type === "CDI" ? "" : form.dateFin,
                  dureeMois: type === "CDI" ? "" : form.dureeMois,
                });
              }}
            >
              <option value="">— Sélectionner —</option>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-0.5 block font-medium">Date début</label>
            <input type="date" className="input py-1" required value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} />
          </div>
          <div>
            <label className="mb-0.5 block font-medium">Date fin</label>
            <input
              type="date"
              className="input py-1 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={form.typeContrat === "CDI"}
              value={form.dateFin}
              onChange={(e) => setForm({ ...form, dateFin: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-0.5 block font-medium">Durée (mois)</label>
            <input
              type="number"
              className="input py-1 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={form.typeContrat === "CDI"}
              value={form.dureeMois}
              onChange={(e) => setForm({ ...form, dureeMois: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-0.5 block font-medium">Fonction</label>
            <input type="text" className="input py-1" value={form.fonction} onChange={(e) => setForm({ ...form, fonction: e.target.value })} />
          </div>
          <div>
            <label className="mb-0.5 block font-medium">Service</label>
            <input type="text" className="input py-1" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} />
          </div>
          <div>
            <label className="mb-0.5 block font-medium">Lieu de travail</label>
            <input type="text" className="input py-1" value={form.lieuTravail} onChange={(e) => setForm({ ...form, lieuTravail: e.target.value })} />
          </div>
          <div>
            <label className="mb-0.5 block font-medium">Horaires hebdomadaire</label>
            <input type="text" className="input py-1" placeholder="40h/semaine" value={form.horaires} onChange={(e) => setForm({ ...form, horaires: e.target.value })} />
          </div>
          <div>
            <label className="mb-0.5 block font-medium">Salaire de base (FCFA)</label>
            <input type="number" className="input py-1" required value={form.salaireBase} onChange={(e) => setForm({ ...form, salaireBase: e.target.value })} />
          </div>
          <div>
            <label className="mb-0.5 block font-medium">Période d'essai (jours)</label>
            <input type="number" className="input py-1" value={form.periodeEssaiJours} onChange={(e) => setForm({ ...form, periodeEssaiJours: e.target.value })} />
          </div>
          <div>
            <label className="mb-0.5 block font-medium">Congés payés / an</label>
            <input type="number" className="input py-1" value={form.congesPayesAnnuel} onChange={(e) => setForm({ ...form, congesPayesAnnuel: e.target.value })} />
          </div>
          <div>
            <label className="mb-0.5 block font-medium">Convention collective</label>
            <input type="text" className="input py-1" value={form.conventionCollective} onChange={(e) => setForm({ ...form, conventionCollective: e.target.value })} />
          </div>
          <div>
            <label className="mb-0.5 block font-medium">Approbateur</label>
            <select
              className="input py-1"
              value={form.approbateurId}
              onChange={(e) => setForm({ ...form, approbateurId: e.target.value })}
            >
              <option value="">— Sélectionner —</option>
              {approbateurs.map((a) => (
                <option key={a.id} value={a.id}>{a.prenom} {a.nom} ({a.roleNom})</option>
              ))}
            </select>
          </div>
          {clauses.clause_confidentialite !== null && (
            <div className="flex items-center gap-2 lg:col-start-1">
              <input
                type="checkbox"
                id="confidentialite"
                checked={form.clauseConfidentialite}
                onChange={(e) => setForm({ ...form, clauseConfidentialite: e.target.checked })}
              />
              <label htmlFor="confidentialite" className="font-medium">Clause de confidentialité</label>
            </div>
          )}
          {clauses.clause_non_concurrence !== null && (
            <div className={`flex items-center gap-2${clauses.clause_confidentialite === null ? " lg:col-start-1" : ""}`}>
              <input
                type="checkbox"
                id="nonconcurrence"
                checked={form.clauseNonConcurrence}
                onChange={(e) => setForm({ ...form, clauseNonConcurrence: e.target.checked })}
              />
              <label htmlFor="nonconcurrence" className="font-medium">Clause de non-concurrence</label>
            </div>
          )}
          {((form.clauseConfidentialite && clauses.clause_confidentialite !== null) || (form.clauseNonConcurrence && clauses.clause_non_concurrence !== null)) && (
            <div className="col-span-full grid gap-4 sm:grid-cols-2">
              {form.clauseConfidentialite && clauses.clause_confidentialite !== null && (
                <div>
                  <label className="mb-0.5 block font-medium">Clause de confidentialité</label>
                  <textarea
                    className="input w-full"
                    rows={4}
                    readOnly
                    placeholder="Libellé issu de Paramétrage"
                    value={clauses.clause_confidentialite?.libelle ?? ""}
                  />
                </div>
              )}
              {form.clauseNonConcurrence && clauses.clause_non_concurrence !== null && (
                <div>
                  <label className="mb-0.5 block font-medium">Clause de non-concurrence</label>
                  <textarea
                    className="input w-full"
                    rows={4}
                    readOnly
                    placeholder="Libellé issu de Paramétrage"
                    value={clauses.clause_non_concurrence?.libelle ?? ""}
                  />
                </div>
              )}
            </div>
          )}
          <div className="col-span-full">
            <label className="mb-0.5 block font-medium">Objet / missions</label>
            <textarea
              className="input w-full"
              rows={20}
              placeholder="Saisir les tâches principales (Objectifs) et Indicateurs de performances. Entre 15 et 20 lignes au maximum"
              value={form.objet}
              onChange={(e) => setForm({ ...form, objet: e.target.value })}
            />
          </div>
          <div className="col-span-full flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Enregistrement..." : editingId ? "Mettre à jour" : "Enregistrer le contrat"}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="btn-secondary">
                Annuler
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card p-0">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-lg font-semibold">Article 6 — Obligations des parties</h2>
        </div>
        <div className="grid gap-0 md:grid-cols-2">
          {["contrat_obligation_employer", "contrat_obligation_employee"].map((cat, idx) => (
            <div key={cat} className={`p-4 ${idx === 0 ? "border-r border-gray-100" : ""}`}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium text-cabinet-700">
                  {cat === "contrat_obligation_employer" ? "Obligations de l'employeur" : "Obligations du salarié"}
                </h3>
                {canManage && (
                  <button type="button" onClick={() => addObligation(cat)} className="text-sm font-medium text-cabinet-700 hover:underline">
                    + Ajouter
                  </button>
                )}
              </div>
              <table className="w-full text-left text-sm">
                <tbody>
                  {obligationsLoading ? (
                    <tr><td className="py-2 text-gray-500">Chargement...</td></tr>
                  ) : (obligations[cat] || []).length === 0 ? (
                    <tr><td className="py-2 text-gray-500">Aucune obligation.</td></tr>
                  ) : (
                    <PaginatedRows colSpan={2}>
                    {(obligations[cat] || []).map((o) => (
                      <tr key={o.id} className="border-b hover:bg-gray-50">
                        <td className="py-2">
                          <input
                            type="checkbox"
                            checked={o.actif}
                            onChange={(e) => toggleObligation(o.id, e.target.checked)}
                            disabled={!canManage}
                            className="mr-2 h-4 w-4 rounded border-gray-300 text-cabinet-700"
                          />
                          {o.libelle}
                        </td>
                        <td className="py-2 text-right">
                          {canManage && (
                            <>
                              <button onClick={() => editObligation(o.id, o.libelle)} title="Modifier" className="mr-2 rounded p-1 text-cabinet-700 hover:bg-cabinet-100">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    </PaginatedRows>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Liste des contrats</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                {sortTh("contrats", "employe", "Employé", "px-4 py-3")}
                {sortTh("contrats", "type", "Type", "px-4 py-3")}
                {sortTh("contrats", "periode", "Période", "px-4 py-3")}
                {sortTh("contrats", "fonction", "Fonction", "px-4 py-3")}
                {sortTh("contrats", "salaire", "Salaire de base", "px-4 py-3")}
                {sortTh("contrats", "statut", "Statut", "px-4 py-3")}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">Aucun contrat.</td>
                </tr>
              )}
              <PaginatedRows colSpan={7}>
              {sortRows("contrats", contracts, {
                employe: (c) => `${c.employee.lastName} ${c.employee.firstName}`,
                type: (c) => c.typeContrat,
                periode: (c) => c.dateDebut,
                fonction: (c) => c.fonction,
                salaire: (c) => Number(c.salaireBase || 0),
                statut: (c) => c.statut,
              }).map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{c.employee.firstName} {c.employee.lastName}</td>
                  <td className="px-4 py-3">{c.typeContrat}</td>
                  <td className="px-4 py-3">{c.dateDebut} {c.dateFin ? `→ ${c.dateFin}` : ""}</td>
                  <td className="px-4 py-3">{c.fonction || "—"}</td>
                  <td className="px-4 py-3">{Number(c.salaireBase || 0).toLocaleString("fr-FR")} FCFA</td>
                  <td className="px-4 py-3 capitalize">{c.statut}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canManage && (
                        <>
                          {c.statut === "brouillon" && (
                            <button
                              type="button"
                              onClick={() => startEdit(c)}
                              title="Modifier"
                              className="rounded p-1 text-cabinet-700 hover:bg-cabinet-100"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                          {c.statut === "brouillon" && (
                            <button
                              type="button"
                              onClick={() => canValidate && updateStatus(c.id, "actif")}
                              disabled={!canValidate}
                              title={canValidate ? "Valider" : "Validation réservée"}
                              className="rounded p-1 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            </button>
                          )}
                          {c.statut === "actif" && (
                            <button
                              type="button"
                              onClick={() => canValidate && updateStatus(c.id, "inactif")}
                              disabled={!canValidate}
                              title={canValidate ? "Désactiver" : "Action réservée"}
                              className="rounded p-1 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                          )}
                          {c.statut === "inactif" && (
                            <button
                              type="button"
                              onClick={() => canValidate && updateStatus(c.id, "actif")}
                              disabled={!canValidate}
                              title={canValidate ? "Activer" : "Action réservée"}
                              className="rounded p-1 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" x2="12" y1="2" y2="12" /></svg>
                            </button>
                          )}
                          <ContractUploadButton contractId={c.id} hasDocument={!!c.documentPath} onUploaded={() => router.refresh()} />
                        </>
                      )}
                      <Link href={`/cabinet/personnel/contrats/${c.id}/imprimer`} target="_blank" title="Imprimer" className="rounded p-1 text-cabinet-700 hover:bg-cabinet-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                      </Link>
                      {c.documentPath ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch(`/api/personnel/contracts/${c.id}/download`);
                            const json = await res.json().catch(() => ({}));
                            if (res.ok && json.url) window.open(json.url, "_blank");
                          }}
                          title="Télécharger"
                          className="rounded p-1 text-cabinet-700 hover:bg-cabinet-100"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                        </button>
                      ) : (
                        <span className="rounded p-1 text-gray-300" title="Aucun document">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              </PaginatedRows>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
