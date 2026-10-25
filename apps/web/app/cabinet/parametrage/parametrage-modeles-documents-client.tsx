"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { extractTemplateVariables } from "@/lib/document-template";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";
import {
  TacheTemplateForm,
  type TacheTemplateFormData,
  type SpecialiteForm,
} from "./tache-template-form";

interface TacheTemplate extends TacheTemplateFormData {
  id: string;
  specialiteId: string;
  ordre: number;
  actif: boolean;
}

interface Specialite extends SpecialiteForm {
  selectionnee: boolean;
}

interface ParametrageModelesDocumentsClientProps {
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

export function ParametrageModelesDocumentsClient({
  initialSpecialites,
  initialTemplates,
}: ParametrageModelesDocumentsClientProps) {
  const router = useRouter();
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const [templates, setTemplates] = useState<TacheTemplate[]>(initialTemplates);
  const [query, setQuery] = useState("");
  const [editTemplate, setEditTemplate] = useState<TacheTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const specById = useMemo(() => {
    const map = new Map<string, Specialite>();
    initialSpecialites.forEach((s) => map.set(s.id, s));
    return map;
  }, [initialSpecialites]);

  const filtered = useMemo(() => {
    // Multi-mots : chaque mot doit apparaître dans au moins un champ affiché
    // (titre, description, spécialité, étape, priorité, rôle, délai).
    const mots = query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = mots.length
      ? templates.filter((t) => {
          const spec = specById.get(t.specialiteId);
          const haystack = [
            t.titre,
            t.description,
            spec?.libelle,
            spec?.code,
            t.workflowEtape?.libelle,
            t.priorite,
            PRIORITE_LABELS[t.priorite],
            t.roleAttendu,
            ROLE_LABELS[t.roleAttendu],
            t.delaiJours > 0 ? `j+${t.delaiJours}` : "",
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return mots.every((m) => haystack.includes(m));
        })
      : templates;
    return [...list].sort((a, b) => {
      const specA = specById.get(a.specialiteId)?.libelle || "";
      const specB = specById.get(b.specialiteId)?.libelle || "";
      if (specA !== specB) return specA.localeCompare(specB);
      return a.ordre - b.ordre;
    });
  }, [templates, query, specById]);

  function startEdit(t: TacheTemplate) {
    setEditTemplate(t);
    setError("");
    // Remonter en haut de la liste pour avoir le formulaire visible.
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    } catch (err) {
      console.error(err);
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Bibliothèque de modèles de documents</h2>
          <p className="text-sm text-gray-600">
            Liste plate de tous les modèles de tâches ({templates.length}). Recherchez, puis
            cliquez sur « Modifier » pour ajuster le texte, les variables et les blocs
            conditionnels.
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un modèle, une spécialité…"
          className="input max-w-md"
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>
      )}

      {editTemplate && (
        <TacheTemplateForm
          template={editTemplate}
          specialites={initialSpecialites}
          onSaved={(saved) => {
            setTemplates((prev) =>
              prev.map((t) => (t.id === saved.id ? { ...t, ...saved } : t))
            );
            setEditTemplate(null);
            router.refresh();
          }}
          onCancel={() => setEditTemplate(null)}
          title={`Modifier : ${editTemplate.titre}`}
        />
      )}

      <div className="overflow-hidden rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {sortTh("modeles", "modele", "Modèle", "px-4 py-2 text-left font-medium")}
              {sortTh("modeles", "specialite", "Spécialité", "px-4 py-2 text-left font-medium")}
              {sortTh("modeles", "etape", "Étape", "px-4 py-2 text-left font-medium")}
              {sortTh("modeles", "variables", "Variables", "px-4 py-2 text-left font-medium")}
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            <PaginatedRows colSpan={5}>
            {sortRows("modeles", filtered, {
              modele: (t) => t.titre,
              specialite: (t) => specById.get(t.specialiteId)?.libelle || t.specialiteId,
              etape: (t) => t.workflowEtape?.libelle,
              variables: (t) => extractTemplateVariables(t.contenuDocument).length,
            }).map((t) => {
              const spec = specById.get(t.specialiteId);
              const vars = extractTemplateVariables(t.contenuDocument);
              return (
                <tr key={t.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{t.titre}</div>
                    {t.description && (
                      <div className="mt-0.5 text-xs text-gray-500 line-clamp-1">
                        {t.description}
                      </div>
                    )}
                    <div className="mt-1 flex gap-2 text-xs text-gray-500">
                      <span>{PRIORITE_LABELS[t.priorite] || t.priorite}</span>
                      <span>{ROLE_LABELS[t.roleAttendu] || t.roleAttendu}</span>
                      {t.delaiJours > 0 && <span>J+{t.delaiJours}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {spec?.libelle || t.specialiteId}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {t.workflowEtape?.libelle || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {t.contenuDocument ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {vars.length} champ{vars.length > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        Pas de modèle
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3 text-xs">
                      <Link
                        href={`/cabinet/parametrage/pdf/${t.id}`}
                        className="font-medium text-cabinet-700 hover:underline"
                      >
                        PDF
                      </Link>
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        className="font-medium text-cabinet-700 hover:underline"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTemplate(t)}
                        disabled={loading}
                        className={`font-medium hover:underline ${t.actif ? "text-red-600" : "text-emerald-600"}`}
                      >
                        {t.actif ? "Désactiver" : "Activer"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            </PaginatedRows>
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-4 text-sm text-gray-500">Aucun modèle ne correspond à la recherche.</p>
        )}
      </div>
    </div>
  );
}
