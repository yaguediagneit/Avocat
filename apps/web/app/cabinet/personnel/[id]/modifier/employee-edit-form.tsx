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
  sexe: string | null;
  dateNaissance: Date | null;
  maritalStatus: string;
  nbChildren: number;
  nbSpouses: number;
  insuranceDependents?: { prenom: string; nom: string }[];
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
    sexe: employee.sexe || "M",
    dateNaissance: employee.dateNaissance
      ? new Date(employee.dateNaissance).toISOString().split("T")[0]
      : "",
    nbSpouses: String(employee.nbSpouses || 1),
  });
  const [spouses, setSpouses] = useState<{ prenom: string; nom: string }[]>(() => {
    const max = employee.sexe === "F" ? 1 : 4;
    const count = Math.min(max, Math.max(1, employee.nbSpouses || 1));
    const existing = employee.insuranceDependents ?? [];
    return Array.from({ length: count }, (_, i) => ({
      prenom: existing[i]?.prenom ?? "",
      nom: existing[i]?.nom ?? employee.lastName,
    }));
  });

  const maxSpouses = form.sexe === "F" ? 1 : 4;

  function setSpouseCount(value: string) {
    const n = Math.min(maxSpouses, Math.max(1, Number(value) || 1));
    setForm((f) => ({ ...f, nbSpouses: String(n) }));
    setSpouses((prev) =>
      Array.from({ length: n }, (_, i) => prev[i] ?? { prenom: "", nom: form.lastName })
    );
  }

  function setSexe(sexe: string) {
    setForm((f) => ({ ...f, sexe }));
    if (sexe === "F") {
      setForm((f) => ({ ...f, nbSpouses: "1" }));
      setSpouses((prev) => prev.slice(0, 1));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body = {
      ...form,
      baseSalary: Number(form.baseSalary),
      nbChildren: Number(form.nbChildren),
      nbSpouses: form.maritalStatus === "married" ? Number(form.nbSpouses) : 0,
      spouses: form.maritalStatus === "married" ? spouses : [],
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
          <label className="mb-1 block text-sm font-medium">Date de naissance</label>
          <input type="date" className="input" value={form.dateNaissance} onChange={(e) => setForm({ ...form, dateNaissance: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Sexe</label>
          <select className="input" value={form.sexe} onChange={(e) => setSexe(e.target.value)}>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
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
        {form.maritalStatus === "married" && (
          <>
            {form.sexe === "F" ? (
              <div>
                <label className="mb-1 block text-sm font-medium">Nombre d&apos;époux</label>
                <input type="number" className="input" value="1" disabled />
                <p className="mt-1 text-xs text-gray-500">
                  L&apos;époux ajoute 0,5 part fiscale et est rattaché comme ayant droit.
                </p>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium">Nombre d&apos;épouses</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  className="input"
                  value={form.nbSpouses}
                  onChange={(e) => setSpouseCount(e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Chaque épouse ajoute 0,5 part fiscale et est rattachée comme ayant droit.
                </p>
              </div>
            )}
            {spouses.map((s, i) => (
              <div key={i} className="md:col-span-2 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {form.sexe === "F" ? "Prénom époux" : `Prénom épouse ${i + 1}`}
                  </label>
                  <input
                    className="input"
                    value={s.prenom}
                    onChange={(e) =>
                      setSpouses((prev) => prev.map((p, j) => (j === i ? { ...p, prenom: e.target.value } : p)))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {form.sexe === "F" ? "Nom époux" : `Nom épouse ${i + 1}`}
                  </label>
                  <input
                    className="input"
                    value={s.nom}
                    placeholder={form.lastName}
                    onChange={(e) =>
                      setSpouses((prev) => prev.map((p, j) => (j === i ? { ...p, nom: e.target.value } : p)))
                    }
                  />
                </div>
              </div>
            ))}
          </>
        )}
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
