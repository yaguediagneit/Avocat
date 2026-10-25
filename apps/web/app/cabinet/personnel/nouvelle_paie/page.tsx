"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { computePayroll, computeTaxShares } from "@/lib/payroll";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  baseSalary: number;
  maritalStatus: string;
  nbChildren: number;
  taxShares: number;
}

interface Rubric {
  id: string;
  code: string;
  label: string;
  type: string;
  calcType: string;
  rateOrAmount: number;
  sortOrder: number;
}

export default function NewPayrollPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date();
  const [form, setForm] = useState({
    employeeId: "",
    periodYear: today.getFullYear(),
    periodMonth: today.getMonth() + 1,
    cssRate: 5.6,
    ipresRate: 5.6,
    ipresEmployerRate: 8.4,
    regime: "general" as "general" | "cadre",
    parts: 1,
    notes: "",
  });

  const [lineInputs, setLineInputs] = useState<Record<string, number>>({});
  const [modelEmployeeId, setModelEmployeeId] = useState("");
  const [modelLoading, setModelLoading] = useState(false);

  useEffect(() => {
    fetch("/api/personnel/employees")
      .then((r) => r.json())
      .then((data: Employee[]) => {
        setEmployees(data);
      });
    fetch("/api/parametres/payroll-rubrics")
      .then((r) => r.json())
      .then((data: Rubric[]) => {
        setRubrics(data);
        const init: Record<string, number> = {};
        for (const r of data) init[r.id] = r.rateOrAmount;
        setLineInputs(init);
      });
  }, []);

  useEffect(() => {
    if (!modelEmployeeId || rubrics.length === 0) return;
    setModelLoading(true);
    fetch(`/api/personnel/payrolls?employeeId=${modelEmployeeId}&limit=1`)
      .then((r) => r.json())
      .then((payrolls: unknown[]) => {
        const payroll = payrolls[0] as {
          cssRate: number;
          ipresRate: number;
          grossSalary: number;
          ipresEmployerAmount: number;
          lines: { rubricId: string; rateOrAmount: number }[];
        } | undefined;
        if (!payroll) return;
        const updated: Record<string, number> = {};
        for (const r of rubrics) {
          const line = payroll.lines.find((l) => l.rubricId === r.id);
          updated[r.id] = line ? line.rateOrAmount : r.rateOrAmount;
        }
        const ipresEmployerRate =
          payroll.grossSalary > 0
            ? Math.round((payroll.ipresEmployerAmount / payroll.grossSalary) * 100 * 100) / 100
            : 8.4;
        setLineInputs(updated);
        setForm((f) => ({
          ...f,
          cssRate: Number(payroll.cssRate),
          ipresRate: Number(payroll.ipresRate),
          ipresEmployerRate,
        }));
      })
      .catch((e) => console.error("Erreur chargement modèle de paie", e))
      .finally(() => setModelLoading(false));
  }, [modelEmployeeId, rubrics]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === form.employeeId),
    [employees, form.employeeId]
  );

  const preview = useMemo(() => {
    if (!selectedEmployee) return null;
    const selected = rubrics.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
      type: r.type as "gain" | "deduction" | "cotisation",
      calcType: r.calcType as "fixed" | "percent_base" | "percent_gross",
      rateOrAmount: lineInputs[r.id] ?? 0,
      sortOrder: r.sortOrder,
    }));

    return computePayroll(
      Number(selectedEmployee.baseSalary),
      selectedEmployee.maritalStatus,
      selectedEmployee.nbChildren,
      form.cssRate,
      form.ipresRate,
      form.ipresEmployerRate,
      selected,
      form.parts
    );
  }, [
    selectedEmployee,
    rubrics,
    lineInputs,
    form.cssRate,
    form.ipresRate,
    form.ipresEmployerRate,
    form.parts,
  ]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const lines = rubrics.map((r) => ({
      rubricId: r.id,
      rateOrAmount: lineInputs[r.id] ?? 0,
    }));

    const res = await fetch("/api/personnel/payrolls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, lines }),
    });

    setLoading(false);
    if (res.ok) {
      router.push("/cabinet/personnel");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Erreur lors de la création");
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nouvelle fiche de paie</h1>
        <Link href="/cabinet/personnel" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>

      <form onSubmit={onSubmit} className="card space-y-6">
        {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Employé</label>
            <select
              className="input w-full"
              value={form.employeeId}
              onChange={(e) => {
                const emp = employees.find((x) => x.id === e.target.value);
                const parts = emp ? emp.taxShares || computeTaxShares(emp.maritalStatus, emp.nbChildren) : 1;
                setForm({ ...form, employeeId: e.target.value, parts });
              }}
              required
            >
              <option value="">Sélectionner un employé</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} — {Number(e.baseSalary).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Mois</label>
            <input
              type="number"
              min={1}
              max={12}
              className="input w-full"
              value={form.periodMonth}
              onChange={(e) => setForm({ ...form, periodMonth: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Année</label>
            <input
              type="number"
              className="input w-full"
              value={form.periodYear}
              onChange={(e) => setForm({ ...form, periodYear: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">
              Modèle : bulletin d&apos;un autre employé (optionnel)
            </label>
            <select
              className="input w-full disabled:bg-gray-100"
              value={modelEmployeeId}
              onChange={(e) => setModelEmployeeId(e.target.value)}
              disabled={modelLoading}
            >
              <option value="">Aucun modèle</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Régime (Cadre/Général)</label>
            <select
              className="input w-full"
              value={form.regime}
              onChange={(e) => {
                const r = e.target.value as "general" | "cadre";
                const defaults =
                  r === "cadre"
                    ? { ipresRate: 8.0, ipresEmployerRate: 12.0 }
                    : { ipresRate: 5.6, ipresEmployerRate: 8.4 };
                setForm({ ...form, regime: r, ...defaults });
              }}
            >
              <option value="general">Général</option>
              <option value="cadre">Cadre</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Taux CNSS / CSS salarié (%)</label>
            <input
              type="number"
              step="0.01"
              className="input w-full"
              value={form.cssRate}
              onChange={(e) => setForm({ ...form, cssRate: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Taux IPRES salarié (%)</label>
            <input
              type="number"
              step="0.01"
              className="input w-full"
              value={form.ipresRate}
              onChange={(e) => setForm({ ...form, ipresRate: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Taux IPRES patronale (%)</label>
            <input
              type="number"
              step="0.01"
              className="input w-full"
              value={form.ipresEmployerRate}
              onChange={(e) => setForm({ ...form, ipresEmployerRate: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nombre de parts (IRPP)</label>
            <input
              type="number"
              step="0.5"
              min={0.5}
              max={5}
              className="input w-full"
              value={form.parts}
              onChange={(e) => setForm({ ...form, parts: Number(e.target.value) })}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 font-semibold">Rubriques</h3>
          <table className="w-full text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <th className="px-3 py-2 text-left">Rubrique</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Calcul</th>
                <th className="px-3 py-2 text-right">Montant / %</th>
                <th className="px-3 py-2 text-right">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {preview?.lines.map((l: any) => (
                <tr key={l.rubricId} className="border-b">
                  <td className="px-3 py-2">{l.rubricLabel}</td>
                  <td className="px-3 py-2 capitalize">{l.rubricType}</td>
                  <td className="px-3 py-2">
                    {l.calcType === "fixed" && "Fixe"}
                    {l.calcType === "percent_base" && "% base"}
                    {l.calcType === "percent_gross" && "% brut"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      step={l.calcType === "fixed" ? 1 : 0.01}
                      className="input w-28 text-right"
                      value={lineInputs[l.rubricId] ?? 0}
                      onChange={(e) =>
                        setLineInputs((prev) => ({
                          ...prev,
                          [l.rubricId]:
                            l.calcType === "fixed"
                              ? Math.round(Number(e.target.value))
                              : Number(e.target.value),
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right">{Number(l.computedAmount).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-cabinet-50 p-4">
            <p className="text-sm text-gray-600">Salaire brut</p>
            <p className="text-lg font-semibold">{preview ? Number(preview.grossSalary).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "—"} FCFA</p>
          </div>
          <div className="rounded-lg bg-cabinet-50 p-4">
            <p className="text-sm text-gray-600">Charges salarié</p>
            <p className="text-lg font-semibold">
              {preview
                ? Number(preview.cssAmount + preview.ipresAmount + preview.irppAmount).toLocaleString("fr-FR", { maximumFractionDigits: 0 })
                : "—"}{" "}
              FCFA
            </p>
          </div>
          <div className="rounded-lg bg-cabinet-50 p-4">
            <p className="text-sm text-gray-600">Salaire net</p>
            <p className="text-lg font-semibold">{preview ? Number(preview.netSalary).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "—"} FCFA</p>
          </div>
          <div className="rounded-lg bg-cabinet-50 p-4">
            <p className="text-sm text-gray-600">Charges patronales</p>
            <p className="text-lg font-semibold">
              {preview ? Number(preview.cssEmployerAmount + preview.ipresEmployerAmount).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "—"} FCFA
            </p>
          </div>
          <div className="rounded-lg bg-cabinet-50 p-4 md:col-span-2">
            <p className="text-sm text-gray-600">Coût total employeur</p>
            <p className="text-lg font-semibold">{preview ? Number(preview.totalEmployerCost).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "—"} FCFA</p>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea
            className="input w-full"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link href="/cabinet/personnel" className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Annuler
          </Link>
          <button type="submit" disabled={loading || !preview} className="btn-primary">
            {loading ? "Enregistrement..." : "Créer le bulletin"}
          </button>
        </div>
      </form>
    </div>
  );
}
