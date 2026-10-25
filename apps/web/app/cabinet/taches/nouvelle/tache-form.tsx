"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ParametreSelect } from "@/components/parametre-select";

interface DossierOption {
  id: string;
  referenceInterne: string;
  client?: { raisonSociale: string } | null;
}

interface UserOption {
  id: string;
  prenom: string;
  nom: string;
  titre?: string | null;
}

interface TacheTemplateOption {
  id: string;
  titre: string;
  description: string | null;
  priorite: string;
  delaiJours: number;
}

interface TacheFormProps {
  dossiers: DossierOption[];
  users: UserOption[];
  currentUser: UserOption | null;
  defaultDossierId?: string;
  tacheTemplates?: TacheTemplateOption[];
  dossierDateOuverture?: string;
}

function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TacheForm({
  dossiers,
  users,
  currentUser,
  defaultDossierId,
  tacheTemplates = [],
  dossierDateOuverture,
}: TacheFormProps) {
  const router = useRouter();
  const [dossierQuery, setDossierQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");

  const [form, setForm] = useState({
    dossierId: defaultDossierId || "",
    titre: "",
    description: "",
    responsableId: currentUser?.id || "",
    echeance: "",
    priorite: "moyenne",
  });

  const filteredDossiers = useMemo(() => {
    const q = dossierQuery.trim().toLowerCase();
    if (!q) return dossiers;
    return dossiers.filter(
      (d) =>
        d.referenceInterne.toLowerCase().includes(q) ||
        d.client?.raisonSociale?.toLowerCase().includes(q)
    );
  }, [dossiers, dossierQuery]);

  const lockedDossier = useMemo(
    () => dossiers.find((d) => d.id === defaultDossierId) || null,
    [dossiers, defaultDossierId]
  );

  const [templates, setTemplates] = useState<TacheTemplateOption[]>(tacheTemplates);
  const [dateOuverture, setDateOuverture] = useState<string | undefined>(dossierDateOuverture);
  const [titreLibre, setTitreLibre] = useState(false);
  const showTemplateSelect = templates.length > 0 && !titreLibre;

  // Quand le dossier est choisi manuellement, on charge ses modèles de tâches.
  async function loadTemplatesForDossier(dossierId: string) {
    setTitreLibre(false);
    if (!dossierId) {
      setTemplates([]);
      setDateOuverture(undefined);
      return;
    }
    try {
      const res = await fetch(`/api/tache-templates?dossierId=${dossierId}`);
      if (!res.ok) {
        setTemplates([]);
        return;
      }
      const data = await res.json();
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
      setDateOuverture(data.dateOuverture || undefined);
    } catch {
      setTemplates([]);
    }
  }

  function applyTemplate(templateId: string) {
    if (templateId === "__libre") {
      setTitreLibre(true);
      setForm((f) => ({ ...f, titre: "" }));
      return;
    }
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    const echeance =
      t.delaiJours > 0 && dateOuverture
        ? toDateTimeLocal(new Date(new Date(dateOuverture).getTime() + t.delaiJours * 86400000))
        : "";
    setForm((f) => ({
      ...f,
      titre: t.titre,
      description: t.description || f.description,
      priorite: t.priorite || f.priorite,
      echeance: echeance || f.echeance,
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError("");
    setLoading(true);

    const body: Record<string, unknown> = {
      ...form,
      echeance: form.echeance ? new Date(form.echeance).toISOString() : null,
    };

    const res = await fetch("/api/taches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/cabinet/taches");
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (data.error?.fieldErrors) {
      const flat: Record<string, string> = {};
      for (const [key, value] of Object.entries(data.error.fieldErrors as Record<string, string[]>)) {
        flat[key] = value[0];
      }
      setErrors(flat);
      setGeneralError(data.error.formErrors?.[0] || "");
    } else if (typeof data.error === "string") {
      setGeneralError(data.error);
    } else {
      setGeneralError("Erreur lors de la création de la tâche");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      {generalError && (
        <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{generalError}</div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Dossier</label>
        {lockedDossier ? (
          <div className="input flex items-center justify-between bg-gray-50 text-gray-700">
            <span>
              {lockedDossier.referenceInterne}
              {lockedDossier.client?.raisonSociale ? ` — ${lockedDossier.client.raisonSociale}` : ""}
            </span>
            <span className="text-xs text-gray-400">Verrouillé</span>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={dossierQuery}
              onChange={(e) => {
                setDossierQuery(e.target.value);
                setForm((f) => ({ ...f, dossierId: "" }));
                loadTemplatesForDossier("");
              }}
              className="input mb-2"
              placeholder="Rechercher un dossier..."
            />
            <select
              value={form.dossierId}
              onChange={(e) => {
                setForm({ ...form, dossierId: e.target.value });
                loadTemplatesForDossier(e.target.value);
              }}
              className="input"
              required
              size={Math.min(5, filteredDossiers.length + 1)}
            >
              <option value="">Sélectionner un dossier</option>
              {filteredDossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.referenceInterne} {d.client?.raisonSociale ? `— ${d.client.raisonSociale}` : ""}
                </option>
              ))}
            </select>
            {filteredDossiers.length === 0 && dossierQuery && (
              <p className="mt-1 text-xs text-cabinet-600">
                Aucun dossier trouvé.{" "}
                <Link href="/cabinet/dossiers/nouveau" className="underline">
                  Ouvrir un dossier
                </Link>
              </p>
            )}
          </>
        )}
        {errors.dossierId && <p className="mt-1 text-xs text-red-600">{errors.dossierId}</p>}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Responsable</label>
          <select
            value={form.responsableId}
            onChange={(e) => setForm({ ...form, responsableId: e.target.value })}
            className="input"
            required
          >
            <option value="">Sélectionner</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.titre ? `${u.titre} ` : ""}{u.prenom} {u.nom}
              </option>
            ))}
          </select>
          {errors.responsableId && <p className="mt-1 text-xs text-red-600">{errors.responsableId}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Priorité</label>
          <ParametreSelect
            categorie="priorite_tache"
            value={form.priorite}
            onChange={(value) => setForm({ ...form, priorite: value })}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Titre</label>
        {showTemplateSelect ? (
          <select
            className="input"
            required
            defaultValue=""
            onChange={(e) => applyTemplate(e.target.value)}
          >
            <option value="" disabled>
              Sélectionner un modèle de tâche…
            </option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.titre}
              </option>
            ))}
            <option value="__libre">Autre (titre libre)</option>
          </select>
        ) : (
          <>
            <input
              type="text"
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              className="input"
              placeholder="Ex. Rédiger conclusions"
              required
            />
            {titreLibre && templates.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTitreLibre(false);
                  setForm((f) => ({ ...f, titre: "" }));
                }}
                className="mt-1 text-xs text-cabinet-700 hover:underline"
              >
                ← Revenir aux modèles de tâches
              </button>
            )}
          </>
        )}
        {errors.titre && <p className="mt-1 text-xs text-red-600">{errors.titre}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input"
          rows={3}
          placeholder="Détails ou contexte..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Échéance</label>
        <input
          type="datetime-local"
          value={form.echeance}
          onChange={(e) => setForm({ ...form, echeance: e.target.value })}
          className="input"
        />
        {errors.echeance && <p className="mt-1 text-xs text-red-600">{errors.echeance}</p>}
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.push("/cabinet/taches")}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Annuler
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Création..." : "Créer la tâche"}
        </button>
      </div>
    </form>
  );
}
