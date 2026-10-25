"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface DossierOption {
  id: string;
  referenceInterne: string;
  client: string;
  typeAffaire: string;
}

interface TacheOption {
  id: string;
  dossierId: string;
  titre: string;
}

interface WordFormClientProps {
  templateId: string;
  templateTitre: string;
  hasWordTemplate: boolean;
  defaultDossierId?: string;
  defaultTacheId?: string;
  defaultReference?: string;
  defaultSubject?: string;
  dossiers: DossierOption[];
  taches: TacheOption[];
  cabinet?: Record<string, unknown>;
  user?: Record<string, unknown>;
}

export function WordFormClient({
  templateId,
  templateTitre,
  hasWordTemplate,
  defaultDossierId,
  defaultTacheId,
  defaultReference,
  defaultSubject,
  dossiers,
  taches,
}: WordFormClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [docxUrl, setDocxUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (docxUrl) URL.revokeObjectURL(docxUrl);
    };
  }, [docxUrl]);

  const [form, setForm] = useState({
    title: templateTitre,
    dossierId: defaultDossierId || "",
    tacheId: defaultTacheId || "",
    publieClient: false,
  });

  const availableTaches = dossiers.length > 0 && form.dossierId
    ? taches.filter((t) => t.dossierId === form.dossierId)
    : [];

  function update(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.dossierId) {
      setError("Veuillez sélectionner un dossier.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch(`/api/tache-templates/${templateId}/word`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          dossierId: form.dossierId,
          tacheId: form.tacheId,
          publieClient: form.publieClient,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur lors de la génération du document Word");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDocxUrl(url);
      setDocumentId(res.headers.get("X-Document-Id"));
      setSuccess(true);
      setError("");

      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  if (!hasWordTemplate) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Générer un document Word</h1>
            <p className="text-sm text-gray-600">
              Modèle : <span className="font-medium">{templateTitre}</span>
            </p>
          </div>
          <Link href="/cabinet/parametrage" className="text-sm text-cabinet-700 hover:underline">
            ← Retour au paramétrage
          </Link>
        </div>
        <div className="card space-y-4">
          <div className="rounded-md bg-amber-100 p-4 text-sm text-amber-800">
            <p className="font-semibold">Aucun modèle Word (.docx) associé à cette tâche.</p>
            <p className="mt-1">
              Uploadez un fichier .docx depuis la section « Modèles de tâches » du paramétrage.
            </p>
          </div>
          <Link href="/cabinet/parametrage" className="btn-secondary inline-block">
            Retour au paramétrage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Générer un document Word</h1>
          <p className="text-sm text-gray-600">
            Modèle : <span className="font-medium">{templateTitre}</span>
          </p>
        </div>
        <Link href="/cabinet/parametrage" className="text-sm text-cabinet-700 hover:underline">
          ← Retour au paramétrage
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        {error && (
          <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-md bg-emerald-100 p-3 text-sm text-emerald-700">
            <p>Document Word généré et enregistré dans les documents du dossier.</p>
            {documentId && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {docxUrl && (
                  <a
                    href={docxUrl}
                    download={`${form.title}.docx`}
                    className="font-medium text-cabinet-800 underline"
                  >
                    Télécharger le .docx
                  </a>
                )}
                <Link
                  href={`/cabinet/documents/${documentId}`}
                  className="font-medium text-cabinet-800 underline"
                >
                  Voir le document
                </Link>
                <Link
                  href={`/cabinet/dossiers/${form.dossierId}`}
                  className="font-medium text-cabinet-800 underline"
                >
                  Retour au dossier
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Section : Dossier de rattachement */}
        <div className="rounded-lg border border-cabinet-200 bg-cabinet-50/30 p-4">
          <h3 className="mb-3 text-sm font-semibold text-cabinet-900">Dossier de rattachement</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">
                Dossier <span className="text-red-600">*</span>
              </label>
              <select
                value={form.dossierId}
                onChange={(e) => update("dossierId", e.target.value)}
                className="input"
                required
                disabled={!!defaultDossierId}
              >
                <option value="">Sélectionner un dossier</option>
                {dossiers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.referenceInterne} — {d.client}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tâche associée (optionnel)</label>
              <select
                value={form.tacheId}
                onChange={(e) => update("tacheId", e.target.value)}
                className="input"
                disabled={!form.dossierId || !!defaultTacheId}
              >
                <option value="">Aucune tâche</option>
                {availableTaches.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.titre}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="word-publie-client"
                checked={form.publieClient}
                onChange={(e) => update("publieClient", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-cabinet-700 focus:ring-cabinet-500"
              />
              <label htmlFor="word-publie-client" className="text-sm font-medium">
                Publier dans l'espace client
              </label>
            </div>
          </div>
        </div>

        {/* Section : Titre */}
        <div>
          <label className="mb-1 block text-sm font-medium">Titre du document</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            className="input"
            required
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/cabinet/parametrage")}
            className="btn-secondary"
          >
            Annuler
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Génération..." : "Générer et enregistrer le .docx"}
          </button>
        </div>
      </form>
    </div>
  );
}
