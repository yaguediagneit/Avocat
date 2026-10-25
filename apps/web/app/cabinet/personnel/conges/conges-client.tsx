"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";

type Employee = { id: string; employeeCode: string; firstName: string; lastName: string; email: string | null };
type LeaveType = { id: string; code: string; libelle: string; deduitSoldeConge: boolean };
type LeaveRequest = {
  id: string;
  employee: Employee;
  leaveType: LeaveType;
  dateDebut: string;
  dateFin: string;
  submittedAt: string;
  approverId: string;
  createdBy: string;
  nombreJours: number;
  motif: string | null;
  statut: string;
  commentaireValidation: string | null;
  balance: { acquis: number; consommes: number; reserves: number; restants: number };
};
type Approver = { id: string; prenom: string; nom: string };

function formatISODateFr(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}-${m}-${y}`;
}

function statutBadge(statut: string) {
  const map: Record<string, { label: string; className: string }> = {
    approuvee: { label: "Approuvée", className: "bg-emerald-100 text-emerald-700" },
    rejetee: { label: "Rejetée", className: "bg-red-100 text-red-700" },
    annulee: { label: "Annulée", className: "bg-gray-100 text-gray-700" },
    soumise: { label: "Soumise", className: "bg-amber-100 text-amber-700" },
    brouillon: { label: "Brouillon", className: "bg-slate-100 text-slate-700" },
    en_correction: { label: "En correction", className: "bg-orange-100 text-orange-700" },
    terminee: { label: "Terminée", className: "bg-blue-100 text-blue-700" },
  };
  const s = map[statut] ?? { label: statut, className: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

export function CongesClient({
  employees,
  leaveTypes,
  requests,
  approvers,
  currentUserId,
  currentUserEmail,
  isAdmin,
}: {
  employees: Employee[];
  leaveTypes: LeaveType[];
  requests: LeaveRequest[];
  approvers: Approver[];
  currentUserId: string;
  currentUserEmail: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    employeeId: employees[0]?.id ?? "",
    leaveTypeId: leaveTypes.find((t) => t.deduitSoldeConge)?.id ?? leaveTypes[0]?.id ?? "",
    dateDebut: "",
    dateFin: "",
    submittedAt: today,
    approverId: "",
    motif: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [requestComments, setRequestComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editing, setEditing] = useState<LeaveRequest | null>(null);
  const [editForm, setEditForm] = useState({
    id: "",
    leaveTypeId: "",
    dateDebut: "",
    dateFin: "",
    approverId: "",
    motif: "",
  });

  async function loadComments(id: string) {
    const res = await fetch(`/api/personnel/leave-requests/${id}/comments`);
    const data = await res.json().catch(() => []);
    setRequestComments(Array.isArray(data) ? data : []);
    setOpenComments(id);
    setNewComment("");
  }

  async function addComment(id: string) {
    if (!newComment.trim()) return;
    const res = await fetch(`/api/personnel/leave-requests/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newComment }),
    });
    if (res.ok) {
      setNewComment("");
      loadComments(id);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/personnel/leave-requests/${editForm.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage("Demande modifiée.");
      setEditing(null);
      router.refresh();
    } else {
      setMessage(data.error || "Erreur lors de la modification.");
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/personnel/leave-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage("Demande soumise.");
      setForm({ ...form, dateDebut: "", dateFin: "", motif: "" });
      router.refresh();
    } else {
      setMessage(data.error || "Erreur lors de la soumission.");
    }
    setLoading(false);
  }

  async function updateStatus(id: string, statut: string, commentaire = "") {
    const res = await fetch(`/api/personnel/leave-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut, commentaire }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || "Erreur de validation.");
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">{message}</div>
      )}

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Nouvelle demande</h2>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Employé</label>
            <select
              className="input"
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} ({e.employeeCode})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Type d&apos;absence</label>
            <select
              className="input"
              value={form.leaveTypeId}
              onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
            >
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.libelle}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Date début</label>
            <input
              type="date"
              className="input"
              required
              value={form.dateDebut}
              onChange={(e) => setForm({ ...form, dateDebut: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Date fin</label>
            <input
              type="date"
              className="input"
              required
              value={form.dateFin}
              onChange={(e) => setForm({ ...form, dateFin: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Date de soumission</label>
            <input
              type="date"
              className="input"
              required
              value={form.submittedAt}
              onChange={(e) => setForm({ ...form, submittedAt: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Approbateur</label>
            <select
              className="input"
              required
              value={form.approverId}
              onChange={(e) => setForm({ ...form, approverId: e.target.value })}
            >
              <option value="">— Sélectionner —</option>
              {approvers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.prenom} {a.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="mb-1 block text-sm font-medium">Motif</label>
            <input
              type="text"
              className="input"
              value={form.motif}
              onChange={(e) => setForm({ ...form, motif: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Envoi..." : "Soumettre la demande"}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">Demandes et soldes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                {sortTh("conges", "employe", "Employé", "px-4 py-3")}
                {sortTh("conges", "type", "Type", "px-4 py-3")}
                {sortTh("conges", "periode", "Période", "px-4 py-3")}
                {sortTh("conges", "jours", "Jours", "px-4 py-3 text-right")}
                {sortTh("conges", "statut", "Statut", "px-4 py-3")}
                {sortTh("conges", "solde", "Solde (acquis / cons. / rés. / rest.)", "px-4 py-3")}
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Aucune demande.
                  </td>
                </tr>
              )}
              <PaginatedRows colSpan={7}>
              {sortRows("conges", requests, {
                employe: (r) => `${r.employee.lastName} ${r.employee.firstName}`,
                type: (r) => r.leaveType.libelle,
                periode: (r) => r.dateDebut,
                jours: (r) => Number(r.nombreJours),
                statut: (r) => r.statut,
                solde: (r) => r.balance.restants,
              }).map((r) => {
                const canApprove = isAdmin || r.approverId === currentUserId;
                const isApprover = r.approverId === currentUserId;
                const isCreator = r.createdBy === currentUserId;
                const isEmployee = r.employee.email === currentUserEmail;
                const canEdit = isApprover || ((isCreator || isEmployee) && (r.statut === "rejetee" || r.statut === "annulee"));
                const locked = r.statut !== "soumise" && r.statut !== "rejetee";
                return (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{r.employee.firstName} {r.employee.lastName}</td>
                    <td className="px-4 py-3">{r.leaveType.libelle}</td>
                    <td className="px-4 py-3">{formatISODateFr(r.dateDebut)} → {formatISODateFr(r.dateFin)}</td>
                    <td className="px-4 py-3 text-right">{Number(r.nombreJours).toFixed(2)}</td>
                    <td className="px-4 py-3">{statutBadge(r.statut)}</td>
                    <td className="px-4 py-3 text-right text-xs">
                      {r.balance.acquis.toFixed(1)} / {r.balance.consommes.toFixed(1)} / {r.balance.reserves.toFixed(1)} / {r.balance.restants.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        {(r.statut === "soumise" || r.statut === "rejetee") && (
                          <div className="flex justify-end gap-2">
                            {canApprove && !locked && (
                              <input
                                type="text"
                                className="input mb-1 w-40 text-xs"
                                placeholder="Commentaire..."
                                value={comments[r.id] || ""}
                                onChange={(e) => setComments({ ...comments, [r.id]: e.target.value })}
                              />
                            )}
                            <button
                              onClick={() => canApprove && !locked && updateStatus(r.id, "approuvee", comments[r.id])}
                              disabled={!canApprove || locked}
                              title={canApprove && !locked ? "Approuver" : "Réservé à l'approbateur"}
                              className="rounded px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40 bg-emerald-500 hover:bg-emerald-600 disabled:hover:bg-emerald-500"
                            >
                              Approuver
                            </button>
                            {r.statut !== "rejetee" && (
                              <button
                                onClick={() => canApprove && !locked && updateStatus(r.id, "rejetee", comments[r.id])}
                                disabled={!canApprove || locked}
                                title={canApprove && !locked ? "Rejeter" : "Réservé à l'approbateur"}
                                className="rounded px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40 bg-red-500 hover:bg-red-600 disabled:hover:bg-red-500"
                              >
                                Rejeter
                              </button>
                            )}
                            <button
                              onClick={() => canApprove && !locked && updateStatus(r.id, "annulee", comments[r.id])}
                              disabled={!canApprove || locked}
                              title={canApprove && !locked ? "Annuler" : "Réservé à l'approbateur"}
                              className="rounded px-2 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40 bg-gray-500 hover:bg-gray-600 disabled:hover:bg-gray-500"
                            >
                              Annuler
                            </button>
                          </div>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => {
                              setEditing(r);
                              setEditForm({
                                id: r.id,
                                leaveTypeId: r.leaveType.id,
                                dateDebut: r.dateDebut,
                                dateFin: r.dateFin,
                                approverId: r.approverId,
                                motif: r.motif ?? "",
                              });
                            }}
                            className="rounded bg-cabinet-100 px-2 py-1 text-xs font-medium text-cabinet-700 hover:bg-cabinet-200"
                          >
                            Modifier
                          </button>
                        )}
                        <button
                          onClick={() => loadComments(r.id)}
                          className="rounded bg-cabinet-100 px-2 py-1 text-xs font-medium text-cabinet-700 hover:bg-cabinet-200"
                        >
                          Commentaires
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              </PaginatedRows>
            </tbody>
          </table>
        </div>
      </section>

      {openComments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-cabinet-900">Commentaires</h3>
              <button
                onClick={() => setOpenComments(null)}
                className="text-cabinet-500 hover:text-cabinet-700"
              >
                ✕
              </button>
            </div>
            <div className="mb-4 max-h-60 space-y-2 overflow-y-auto rounded-lg border border-cabinet-100 bg-cabinet-50/50 p-2">
              {requestComments.length === 0 ? (
                <p className="text-sm text-cabinet-500">Aucun commentaire.</p>
              ) : (
                requestComments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-white p-2 text-sm shadow-sm">
                    <p className="text-xs font-medium text-cabinet-600">
                      {c.author?.prenom} {c.author?.nom} · {new Date(c.createdAt).toLocaleString("fr-FR")}
                    </p>
                    <p className="mt-1 text-cabinet-900">{c.content}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="Ajouter un commentaire..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addComment(openComments)}
              />
              <button
                onClick={() => addComment(openComments)}
                className="btn-primary"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-cabinet-900">Modifier la demande</h3>
              <button
                onClick={() => setEditing(null)}
                className="text-cabinet-500 hover:text-cabinet-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdate} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Type d&apos;absence</label>
                <select
                  className="input w-full"
                  value={editForm.leaveTypeId}
                  onChange={(e) => setEditForm({ ...editForm, leaveTypeId: e.target.value })}
                  required
                >
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.libelle}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Date début</label>
                <input
                  type="date"
                  className="input w-full"
                  value={editForm.dateDebut}
                  onChange={(e) => setEditForm({ ...editForm, dateDebut: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Date fin</label>
                <input
                  type="date"
                  className="input w-full"
                  value={editForm.dateFin}
                  onChange={(e) => setEditForm({ ...editForm, dateFin: e.target.value })}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Approbateur</label>
                <select
                  className="input w-full"
                  value={editForm.approverId}
                  onChange={(e) => setEditForm({ ...editForm, approverId: e.target.value })}
                  required
                >
                  {approvers.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.prenom} {a.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Motif</label>
                <input
                  type="text"
                  className="input w-full"
                  value={editForm.motif}
                  onChange={(e) => setEditForm({ ...editForm, motif: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3">
                <button type="button" onClick={() => setEditing(null)} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
