"use client";

import { useState } from "react";
import { extractTemplateVariables } from "@/lib/document-template";

export interface WorkflowEtape {
  id: string;
  code: string;
  libelle: string;
}

export interface SpecialiteForm {
  id: string;
  code: string;
  libelle: string;
  workflowEtapes: WorkflowEtape[];
}

export interface TacheTemplateFormData {
  id?: string;
  specialiteId: string;
  workflowEtapeId: string | null;
  titre: string;
  description: string;
  contenuDocument: string;
  delaiJours: number;
  roleAttendu: string;
  priorite: string;
  ordre?: number;
  workflowEtape?: { id: string; code: string; libelle: string } | null;
  actif?: boolean;
  specialite?: { libelle: string } | null;
}

interface TacheTemplateFormProps {
  template: TacheTemplateFormData | null;
  specialites: SpecialiteForm[];
  onSaved: (saved: TacheTemplateFormData) => void;
  onCancel: () => void;
  title?: string;
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

export function TacheTemplateForm({
  template,
  specialites,
  onSaved,
  onCancel,
  title = template?.id ? "Modifier le modèle" : "Nouveau modèle",
}: TacheTemplateFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    specialiteId: template?.specialiteId || specialites[0]?.id || "",
    workflowEtapeId: template?.workflowEtapeId || "",
    titre: template?.titre || "",
    description: template?.description || "",
    contenuDocument: template?.contenuDocument || "",
    delaiJours: String(template?.delaiJours ?? 0),
    roleAttendu: template?.roleAttendu || "any",
    priorite: template?.priorite || "moyenne",
  });

  const spec = specialites.find((s) => s.id === form.specialiteId);

  function updateField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      specialiteId: form.specialiteId,
      workflowEtapeId: form.workflowEtapeId || null,
      titre: form.titre.trim(),
      description: form.description.trim() || null,
      contenuDocument: form.contenuDocument.trim() || null,
      delaiJours: parseInt(form.delaiJours, 10) || 0,
      roleAttendu: form.roleAttendu,
      priorite: form.priorite,
    };

    const url = template?.id
      ? `/api/tache-templates/${template.id}`
      : "/api/tache-templates";
    const method = template?.id ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          data?.error?.formErrors?.[0] ||
          (typeof data.error === "string" ? data.error : "Erreur lors de l'enregistrement.");
        setError(msg);
        return;
      }
      const saved: TacheTemplateFormData = await res.json();
      onSaved(saved);
    } catch (err) {
      console.error(err);
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  const variables = extractTemplateVariables(form.contenuDocument);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-cabinet-200 bg-white p-4"
    >
      <h4 className="mb-3 text-sm font-semibold text-cabinet-900">{title}</h4>
      {error && (
        <div className="mb-3 rounded-md bg-red-100 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Titre
          </label>
          <input
            type="text"
            required
            maxLength={200}
            value={form.titre}
            onChange={(e) => updateField("titre", e.target.value)}
            className="input"
            placeholder="Ex. Rédaction des conclusions"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Spécialité
          </label>
          <select
            value={form.specialiteId}
            onChange={(e) => {
              updateField("specialiteId", e.target.value);
              updateField("workflowEtapeId", "");
            }}
            className="input"
          >
            {specialites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.libelle}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Étape du workflow
          </label>
          <select
            value={form.workflowEtapeId}
            onChange={(e) => updateField("workflowEtapeId", e.target.value)}
            className="input"
          >
            <option value="">Aucune étape</option>
            {spec?.workflowEtapes.map((etape) => (
              <option key={etape.id} value={etape.id}>
                {etape.libelle}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            maxLength={1000}
            rows={2}
            className="input"
            placeholder="Description optionnelle"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Modèle de document (optionnel)
          </label>
          <textarea
            value={form.contenuDocument}
            onChange={(e) => updateField("contenuDocument", e.target.value)}
            rows={10}
            className="input font-mono text-xs"
            placeholder={
              "Texte fixe du document à générer. Insérez des variables sous la forme [Libellé du champ] ou {{cle|Libellé}}.\n\nEx. « Fait à [Ville], le [Date] » deviendra un formulaire avec les champs « Ville » et « Date », le reste du texte restant non modifiable. Les champs reconnus (référence, client, cabinet…) sont pré-remplis depuis le dossier.\n\nBlocs conditionnels : {{#if type_contrat == \"prestation\"}}...{{/if}}"
            }
          />
          {variables.length > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Champs du formulaire détectés : {variables.map((v) => v.label).join(", ")}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Délai (jours depuis l&apos;ouverture)
          </label>
          <input
            type="number"
            min={0}
            max={365}
            value={form.delaiJours}
            onChange={(e) => updateField("delaiJours", e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Rôle attendu
          </label>
          <select
            value={form.roleAttendu}
            onChange={(e) => updateField("roleAttendu", e.target.value)}
            className="input"
          >
            {Object.entries(ROLE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            Priorité
          </label>
          <select
            value={form.priorite}
            onChange={(e) => updateField("priorite", e.target.value)}
            className="input"
          >
            {Object.entries(PRIORITE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Annuler
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
