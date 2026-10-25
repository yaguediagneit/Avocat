"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

const MODES = ["virement", "especes", "cheque", "carte", "autre"];

interface PayerButtonProps {
  facture: { id: string; numero: string };
  reste: number;
}

export function PayerButton({ facture, reste }: PayerButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    montant: reste,
    mode: "virement",
    reference: "",
    datePaiement: new Date().toISOString().slice(0, 10),
  });

  if (reste <= 0) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/paiements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          factureId: facture.id,
          montant: form.montant,
          mode: form.mode,
          reference: form.reference,
          datePaiement: form.datePaiement,
        }),
      });
      const data = res.ok ? await res.json() : await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'enregistrement du paiement");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-100"
        title="Payer"
        aria-label="Payer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-cabinet-950/60 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="card flex h-[75vh] w-full max-w-md flex-col space-y-3 overflow-hidden p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-cabinet-900">
                  Payer la facture {facture.numero}
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-2xl leading-none text-gray-500 hover:text-gray-800"
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>

              <p className="text-sm text-gray-600">
                Reste dû : <strong>{reste.toLocaleString("fr-FR")} FCFA</strong>
              </p>

              <form onSubmit={onSubmit} className="flex-1 space-y-2 overflow-hidden pr-1">
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Montant</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    max={reste}
                    value={form.montant}
                    onChange={(e) => setForm({ ...form, montant: parseInt(e.target.value) || 0 })}
                    className="input py-1.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Mode de paiement</label>
                  <select
                    value={form.mode}
                    onChange={(e) => setForm({ ...form, mode: e.target.value })}
                    className="input py-1.5 text-sm"
                  >
                    {MODES.map((m) => (
                      <option key={m} value={m}>
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Référence</label>
                  <input
                    type="text"
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    className="input py-1.5 text-sm"
                    placeholder="N° chèque, bordereau…"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Date de paiement</label>
                  <input
                    type="date"
                    value={form.datePaiement}
                    onChange={(e) => setForm({ ...form, datePaiement: e.target.value })}
                    className="input py-1.5 text-sm"
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-md bg-red-100 p-2 text-xs text-red-700">{error}</div>
                )}

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={loading}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {loading ? "Enregistrement…" : "Enregistrer le paiement"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
