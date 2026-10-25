"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

interface ChargePayerButtonProps {
  charge: { id: string; amount: number };
}

export function ChargePayerButton({ charge }: ChargePayerButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePaiement, setDatePaiement] = useState(
    new Date().toISOString().slice(0, 10)
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/charges/${charge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPaid: true,
          paidAt: datePaiement,
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
            <div className="card w-full max-w-md space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-cabinet-900">
                  Marquer la charge comme payée
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
                Montant : <strong>{Number(charge.amount).toLocaleString("fr-FR")} FCFA</strong>
              </p>

              <form onSubmit={onSubmit} className="space-y-2">
                <div>
                  <label className="mb-0.5 block text-xs font-medium">Date de paiement</label>
                  <input
                    type="date"
                    value={datePaiement}
                    onChange={(e) => setDatePaiement(e.target.value)}
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
                    {loading ? "Enregistrement…" : "Enregistrer"}
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
