"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function EntryValidationButton({ entryId, isValidated }: { entryId: string; isValidated: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await fetch(`/api/comptabilite/ecritures/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isValidated: !isValidated }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={isValidated ? "Suspendre (exclue des états, sans suppression)" : "Revalider (réintègre dans les états)"}
      className={`rounded px-2 py-0.5 text-xs font-medium ${
        isValidated ? "bg-emerald-50 text-emerald-700 hover:bg-amber-50 hover:text-amber-700" : "bg-amber-100 text-amber-800 hover:bg-emerald-50 hover:text-emerald-700"
      }`}
    >
      {busy ? "…" : isValidated ? "Validée" : "Suspendue"}
    </button>
  );
}
