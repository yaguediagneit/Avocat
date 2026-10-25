"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PayerButton({ payrollId }: { payrollId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function pay() {
    if (!confirm("Marquer ce bulletin comme payé et générer l'écriture comptable ?")) return;
    setLoading(true);
    const res = await fetch(`/api/personnel/payrolls/${payrollId}/pay`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "virement" }),
    });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      alert("Erreur lors du paiement");
    }
  }

  return (
    <button onClick={pay} disabled={loading} className="text-sm text-cabinet-700 hover:underline">
      {loading ? "..." : "Payer"}
    </button>
  );
}
