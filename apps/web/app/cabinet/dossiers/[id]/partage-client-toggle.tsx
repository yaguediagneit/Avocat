"use client";

import { useState } from "react";

export function PartageClientToggle({
  dossierId,
  initialPartage,
}: {
  dossierId: string;
  initialPartage: boolean;
}) {
  const [partage, setPartage] = useState(initialPartage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/partage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partage: !partage }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur lors du partage.");
        return;
      }
      const data = await res.json();
      setPartage(data.partageClient);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <span className="text-gray-500">Partagé avec le client</span>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
            partage ? "bg-cabinet-700" : "bg-gray-300"
          } ${loading ? "opacity-60" : ""}`}
          aria-pressed={partage}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
              partage ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-sm font-medium">
          {partage ? "Visible dans l'espace client" : "Non partagé"}
        </span>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
