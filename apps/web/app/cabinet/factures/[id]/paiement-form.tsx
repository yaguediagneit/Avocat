"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ParametreSelect } from "@/components/parametre-select";

interface PaiementFormProps {
  factureId: string;
  restant: number;
}

export function PaiementForm({ factureId, restant }: PaiementFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    montant: restant,
    mode: "virement",
    reference: "",
    datePaiement: today,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError("");
    setLoading(true);

    const res = await fetch("/api/paiements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        factureId,
        montant: Number(form.montant),
        mode: form.mode,
        reference: form.reference || undefined,
        datePaiement: form.datePaiement ? new Date(form.datePaiement).toISOString() : undefined,
      }),
    });

    setLoading(false);

    if (res.ok) {
      router.refresh();
      setForm({
        montant: Math.max(0, restant - Number(form.montant)),
        mode: "virement",
        reference: "",
        datePaiement: today,
      });
    } else {
      const data = await res.json().catch(() => ({}));
      setGeneralError(typeof data.error === "string" ? data.error : "Erreur lors de l'enregistrement du paiement");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <h2 className="font-semibold">Enregistrer un paiement</h2>
      {generalError && (
        <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{generalError}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Montant</label>
          <input
            type="number"
            step="1"
            min={0.01}
            max={restant}
            value={form.montant}
            onChange={(e) => setForm({ ...form, montant: parseInt(e.target.value, 10) || 0 })}
            className="input"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Mode</label>
          <ParametreSelect
            categorie="mode_paiement"
            value={form.mode}
            onChange={(value) => setForm({ ...form, mode: value })}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Référence</label>
          <input
            type="text"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            className="input"
            placeholder="N° de virement, chèque..."
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Date du paiement</label>
          <input
            type="date"
            value={form.datePaiement}
            onChange={(e) => setForm({ ...form, datePaiement: e.target.value })}
            className="input"
            required
          />
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Enregistrement..." : "Enregistrer le paiement"}
      </button>
    </form>
  );
}
