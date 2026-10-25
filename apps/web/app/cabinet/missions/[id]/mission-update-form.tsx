"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUTS = ["En préparation", "Tentée", "Remise", "Annulée", "Échouée"] as const;

interface MissionUpdateFormProps {
  mission: {
    id: string;
    statut: string;
    resultat: string | null;
    dateTentative: string | null;
    dateRemise: string | null;
  };
  canEdit: boolean;
}

function toDatetimeLocal(date: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

export function MissionUpdateForm({ mission, canEdit }: MissionUpdateFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    statut: mission.statut,
    resultat: mission.resultat || "",
    dateTentative: toDatetimeLocal(mission.dateTentative),
    dateRemise: toDatetimeLocal(mission.dateRemise),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!canEdit) {
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body: Record<string, unknown> = { statut: form.statut, resultat: form.resultat };
    body.dateTentative = form.dateTentative ? new Date(form.dateTentative).toISOString() : null;
    body.dateRemise = form.dateRemise ? new Date(form.dateRemise).toISOString() : null;

    try {
      const res = await fetch(`/api/missions/${mission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Erreur lors de la mise à jour");
        return;
      }

      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      <h2 className="font-semibold">Mise à jour de la mission</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Statut</label>
          <select
            value={form.statut}
            onChange={(e) => setForm({ ...form, statut: e.target.value })}
            className="input w-full"
          >
            {STATUTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Date de tentative</label>
          <input
            type="datetime-local"
            value={form.dateTentative}
            onChange={(e) => setForm({ ...form, dateTentative: e.target.value })}
            className="input w-full"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Date de remise</label>
          <input
            type="datetime-local"
            value={form.dateRemise}
            onChange={(e) => setForm({ ...form, dateRemise: e.target.value })}
            className="input w-full"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Résultat / commentaire</label>
        <textarea
          value={form.resultat}
          onChange={(e) => setForm({ ...form, resultat: e.target.value })}
          rows={3}
          className="input w-full"
          placeholder="Décrivez le résultat de l'intervention..."
        />
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
