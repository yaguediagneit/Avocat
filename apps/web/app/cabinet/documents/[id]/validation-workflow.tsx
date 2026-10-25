"use client";

import { useState } from "react";
import { PaginatedUl } from "@/components/pagination";

interface CircuitEntry {
  action: string;
  userId: string;
  userName: string;
  date: string;
  note?: string | null;
}

interface ValidationWorkflowProps {
  documentId: string;
  initialStatut: string;
  initialRelecteurId?: string | null;
  initialCircuit?: CircuitEntry[] | null;
}

const STATUT_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  en_relecture: "En relecture",
  valide: "Validé",
  rejete: "Rejeté",
};

const STATUT_BADGES: Record<string, string> = {
  brouillon: "bg-gray-100 text-gray-700",
  en_relecture: "bg-amber-100 text-amber-700",
  valide: "bg-emerald-100 text-emerald-700",
  rejete: "bg-red-100 text-red-700",
};

export function ValidationWorkflow({
  documentId,
  initialStatut,
  initialCircuit,
}: ValidationWorkflowProps) {
  const [statut, setStatut] = useState(initialStatut);
  const [circuit, setCircuit] = useState<CircuitEntry[]>(initialCircuit || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function changeStatut(nouveauStatut: string) {
    setLoading(true);
    setError("");
    const previousStatut = statut;
    setStatut(nouveauStatut);

    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statutValidation: nouveauStatut,
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Erreur lors du changement de statut.");
        setStatut(previousStatut);
        return;
      }

      const updated = await res.json();
      setStatut(updated.statutValidation);
      setCircuit(updated.circuitValidation || []);
      setNote("");
    } catch (err) {
      console.error(err);
      setError("Erreur réseau.");
      setStatut(previousStatut);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Workflow de validation</h2>
        <p className="text-sm text-gray-600">
          Circuit de relecture et d&apos;approbation des actes sensibles
          (conclusions, actes notariés, rapports).
        </p>
      </div>

      {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Statut actuel :</span>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            STATUT_BADGES[statut] || "bg-gray-100 text-gray-700"
          }`}
        >
          {STATUT_LABELS[statut] || statut}
        </span>
      </div>

      {/* Actions de changement de statut */}
      <div className="flex flex-wrap gap-2">
        {statut !== "en_relecture" && (
          <button
            type="button"
            onClick={() => changeStatut("en_relecture")}
            disabled={loading}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
          >
            Demander une relecture
          </button>
        )}
        {statut === "en_relecture" && (
          <>
            <button
              type="button"
              onClick={() => changeStatut("valide")}
              disabled={loading}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              Valider l&apos;acte
            </button>
            <button
              type="button"
              onClick={() => changeStatut("rejete")}
              disabled={loading}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              Rejeter
            </button>
          </>
        )}
        {statut === "rejete" && (
          <button
            type="button"
            onClick={() => changeStatut("brouillon")}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Remettre en brouillon
          </button>
        )}
      </div>

      {/* Note optionnelle */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Note (optionnelle, jointe à la prochaine action)
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          className="input"
          placeholder="Ex. Modifications demandées sur le paragraphe 3"
        />
      </div>

      {/* Historique du circuit */}
      {circuit.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Historique du circuit</h3>
          <ol className="space-y-2">
            <PaginatedUl>
            {circuit.map((entry, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span
                  className={`mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs ${
                    entry.action === "valide"
                      ? "bg-emerald-100 text-emerald-700"
                      : entry.action === "rejete"
                        ? "bg-red-100 text-red-700"
                        : entry.action === "en_relecture"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="flex-1">
                  <span className="font-medium text-gray-900">{entry.userName}</span>
                  <span className="text-gray-600"> a passé le statut à </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      STATUT_BADGES[entry.action] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {STATUT_LABELS[entry.action] || entry.action}
                  </span>
                  <span className="ml-2 text-xs text-gray-400">
                    {new Date(entry.date).toLocaleString("fr-FR")}
                  </span>
                  {entry.note && (
                    <p className="mt-0.5 text-xs text-gray-600">↳ {entry.note}</p>
                  )}
                </div>
              </li>
            ))}
            </PaginatedUl>
          </ol>
        </div>
      )}
    </div>
  );
}
