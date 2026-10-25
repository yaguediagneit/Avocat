"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DotationsButtonProps {
  /// Nombre de dotations échues non encore comptabilisées.
  count: number;
  totalAmount: number;
}

/// Comptabilise les dotations aux amortissements échues (D 681 / C 28).
export function DotationsButton({ count, totalAmount }: DotationsButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  if (count === 0) return null;

  async function run() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/charges/amortissements", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMessage(typeof data.error === "string" ? data.error : "Erreur de comptabilisation");
      return;
    }
    if (data.errors?.length) {
      setMessage(`${data.posted} dotation(s) comptabilisée(s), ${data.errors.length} en erreur : ${data.errors[0].message}`);
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <span className="text-amber-900">
        {count} dotation{count > 1 ? "s" : ""} aux amortissements échue{count > 1 ? "s" : ""} —{" "}
        {totalAmount.toLocaleString("fr-FR")} FCFA à comptabiliser.
      </span>
      <button type="button" onClick={run} disabled={loading} className="btn-primary">
        {loading ? "Comptabilisation..." : "Comptabiliser les dotations échues"}
      </button>
      {message && <span className="text-red-700">{message}</span>}
    </div>
  );
}
