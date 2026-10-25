"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface TvaRate {
  id: string;
  label: string;
  rate: number;
}

interface Category {
  id: string;
  label: string;
}

interface ChargeData {
  id: string;
  categoryId: string;
  chargeDate: Date;
  amount: number;
  tvaEnabled: boolean;
  tvaRateId: string | null;
  paymentMethod: string;
  description: string | null;
  supplierName: string | null;
  supplierInvoiceRef: string | null;
}

interface ChargeEditFormProps {
  charge: ChargeData;
  categories: Category[];
  tvaRates: TvaRate[];
}

export function ChargeEditForm({ charge, categories, tvaRates }: ChargeEditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    categoryId: charge.categoryId,
    chargeDate: new Date(charge.chargeDate).toISOString().split("T")[0],
    amount: String(charge.amount),
    tvaEnabled: charge.tvaEnabled,
    tvaRateId: charge.tvaRateId || "",
    paymentMethod: charge.paymentMethod,
    description: charge.description || "",
    supplierName: charge.supplierName || "",
    supplierInvoiceRef: charge.supplierInvoiceRef || "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body = {
      ...form,
      amount: Number(form.amount) || 0,
      tvaRateId: form.tvaEnabled ? form.tvaRateId : null,
    };

    const res = await fetch(`/api/charges/${charge.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/cabinet/charges");
      return;
    }

    const data = await res.json().catch(() => ({}));
    setError(typeof data.error === "string" ? data.error : "Erreur lors de la mise à jour");
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Catégorie</label>
          <select
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className="input"
            required
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Date</label>
          <input
            type="date"
            value={form.chargeDate}
            onChange={(e) => setForm({ ...form, chargeDate: e.target.value })}
            className="input"
            required
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Montant TTC</label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="input"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Mode de paiement</label>
          <select
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="input"
            required
          >
            <option value="virement">Virement</option>
            <option value="cheque">Chèque</option>
            <option value="carte">Carte</option>
            <option value="especes">Espèces</option>
            <option value="autre">Autre</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-lg border border-gray-200 p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.tvaEnabled}
            onChange={(e) => setForm({ ...form, tvaEnabled: e.target.checked })}
          />
          Charge avec TVA récupérable
        </label>
        {form.tvaEnabled && (
          <select
            className="input"
            value={form.tvaRateId}
            onChange={(e) => setForm({ ...form, tvaRateId: e.target.value })}
            required={form.tvaEnabled}
          >
            {tvaRates.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} ({r.rate}%)
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Fournisseur</label>
          <input
            type="text"
            value={form.supplierName}
            onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Référence facture</label>
          <input
            type="text"
            value={form.supplierInvoiceRef}
            onChange={(e) => setForm({ ...form, supplierInvoiceRef: e.target.value })}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input"
          rows={3}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <Link href="/cabinet/charges" className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
          Annuler
        </Link>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Enregistrement..." : "Enregistrer les modifications"}
        </button>
      </div>
    </form>
  );
}
