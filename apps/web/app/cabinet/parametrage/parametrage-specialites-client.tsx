"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PaginatedList } from "@/components/pagination";

interface TypeDocument {
  id: string;
  code: string;
  libelle: string;
  description?: string | null;
  obligatoire: boolean;
}

interface WorkflowEtape {
  id: string;
  code: string;
  libelle: string;
  description?: string | null;
  ordre: number;
  estInitial: boolean;
  estFinal: boolean;
}

interface Specialite {
  id: string;
  code: string;
  libelle: string;
  description?: string | null;
  selectionnee: boolean;
  typesDocuments: TypeDocument[];
  workflowEtapes: WorkflowEtape[];
}

interface ParametrageSpecialitesClientProps {
  initialSpecialites: Specialite[];
}

export function ParametrageSpecialitesClient({
  initialSpecialites,
}: ParametrageSpecialitesClientProps) {
  const router = useRouter();
  const [specialites, setSpecialites] = useState<Specialite[]>(initialSpecialites);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [showAddForm, setShowAddForm] = useState(false);
  const [addCode, setAddCode] = useState("");
  const [addLibelle, setAddLibelle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState(false);

  const selectedCount = useMemo(
    () => specialites.filter((s) => s.selectionnee).length,
    [specialites]
  );

  function toggleSpecialite(id: string) {
    setSpecialites((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selectionnee: !s.selectionnee } : s))
    );
    setSuccess(false);
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    setSuccess(false);

    const selectionneeIds = specialites.filter((s) => s.selectionnee).map((s) => s.id);

    try {
      const res = await fetch("/api/specialites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectionneeIds }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message =
          data?.error?.formErrors?.[0] ||
          (typeof data.error === "string" ? data.error : "Erreur lors de l'enregistrement.");
        setError(message);
        return;
      }

      const updated: Specialite[] = await res.json();
      setSpecialites((prev) =>
        prev.map((s) => {
          const match = updated.find((u) => u.id === s.id);
          return match ? { ...s, selectionnee: match.selectionnee } : s;
        })
      );
      setSuccess(true);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    setAddError("");
    setAddSuccess(false);

    try {
      const res = await fetch("/api/specialites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: addCode.trim(),
          libelle: addLibelle.trim(),
          description: addDescription.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message =
          data?.error?.formErrors?.[0] ||
          (typeof data.error === "string" ? data.error : "Erreur lors de la création.");
        setAddError(message);
        return;
      }

      const created: Specialite = await res.json();
      setSpecialites((prev) => [...prev, created]);
      setAddSuccess(true);
      setAddCode("");
      setAddLibelle("");
      setAddDescription("");
      setTimeout(() => setShowAddForm(false), 1200);
      router.refresh();
    } catch (err) {
      console.error(err);
      setAddError("Erreur réseau.");
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Spécialités du cabinet</h2>
          <p className="text-sm text-gray-600">
            Cochez les spécialités exercées par le cabinet. Chaque spécialité embarque ses types de
            documents et son workflow.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cabinet-700/40 bg-white px-3 py-2 text-sm font-medium text-cabinet-900 transition hover:bg-cabinet-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            Ajouter
          </button>
          <span className="rounded-full bg-cabinet-100 px-3 py-1 text-sm font-medium text-cabinet-800">
            {selectedCount} sélectionnée{selectedCount > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}
      {success && (
        <div className="rounded-md bg-emerald-100 p-3 text-sm text-emerald-700">
          Spécialités enregistrées.
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAdd} className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Nouvelle spécialité</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="add-libelle" className="mb-1 block text-sm font-medium text-gray-700">
                Libellé
              </label>
              <input
                id="add-libelle"
                type="text"
                value={addLibelle}
                onChange={(e) => setAddLibelle(e.target.value)}
                required
                maxLength={100}
                className="input"
                placeholder="Ex. Droit des affaires"
              />
            </div>
            <div>
              <label htmlFor="add-code" className="mb-1 block text-sm font-medium text-gray-700">
                Code
              </label>
              <input
                id="add-code"
                type="text"
                value={addCode}
                onChange={(e) => setAddCode(e.target.value)}
                required
                maxLength={50}
                className="input"
                placeholder="Ex. DROIT_AFFAIRES"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="add-description" className="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <input
                id="add-description"
                type="text"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                maxLength={500}
                className="input"
                placeholder="Description courte de la spécialité"
              />
            </div>
          </div>

          {addError && <div className="mt-3 rounded-md bg-red-100 p-3 text-sm text-red-700">{addError}</div>}
          {addSuccess && (
            <div className="mt-3 rounded-md bg-emerald-100 p-3 text-sm text-emerald-700">
              Spécialité ajoutée.
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={addLoading}
              className="btn-primary"
            >
              {addLoading ? "Ajout..." : "Ajouter"}
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {specialites.length === 0 && (
          <p className="p-4 text-sm text-gray-500">Aucune spécialité configurée.</p>
        )}

        <PaginatedList>
        {specialites.map((s) => (
          <div key={s.id} className="p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id={`specialite-${s.id}`}
                checked={s.selectionnee}
                onChange={() => toggleSpecialite(s.id)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-cabinet-700 focus:ring-cabinet-500"
              />
              <div className="flex-1">
                <label
                  htmlFor={`specialite-${s.id}`}
                  className="block cursor-pointer text-sm font-medium text-gray-900"
                >
                  {s.libelle}
                </label>
                {s.description && (
                  <p className="text-sm text-gray-600">{s.description}</p>
                )}
                <button
                  type="button"
                  onClick={() => toggleExpanded(s.id)}
                  className="mt-1 text-xs font-medium text-cabinet-700 hover:underline"
                >
                  {expanded[s.id] ? "Masquer" : "Voir"} types de documents et workflow
                </button>
              </div>
            </div>

            {expanded[s.id] && (
              <div className="mt-4 grid gap-4 pl-7 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Types de documents
                  </h4>
                  <ul className="space-y-1">
                    {s.typesDocuments.map((dt) => (
                      <li
                        key={dt.id}
                        className="flex items-center justify-between text-sm text-gray-700"
                      >
                        <span>{dt.libelle}</span>
                        {dt.obligatoire && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                            Obligatoire
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Workflow
                  </h4>
                  <ol className="space-y-1">
                    {s.workflowEtapes.map((w) => (
                      <li key={w.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                            w.estInitial
                              ? "bg-emerald-100 text-emerald-700"
                              : w.estFinal
                                ? "bg-gray-200 text-gray-700"
                                : "bg-cabinet-100 text-cabinet-700"
                          }`}
                        >
                          {w.ordre + 1}
                        </span>
                        <span>{w.libelle}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>
        ))}
        </PaginatedList>
      </div>

      <div className="flex justify-end pt-2">
        <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary">
          {loading ? "Enregistrement..." : "Enregistrer les spécialités"}
        </button>
      </div>
    </div>
  );
}
