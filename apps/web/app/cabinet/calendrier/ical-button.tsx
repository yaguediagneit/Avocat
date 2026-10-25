"use client";

import { useState } from "react";

export function IcalButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/calendrier/ical/token", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || "Erreur lors de la génération du lien");
        return;
      }
      const { url } = (await res.json()) as { url: string };
      await navigator.clipboard.writeText(url);
      setMessage("Lien iCal copié dans le presse-papiers");
    } catch (error) {
      setMessage("Erreur lors de la copie du lien");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg border border-cabinet-200 bg-white px-4 py-2 text-sm font-medium text-cabinet-700 shadow-sm transition hover:border-cabinet-300 hover:bg-cabinet-50 disabled:opacity-50"
      >
        {loading ? "Génération…" : "Lien iCal"}
      </button>
      {message && (
        <span className="text-sm text-emerald-600">{message}</span>
      )}
    </div>
  );
}
