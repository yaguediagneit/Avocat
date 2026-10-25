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

interface EvenementFormProps {
  dossiers: DossierOption[];
  defaultDossierId?: string;
}

export function EvenementForm({ dossiers, defaultDossierId }: EvenementFormProps) {
  const router = useRouter();
  const [dossierQuery, setDossierQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");

  const [form, setForm] = useState({
    dossierId: defaultDossierId || "",
    type: "audience",
    titre: "",
    dateDebut: "",
    dateFin: "",
    lieu: "",
    estPublicClient: false,
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError("");
    setLoading(true);

    const body: Record<string, unknown> = {
      ...form,
      dossierId: form.dossierId || null,
      dateDebut: new Date(form.dateDebut).toISOString(),
      dateFin: form.dateFin ? new Date(form.dateFin).toISOString() : null,
    };

    const res = await fetch("/api/evenements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/cabinet/calendrier");
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
      setGeneralError("Erreur lors de la création de l'événement");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      {generalError && (
        <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{generalError}</div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">
          Dossier <span className="font-normal text-gray-500">(optionnel)</span>
        </label>
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
              }}
              className="input mb-2"
              placeholder="Rechercher un dossier..."
            />
            <select
              value={form.dossierId}
              onChange={(e) => setForm({ ...form, dossierId: e.target.value })}
              className="input"
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

      <div>
        <label className="mb-1 block text-sm font-medium">Type</label>
        <ParametreSelect
          categorie="type_evenement"
          value={form.type}
          onChange={(value) => setForm({ ...form, type: value })}
        />
        {errors.type && <p className="mt-1 text-xs text-red-600">{errors.type}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Titre</label>
        <input
          type="text"
          value={form.titre}
          onChange={(e) => setForm({ ...form, titre: e.target.value })}
          className="input"
          placeholder="Ex. Audience au tribunal"
          required
        />
        {errors.titre && <p className="mt-1 text-xs text-red-600">{errors.titre}</p>}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Début</label>
          <input
            type="datetime-local"
            value={form.dateDebut}
            onChange={(e) => setForm({ ...form, dateDebut: e.target.value })}
            className="input"
            required
          />
          {errors.dateDebut && <p className="mt-1 text-xs text-red-600">{errors.dateDebut}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Fin (optionnel)</label>
          <input
            type="datetime-local"
            value={form.dateFin}
            onChange={(e) => setForm({ ...form, dateFin: e.target.value })}
            className="input"
          />
          {errors.dateFin && <p className="mt-1 text-xs text-red-600">{errors.dateFin}</p>}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Lieu</label>
        <input
          type="text"
          value={form.lieu}
          onChange={(e) => setForm({ ...form, lieu: e.target.value })}
          className="input"
          placeholder="Tribunal, cabinet, client..."
        />
        {errors.lieu && <p className="mt-1 text-xs text-red-600">{errors.lieu}</p>}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.estPublicClient}
          onChange={(e) => setForm({ ...form, estPublicClient: e.target.checked })}
          id="estPublicClient"
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="estPublicClient" className="text-sm">
          Visible dans l'espace client
        </label>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.push("/cabinet/calendrier")}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
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
