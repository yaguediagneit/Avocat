"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { computePayroll } from "@/lib/payroll";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  baseSalary: number;
  maritalStatus: string;
  nbChildren: number;
  taxShares: number;
}

interface Payroll {
  id: string;
  employeeId: string;
  periodYear: number;
  periodMonth: number;
  cssRate: number;
  ipresRate: number;
  ipresEmployerAmount: number;
  grossSalary: number;
  irppShares: number;
  notes: string | null;
  status: string;
  employee: Employee;
  lines: { rubricId: string; rateOrAmount: number }[];
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

export default function EditPayrollPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const payrollId = params.id;

  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    cssRate: 5.6,
    ipresRate: 5.6,
    ipresEmployerRate: 8.4,
    parts: 1,
    notes: "",
  });
  const [lineInputs, setLineInputs] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch(`/api/personnel/payrolls/${payrollId}`)
      .then((r) => r.json())
      .then((p: Payroll) => {
        setPayroll(p);
        setForm({
          cssRate: Number(p.cssRate),
          ipresRate: Number(p.ipresRate),
          ipresEmployerRate:
            p.grossSalary > 0
              ? Math.round((p.ipresEmployerAmount / p.grossSalary) * 100 * 100) / 100
              : 8.4,
          parts: Number(p.irppShares),
          notes: p.notes || "",
        });
      })
      .catch(() => setError("Erreur de chargement du bulletin"));
    fetch("/api/parametres/payroll-rubrics")
      .then((r) => r.json())
      .then((data: Rubric[]) => {
        setRubrics(data);
        const init: Record<string, number> = {};
        for (const r of data) init[r.id] = r.rateOrAmount;
        setLineInputs(init);
      });
  }, [payrollId]);

  useEffect(() => {
    if (!payroll || rubrics.length === 0) return;
    const updated: Record<string, number> = {};
    for (const r of rubrics) {
      const line = payroll.lines.find((l) => l.rubricId === r.id);
      updated[r.id] = line ? line.rateOrAmount : r.rateOrAmount;
    }
    setLineInputs(updated);
  }, [payroll, rubrics]);

  const employee = payroll?.employee ?? null;

  const preview = useMemo(() => {
    if (!employee) return null;
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
      Number(employee.baseSalary),
      employee.maritalStatus,
      employee.nbChildren,
      form.cssRate,
      form.ipresRate,
      form.ipresEmployerRate,
      selected,
      form.parts
    );
  }, [employee, rubrics, lineInputs, form.cssRate, form.ipresRate, form.ipresEmployerRate, form.parts]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const lines = rubrics.map((r) => ({
      rubricId: r.id,
      rateOrAmount: lineInputs[r.id] ?? 0,
    }));

    const res = await fetch(`/api/personnel/payrolls/${payrollId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, lines }),
    });

    setLoading(false);
    if (res.ok) {
      router.push("/cabinet/personnel");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Erreur lors de la mise à jour");
    }
  }

  if (!payroll) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-gray-600">Chargement du bulletin…</p>
      </div>
    );
  }

  const period = `${payroll.periodMonth.toString().padStart(2, "0")}/${payroll.periodYear}`;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Modifier le bulletin — {payroll.employee.firstName} {payroll.employee.lastName} ({period})</h1>
        <Link href="/cabinet/personnel" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>

      <form onSubmit={onSubmit} className="card space-y-6">
        {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

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
                      step="0.01"
                      className="input w-28 text-right"
                      value={lineInputs[l.rubricId] ?? 0}
                      onChange={(e) =>
                        setLineInputs((prev) => ({ ...prev, [l.rubricId]: Number(e.target.value) }))
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
              {preview ? Number(preview.cssAmount + preview.ipresAmount + preview.irppAmount).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) : "—"} FCFA
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
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
