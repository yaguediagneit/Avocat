"use client";

import { useState } from "react";

export function DossierPdfButton({ dossierId }: { dossierId: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/pdf`, { method: "GET" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur lors de la génération" }));
        alert(err.error || "Erreur lors de la génération du PDF");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("content-disposition");
      const match = disposition?.match(/filename="?([^";]+)"?/);
      a.download = match?.[1] || `Fiche-globale-${dossierId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="btn-primary"
    >
      {loading ? "Génération…" : "Rapport dossier PDF"}
    </button>
  );
}
