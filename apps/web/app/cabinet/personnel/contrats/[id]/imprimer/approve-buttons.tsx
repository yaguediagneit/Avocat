"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApproveButtons({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatut(statut: string) {
    setLoading(true);
    const res = await fetch(`/api/personnel/contracts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      alert("Erreur lors de la mise à jour du statut.");
    }
    setLoading(false);
  }

  return (
    <div className="mt-8 flex justify-center gap-3 print:hidden">
      <button
        type="button"
        onClick={() => updateStatut("approuvé")}
        disabled={loading}
        className="btn-primary"
      >
        {loading ? "Traitement..." : "Approuver"}
      </button>
      <button
        type="button"
        onClick={() => updateStatut("rejeté")}
        disabled={loading}
        className="btn-secondary"
      >
        {loading ? "Traitement..." : "Rejeter"}
      </button>
    </div>
  );
}
