"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUTS = ["En préparation", "Tentée", "Remise", "Annulée", "Échouée"] as const;

interface MissionStatutSelectProps {
  missionId: string;
  current: string;
  /// Chemin d'API à utiliser pour le PATCH (ex: /api/missions/{id} ou /api/missions/profession/{profession}/{id}).
  apiPath: string;
  disabled?: boolean;
}

export function MissionStatutSelect({ missionId, current, apiPath, disabled }: MissionStatutSelectProps) {
  const router = useRouter();
  const [statut, setStatut] = useState(current);
  const [loading, setLoading] = useState(false);

  async function onChange(nouveau: string) {
    if (nouveau === current) return;
    setStatut(nouveau);
    setLoading(true);
    const res = await fetch(apiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: nouveau }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(typeof data.error === "string" ? data.error : "Erreur lors du changement de statut");
      setStatut(current);
    } else {
      router.refresh();
    }
  }

  return (
    <select
      value={statut}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading || disabled}
      className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-cabinet-500 focus:outline-none disabled:opacity-50"
    >
      {STATUTS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
