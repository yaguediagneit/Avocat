"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";

export function PeriodSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const [debut, setDebut] = useState(search.get("debut") || "");
  const [fin, setFin] = useState(search.get("fin") || "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!debut || !fin) return;
    const params = new URLSearchParams(search.toString());
    params.delete("mois");
    params.set("debut", debut);
    params.set("fin", fin);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form onSubmit={apply} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600">Du</label>
        <input
          type="date"
          value={debut}
          onChange={(e) => setDebut(e.target.value)}
          className="input"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-600">Au</label>
        <input
          type="date"
          value={fin}
          onChange={(e) => setFin(e.target.value)}
          className="input"
          required
        />
      </div>
      <button type="submit" className="btn-primary text-sm">
        Appliquer
      </button>
    </form>
  );
}
