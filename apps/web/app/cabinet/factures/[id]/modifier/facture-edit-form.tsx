"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface FactureData {
  id: string;
  numero: string;
  libelle: string | null;
  designation: string | null;
  dateEcheance: Date | null;
  statut: string;
}

interface FactureEditFormProps {
  facture: FactureData;
}

export function FactureEditForm({ facture }: FactureEditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    libelle: facture.libelle || "",
    designation: facture.designation || "",
    dateEcheance: facture.dateEcheance ? new Date(facture.dateEcheance).toISOString().split("T")[0] : "",
    statut: facture.statut,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body = {
      ...form,
      dateEcheance: form.dateEcheance ? new Date(`${form.dateEcheance}T00:00:00Z`).toISOString() : null,
    };

    const res = await fetch(`/api/factures/${facture.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/cabinet/factures");
      return;
    }

    const data = await res.json().catch(() => ({}));
    setError(typeof data.error === "string" ? data.error : "Erreur lors de la mise à jour");
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-md bg-cabinet-50 p-3 text-sm text-cabinet-900">
        <span className="font-medium">{facture.numero}</span>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Libellé</label>
        <input
          type="text"
          value={form.libelle}
          onChange={(e) => setForm({ ...form, libelle: e.target.value })}
          className="input"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Désignation / Notes</label>
        <textarea
          value={form.designation}
          onChange={(e) => setForm({ ...form, designation: e.target.value })}
          className="input"
          rows={3}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Date d&apos;échéance</label>
          <input
            type="date"
            value={form.dateEcheance}
            onChange={(e) => setForm({ ...form, dateEcheance: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Statut</label>
          <select
            value={form.statut}
            onChange={(e) => setForm({ ...form, statut: e.target.value })}
            className="input"
            required
          >
            <option value="Brouillon">Brouillon</option>
            <option value="Emise">Emise</option>
            <option value="Partiellement payée">Partiellement payée</option>
            <option value="Payée">Payée</option>
            <option value="Annulée">Annulée</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <Link href="/cabinet/factures" className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
          Annuler
        </Link>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Enregistrement..." : "Enregistrer les modifications"}
        </button>
      </div>
    </form>
  );
}
