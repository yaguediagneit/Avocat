"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  TacheTemplateForm,
  type TacheTemplateFormData,
} from "./tache-template-form";
import { PaginatedList } from "@/components/pagination";

interface WorkflowEtape {
  id: string;
  code: string;
  libelle: string;
}

interface Specialite {
  id: string;
  code: string;
  libelle: string;
  selectionnee: boolean;
  workflowEtapes: WorkflowEtape[];
}

interface TacheTemplate {
  id: string;
  specialiteId: string;
  workflowEtapeId: string | null;
  titre: string;
  description?: string | null;
  contenuDocument?: string | null;
  wordTemplateKey?: string | null;
  delaiJours: number;
  roleAttendu: string;
  priorite: string;
  ordre: number;
  actif: boolean;
  workflowEtape?: { id: string; code: string; libelle: string } | null;
}

interface ParametrageTacheTemplatesClientProps {
  initialSpecialites: Specialite[];
  initialTemplates: TacheTemplate[];
}

const ROLE_LABELS: Record<string, string> = {
  avocat: "Avocat",
  huissier: "Huissier",
  juriste: "Juriste",
  assistant: "Assistant",
  any: "Indifférent",
};

const PRIORITE_LABELS: Record<string, string> = {
  basse: "Basse",
  moyenne: "Moyenne",
  haute: "Haute",
  critique: "Critique",
};

const PRIORITE_BADGES: Record<string, string> = {
  basse: "bg-gray-100 text-gray-700",
  moyenne: "bg-cabinet-50 text-cabinet-700",
  haute: "bg-amber-100 text-amber-700",
  critique: "bg-red-100 text-red-700",
};

export function ParametrageTacheTemplatesClient({
  initialSpecialites,
  initialTemplates,
}: ParametrageTacheTemplatesClientProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<TacheTemplate[]>(initialTemplates);
  const [expandedSpec, setExpandedSpec] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [wordUploading, setWordUploading] = useState<string | null>(null);

  // Formulaire d'ajout/édition
  const [editTemplate, setEditTemplate] = useState<TacheTemplateFormData | null>(null);

  const selectedSpecialites = useMemo(
    () => initialSpecialites.filter((s) => s.selectionnee),
    [initialSpecialites]
  );

  const templatesBySpec = useMemo(() => {
    const map: Record<string, TacheTemplate[]> = {};
    for (const t of templates) {
      if (!map[t.specialiteId]) map[t.specialiteId] = [];
      map[t.specialiteId].push(t);
    }
    return map;
  }, [templates]);

  function startAdd(specialiteId: string) {
    setEditTemplate({
      specialiteId,
      workflowEtapeId: null,
      titre: "",
      description: "",
      contenuDocument: "",
      delaiJours: 0,
      roleAttendu: "any",
      priorite: "moyenne",
    });
    setExpandedSpec(specialiteId);
  }

  function startEdit(t: TacheTemplate) {
    setEditTemplate({
      id: t.id,
      specialiteId: t.specialiteId,
      workflowEtapeId: t.workflowEtapeId,
      titre: t.titre,
      description: t.description || "",
      contenuDocument: t.contenuDocument || "",
      delaiJours: t.delaiJours,
      roleAttendu: t.roleAttendu,
      priorite: t.priorite,
      ordre: t.ordre,
      workflowEtape: t.workflowEtape,
    });
  }

  function cancelEdit() {
    setEditTemplate(null);
  }

  function handleSaved(saved: TacheTemplateFormData) {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved as TacheTemplate;
        return copy;
      }
      return [...prev, saved as TacheTemplate];
    });
    setEditTemplate(null);
    router.refresh();
  }

  async function toggleTemplate(t: TacheTemplate) {
    const next = !t.actif;
    setLoading(true);
    try {
      const res = await fetch(`/api/tache-templates/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif: next }),
      });
      if (!res.ok) {
        setError("Erreur lors du changement d'état.");
        return;
      }
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, actif: next } : x)));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function uploadWordTemplate(templateId: string, file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Le fichier doit être au format .docx");
      return;
    }
    setWordUploading(templateId);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/tache-templates/${templateId}/word-template`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur lors de l'upload du modèle Word");
        return;
      }
      // Mettre à jour le template localement
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === templateId
            ? { ...t, wordTemplateKey: `tenants/word-templates/${templateId}/${file.name}` }
            : t
        )
      );
      router.refresh();
    } finally {
      setWordUploading(null);
    }
  }

  async function deleteWordTemplate(templateId: string) {
    if (!confirm("Retirer le modèle Word associé ?")) return;
    try {
      const res = await fetch(`/api/tache-templates/${templateId}/word-template`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Erreur lors du retrait du modèle Word");
        return;
      }
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === templateId ? { ...t, wordTemplateKey: null } : t
        )
      );
      router.refresh();
    } catch {
      setError("Erreur réseau");
    }
  }

  function toggleExpanded(specId: string) {
    setExpandedSpec((prev) => (prev === specId ? null : specId));
  }

  return (
    <div className="card space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Modèles de tâches par spécialité</h2>
        <p className="text-sm text-gray-600">
          Définissez les tâches pré-remplies générées automatiquement à l&apos;ouverture d&apos;un
          dossier. Chaque tâche est rattachée à une étape du workflow, avec un délai, un rôle
          attendu et une priorité.
        </p>
      </div>

      {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      {selectedSpecialites.length === 0 && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          Aucune spécialité sélectionnée. Cochez d&apos;abord des spécialités dans la section
          ci-dessus.
        </p>
      )}

      <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
        <PaginatedList>
        {selectedSpecialites.map((spec) => {
          const specTemplates = templatesBySpec[spec.id] || [];
          const isExpanded = expandedSpec === spec.id;
          return (
            <div key={spec.id} className="p-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleExpanded(spec.id)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-cabinet-700"
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
                    className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                  {spec.libelle}
                  <span className="rounded-full bg-cabinet-100 px-2 py-0.5 text-xs font-normal text-cabinet-700">
                    {specTemplates.length} tâche{specTemplates.length > 1 ? "s" : ""}
                  </span>
                </button>
                {isExpanded && (
                  <button
                    type="button"
                    onClick={() => startAdd(spec.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cabinet-700/40 bg-white px-3 py-1.5 text-xs font-medium text-cabinet-900 transition hover:bg-cabinet-100"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
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
                    Ajouter une tâche
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-2 pl-6">
                  {specTemplates.length === 0 && !editTemplate && (
                    <p className="text-sm text-gray-500">
                      Aucun modèle de tâche. Cliquez sur « Ajouter une tâche » pour commencer.
                    </p>
                  )}

                  {specTemplates
                    .sort((a, b) => a.ordre - b.ordre)
                    .map((t) => {
                      const isEditing = editTemplate?.id === t.id;
                      if (isEditing) return null;
                      return (
                        <div
                          key={t.id}
                          className="flex items-start justify-between rounded-md border border-gray-100 bg-gray-50 p-3"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{t.titre}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  PRIORITE_BADGES[t.priorite] || "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {PRIORITE_LABELS[t.priorite] || t.priorite}
                              </span>
                            </div>
                            {t.description && (
                              <p className="mt-0.5 text-xs text-gray-600">{t.description}</p>
                            )}
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                              {t.workflowEtape && (
                                <span>Étape : {t.workflowEtape.libelle}</span>
                              )}
                              <span>Délai : {t.delaiJours}j</span>
                              <span>Rôle : {ROLE_LABELS[t.roleAttendu] || t.roleAttendu}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/cabinet/parametrage/pdf/${t.id}`}
                              className="text-xs font-medium text-cabinet-700 hover:underline"
                            >
                              Générer PDF
                            </Link>
                            {t.wordTemplateKey && (
                              <Link
                                href={`/cabinet/parametrage/word/${t.id}`}
                                className="text-xs font-medium text-blue-700 hover:underline"
                              >
                                Générer Word
                              </Link>
                            )}
                            {t.wordTemplateKey ? (
                              <button
                                type="button"
                                onClick={() => deleteWordTemplate(t.id)}
                                className="text-xs font-medium text-amber-700 hover:underline"
                                title="Retirer le modèle Word"
                              >
                                Word ✓
                              </button>
                            ) : (
                              <label
                                className="cursor-pointer text-xs font-medium text-blue-600 hover:underline"
                              >
                                {wordUploading === t.id ? "Upload..." : "Modèle Word"}
                                <input
                                  type="file"
                                  accept=".docx"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) uploadWordTemplate(t.id, file);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            )}
                            <button
                              type="button"
                              onClick={() => startEdit(t)}
                              className="text-xs font-medium text-cabinet-700 hover:underline"
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleTemplate(t)}
                              className={`text-xs font-medium hover:underline ${t.actif ? "text-red-600" : "text-emerald-600"}`}
                            >
                              {t.actif ? "Désactiver" : "Activer"}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                  {editTemplate?.specialiteId === spec.id && (
                    <TacheTemplateForm
                      template={editTemplate}
                      specialites={initialSpecialites}
                      onSaved={handleSaved}
                      onCancel={cancelEdit}
                      title={editTemplate.id ? "Modifier la tâche" : "Nouvelle tâche"}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
        </PaginatedList>
      </div>
    </div>
  );
}
