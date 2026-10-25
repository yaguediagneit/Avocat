"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ParametreSelect } from "@/components/parametre-select";

const STATUT_BADGES: Record<string, string> = {
  Prospect: "bg-slate-100 text-slate-700",
  Nouveau: "bg-cabinet-100 text-cabinet-800",
  "À qualifier": "bg-amber-100 text-amber-700",
  "Conflit d'intérêts à vérifier": "bg-red-100 text-red-700",
  "En attente de pièces": "bg-yellow-100 text-yellow-700",
  Ouvert: "bg-sky-100 text-sky-700",
  "En cours d'analyse": "bg-blue-100 text-blue-700",
  "En rédaction": "bg-indigo-100 text-indigo-700",
  "En relecture": "bg-violet-100 text-violet-700",
  "En validation": "bg-purple-100 text-purple-700",
  "À signifier": "bg-fuchsia-100 text-fuchsia-700",
  "Signification en cours": "bg-pink-100 text-pink-700",
  "En attente de retour": "bg-orange-100 text-orange-700",
  "Audience ou échéance à venir": "bg-rose-100 text-rose-700",
  "En attente du client": "bg-neutral-100 text-neutral-700",
  "En négociation": "bg-lime-100 text-lime-700",
  "En attente de décision": "bg-cyan-100 text-cyan-700",
  "Décision rendue": "bg-green-100 text-green-700",
  "En exécution": "bg-teal-100 text-teal-700",
  Facturation: "bg-stone-100 text-stone-700",
  Clôturé: "bg-emerald-100 text-emerald-700",
  Archivé: "bg-gray-100 text-gray-700",
};

export function StatutSelect({ dossierId, current }: { dossierId: string; current: string }) {
  const router = useRouter();
  const [statut, setStatut] = useState(current);
  const [loading, setLoading] = useState(false);

  async function onChange(nouveau: string) {
    setStatut(nouveau);
    setLoading(true);
    const res = await fetch(`/api/dossiers/${dossierId}/statut`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statut: nouveau,
        motif: "Changement manuel",
      }),
    });
    setLoading(false);
    if (!res.ok) {
      alert("Erreur lors du changement de statut");
      setStatut(current);
    } else {
      router.refresh();
    }
  }

  const colorClass = STATUT_BADGES[statut] || "bg-gray-100 text-gray-700";

  return (
    <ParametreSelect
      categorie="statut_dossier"
      value={statut}
      onChange={onChange}
      className={`rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cabinet-500 focus:outline-none ${colorClass}`}
      required={false}
    />
  );
}
