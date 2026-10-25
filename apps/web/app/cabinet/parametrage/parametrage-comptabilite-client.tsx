"use client";

import { Fragment, useEffect, useState } from "react";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";

interface CrudItem {
  id?: string;
  code: string;
  label: string;
  [key: string]: any;
}

const RESOURCE_LABELS: Record<string, string> = {
  "charge-categories": "Catégories de charges",
  "tva-rates": "Taux de TVA",
  "payroll-rubrics": "Rubriques de paie",
};

function CrudSection({
  resource,
  initial,
  fields,
}: {
  resource: string;
  initial: CrudItem[];
  fields: { key: string; label: string; type?: string; required?: boolean }[];
}) {
  function buildDefault(): CrudItem {
    const def: CrudItem = { code: "", label: "" };
    for (const f of fields) {
      if (f.type === "number") def[f.key] = 0;
      else if (f.type === "checkbox") def[f.key] = f.key === "isActive";
      else def[f.key] = "";
    }
    return def;
  }

  const { th: sortTh, sorted: sortRows } = useTableSort();
  const [items, setItems] = useState<CrudItem[]>(initial);
  const [form, setForm] = useState<CrudItem>(buildDefault());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const res = await fetch(`/api/parametres/${resource}`);
    if (res.ok) setItems(await res.json());
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const method = editingId ? "PATCH" : "POST";
    const body = editingId ? { id: editingId, ...form } : form;
    const res = await fetch(`/api/parametres/${resource}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.ok) {
      setForm(buildDefault());
      setEditingId(null);
      refresh();
    } else {
      alert("Erreur lors de l'enregistrement.");
    }
  }

  async function toggleActive(item: CrudItem) {
    const next = !(item.isActive !== false);
    const res = await fetch(`/api/parametres/${resource}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isActive: next }),
    });
    if (res.ok) refresh();
    else alert("Erreur lors du changement d'état.");
  }

  function edit(item: CrudItem) {
    setEditingId(item.id ?? null);
    setForm({ ...item });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-5">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-sm font-medium">{f.label}</label>
            {f.type === "select" ? (
              <select
                className="input w-full"
                value={String(form[f.key] ?? "")}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                required={f.required}
              >
                {f.key === "type" && (
                  <>
                    <option value="">--</option>
                    <option value="gain">Gain</option>
                    <option value="deduction">Déduction</option>
                    <option value="cotisation">Cotisation</option>
                  </>
                )}
                {f.key === "calcType" && (
                  <>
                    <option value="">--</option>
                    <option value="fixed">Montant fixe</option>
                    <option value="percent_base">% du salaire de base</option>
                    <option value="percent_gross">% du brut</option>
                  </>
                )}
              </select>
            ) : f.type === "checkbox" ? (
              <input
                type="checkbox"
                checked={!!form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })}
              />
            ) : (
              <input
                type={f.type === "number" ? "number" : "text"}
                step={f.type === "number" ? "any" : undefined}
                className="input w-full"
                value={String(form[f.key] ?? "")}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value,
                  })
                }
                required={f.required}
              />
            )}
          </div>
        ))}
        <div className="flex items-end gap-2">
          <button type="submit" className="btn-primary" disabled={loading}>
            {editingId ? "Modifier" : "Ajouter"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(buildDefault());
              }}
              className="text-sm text-gray-600"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <table className="w-full text-left text-sm">
        <thead className="bg-cabinet-100 text-cabinet-900">
          <tr>
            {fields.map((f) => (
              <Fragment key={f.key}>{sortTh("list", f.key, f.label, "px-3 py-2")}</Fragment>
            ))}
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          <PaginatedRows colSpan={fields.length + 1}>
          {sortRows("list", items, Object.fromEntries(fields.map((f) => [f.key, (item: CrudItem) => f.type === "checkbox" ? (item[f.key] ? "Oui" : "Non") : item[f.key]]))).map((item) => (
            <tr key={item.id} className="border-b hover:bg-gray-50">
              {fields.map((f) => (
                <td key={f.key} className="px-3 py-2">
                  {f.type === "checkbox" ? (item[f.key] ? "Oui" : "Non") : String(item[f.key] ?? "")}
                </td>
              ))}
              <td className="px-3 py-2 text-right">
                <button onClick={() => edit(item)} className="mr-2 text-cabinet-700 hover:underline">
                  Modifier
                </button>
                <button
                  onClick={() => toggleActive(item)}
                  className={`hover:underline ${item.isActive !== false ? "text-red-600" : "text-emerald-600"}`}
                >
                  {item.isActive !== false ? "Désactiver" : "Activer"}
                </button>
              </td>
            </tr>
          ))}
          </PaginatedRows>
        </tbody>
      </table>
    </div>
  );
}

export function ParametrageComptabiliteClient({
  initialChargeCategories,
  initialTvaRates,
  initialPayrollRubrics,
  initialAccountMappings,
}: {
  initialChargeCategories: any[];
  initialTvaRates: any[];
  initialPayrollRubrics: any[];
  initialAccountMappings: any[];
}) {
  const [tab, setTab] = useState("charge-categories");

  const tabs = [
    { key: "charge-categories", label: "Catégories de charges" },
    { key: "tva-rates", label: "Taux de TVA" },
    { key: "payroll-rubrics", label: "Rubriques de paie" },
    { key: "account-mappings", label: "Comptes automatiques" },
  ];

  const chargeFields = [
    { key: "code", label: "Code", required: true },
    { key: "label", label: "Libellé", required: true },
    { key: "accountCode", label: "Compte Syscohada" },
    { key: "description", label: "Description" },
    { key: "ordre", label: "Ordre", type: "number" },
    { key: "isActive", label: "Actif", type: "checkbox" },
  ];

  const tvaFields = [
    { key: "code", label: "Code", required: true },
    { key: "label", label: "Libellé", required: true },
    { key: "rate", label: "Taux (%)", type: "number", required: true },
    { key: "isDefault", label: "Par défaut", type: "checkbox" },
    { key: "isActive", label: "Actif", type: "checkbox" },
  ];

  const rubricFields = [
    { key: "code", label: "Code", required: true },
    { key: "label", label: "Libellé", required: true },
    { key: "type", label: "Type", type: "select", required: true },
    { key: "calcType", label: "Mode calcul", type: "select", required: true },
    { key: "rateOrAmount", label: "Montant / Taux", type: "number", required: true },
    { key: "sortOrder", label: "Ordre", type: "number" },
    { key: "isActive", label: "Actif", type: "checkbox" },
  ];

  const mappingFields = [
    { key: "code", label: "Code mapping", required: true },
    { key: "label", label: "Libellé", required: true },
    { key: "accountCode", label: "N° compte Syscohada", required: true },
    { key: "journalCode", label: "Code journal" },
    { key: "isActive", label: "Actif", type: "checkbox" },
  ];

  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-semibold">Comptabilité, charges et paie</h2>
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1 text-sm ${tab === t.key ? "border-b-2 border-cabinet-700 font-medium text-cabinet-700" : "text-gray-600"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "charge-categories" && (
        <CrudSection resource="charge-categories" initial={initialChargeCategories} fields={chargeFields} />
      )}
      {tab === "tva-rates" && <CrudSection resource="tva-rates" initial={initialTvaRates} fields={tvaFields} />}
      {tab === "payroll-rubrics" && (
        <CrudSection resource="payroll-rubrics" initial={initialPayrollRubrics} fields={rubricFields} />
      )}
      {tab === "account-mappings" && (
        <CrudSection resource="account-mappings" initial={initialAccountMappings} fields={mappingFields} />
      )}
    </section>
  );
}
