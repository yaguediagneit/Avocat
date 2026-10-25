"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";

interface EmployeeHistoryItem {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: Date;
  changedBy: string | null;
}

interface EmployeeData {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  position: string | null;
  department: string | null;
  regime: string;
  hireDate: Date;
  contractType: string;
  contractEndDate: Date | null;
  baseSalary: number;
  cnssNumber: string | null;
  ipresNumber: string | null;
  bankAccount: string | null;
  email: string | null;
  phone: string | null;
  maritalStatus: string;
  nbChildren: number;
  histories?: EmployeeHistoryItem[];
}

interface EmployeeEditFormProps {
  employee: EmployeeData;
}

export function EmployeeEditForm({ employee }: EmployeeEditFormProps) {
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    position: employee.position || "",
    department: employee.department || "",
    regime: employee.regime || "general",
    hireDate: new Date(employee.hireDate).toISOString().split("T")[0],
    contractType: employee.contractType,
    contractEndDate: employee.contractEndDate
      ? new Date(employee.contractEndDate).toISOString().split("T")[0]
      : "",
    baseSalary: String(employee.baseSalary),
    cnssNumber: employee.cnssNumber || "",
    ipresNumber: employee.ipresNumber || "",
    bankAccount: employee.bankAccount || "",
    email: employee.email || "",
    phone: employee.phone || "",
    maritalStatus: employee.maritalStatus,
    nbChildren: String(employee.nbChildren),
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body = {
      ...form,
      baseSalary: Number(form.baseSalary),
      nbChildren: Number(form.nbChildren),
    };

    const res = await fetch(`/api/personnel/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/cabinet/personnel");
      return;
    }

    const data = await res.json().catch(() => ({}));
    setError(typeof data.error === "string" ? data.error : "Erreur lors de la mise à jour");
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Code employé</label>
          <input className="input" value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Date d&apos;embauche</label>
          <input type="date" className="input" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Prénom</label>
          <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Nom</label>
          <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Poste</label>
          <input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Service</label>
          <input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Régime</label>
          <select className="input" value={form.regime} onChange={(e) => setForm({ ...form, regime: e.target.value })}>
            <option value="general">Régime général</option>
            <option value="cadre">Cadre</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Contrat</label>
          <select
            className="input"
            value={form.contractType}
            onChange={(e) => {
              const contractType = e.target.value;
              setForm({
                ...form,
                contractType,
                contractEndDate:
                  contractType === "CDD" ? form.contractEndDate : "",
              });
            }}
          >
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
            <option value="Stage">Stage</option>
            <option value="Prestation">Prestation</option>
          </select>
        </div>
        {form.contractType === "CDD" && (
          <div>
            <label className="mb-1 block text-sm font-medium">Date de fin de contrat</label>
            <input
              type="date"
              className="input"
              value={form.contractEndDate}
              onChange={(e) => setForm({ ...form, contractEndDate: e.target.value })}
              required
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">Salaire de base</label>
          <input type="number" min="0" step="1" className="input" value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Situation familiale</label>
          <select className="input" value={form.maritalStatus} onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}>
            <option value="single">Célibataire</option>
            <option value="married">Marié(e)</option>
            <option value="divorced">Divorcé(e)</option>
            <option value="widowed">Veuf/Veuve</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre d&apos;enfants</label>
          <input type="number" min="0" className="input" value={form.nbChildren} onChange={(e) => setForm({ ...form, nbChildren: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">N° CNSS</label>
          <input className="input" value={form.cnssNumber} onChange={(e) => setForm({ ...form, cnssNumber: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">N° IPRES</label>
          <input className="input" value={form.ipresNumber} onChange={(e) => setForm({ ...form, ipresNumber: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Téléphone</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Compte bancaire</label>
          <input className="input" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} />
        </div>
      </div>

      {employee.histories && employee.histories.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="text-base font-semibold">Historique des changements</h3>
          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  {sortTh("historique", "date", "Date", "px-3 py-2")}
                  {sortTh("historique", "champ", "Champ", "px-3 py-2")}
                  {sortTh("historique", "ancienne", "Ancienne valeur", "px-3 py-2")}
                  {sortTh("historique", "nouvelle", "Nouvelle valeur", "px-3 py-2")}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <PaginatedRows colSpan={4}>
                {sortRows("historique", employee.histories, {
                  date: (h) => h.changedAt,
                  champ: (h) => (h.field === "position" ? "Poste" : h.field === "regime" ? "Régime" : h.field),
                  ancienne: (h) => h.oldValue,
                  nouvelle: (h) => h.newValue,
                }).map((h) => (
                  <tr key={h.id} className="border-b">
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {new Date(h.changedAt).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2">
                      {h.field === "position" ? "Poste" : h.field === "regime" ? "Régime" : h.field}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{h.oldValue || "—"}</td>
                    <td className="px-3 py-2 font-medium">{h.newValue || "—"}</td>
                  </tr>
                ))}
                </PaginatedRows>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Link href="/cabinet/personnel" className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
          Annuler
        </Link>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
