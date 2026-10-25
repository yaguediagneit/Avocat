"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GeneratePayrollsButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const today = new Date();
  const sourceDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const [sourceYear, setSourceYear] = useState(sourceDate.getFullYear());
  const [sourceMonth, setSourceMonth] = useState(sourceDate.getMonth() + 1);
  const [targetYear, setTargetYear] = useState(today.getFullYear());
  const [targetMonth, setTargetMonth] = useState(today.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isSameMonth = sourceYear === targetYear && sourceMonth === targetMonth;
  const isBackward =
    targetYear < sourceYear ||
    (targetYear === sourceYear && targetMonth < sourceMonth);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/personnel/payrolls/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceYear, sourceMonth, targetYear, targetMonth, allowBackward: isBackward }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Erreur lors de la génération");
        return;
      }
      const parts: string[] = [];
      if (data.created?.length) parts.push(`${data.created.length} bulletin(s) créé(s)`);
      if (data.skipped?.length) parts.push(`${data.skipped.length} ignoré(s) (déjà existants)`);
      if (data.errors?.length) parts.push(`${data.errors.length} erreur(s)`);
      setMessage(parts.join(" — ") || "Aucun bulletin généré");
      router.refresh();
    } catch (err) {
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex w-auto items-center justify-center whitespace-nowrap rounded-t-xl border border-b-transparent border-yellow-200/80 border-t-yellow-500 bg-yellow-100 px-3 py-2 text-center text-[10px] font-semibold text-yellow-900 shadow-[0_-6px_16px_-8px_rgba(15,27,46,0.25)] transition hover:bg-yellow-200"
      >
        Générer bulletins du mois
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
          >
          <div className="mb-3 text-sm font-medium text-gray-700">
            Générer les bulletins du mois cible à partir du mois source
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">Mois source</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={12}
                className="input w-20"
                value={sourceMonth}
                onChange={(e) => setSourceMonth(Number(e.target.value))}
              />
              <input
                type="number"
                className="input flex-1"
                value={sourceYear}
                onChange={(e) => setSourceYear(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">Mois cible</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={12}
                className="input w-20"
                value={targetMonth}
                onChange={(e) => setTargetMonth(Number(e.target.value))}
              />
              <input
                type="number"
                className="input flex-1"
                value={targetYear}
                onChange={(e) => setTargetYear(Number(e.target.value))}
              />
            </div>
          </div>

          {isBackward && (
            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              ⚠ Attention : le mois cible est antérieur au mois source. Vous allez générer des bulletins pour un mois passé (rattrapage de paie).
            </div>
          )}
          {isSameMonth && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              Le mois cible doit être différent du mois source.
            </div>
          )}

          <button
            type="submit"
            disabled={loading || isSameMonth}
            className="w-full rounded-lg bg-cabinet-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-cabinet-800 disabled:opacity-50"
          >
            {loading ? "Génération…" : isBackward ? "Générer quand même" : "Générer"}
          </button>

          {message && (
            <div className="mt-2 text-xs text-emerald-600">{message}</div>
          )}
          </form>
        </div>
      )}
    </>
  );
}
