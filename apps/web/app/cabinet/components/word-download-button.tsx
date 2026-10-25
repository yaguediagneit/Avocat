"use client";

import { useState } from "react";

interface WordDownloadButtonProps {
  templateId: string;
  dossierId: string;
  tacheId?: string;
  templateTitre: string;
  /** Style compact (icône seule) pour le tableau de tâches du dossier. */
  compact?: boolean;
}

/**
 * Bouton « Télécharger » : télécharge le modèle Word (.docx) depuis S3.
 * Ne l'ouvre pas, ne l'enregistre pas dans le dossier.
 *
 * Le modèle Word original n'est jamais modifié.
 */
export function WordDownloadButton({
  templateId,
  dossierId,
  tacheId,
  templateTitre,
  compact = false,
}: WordDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tache-templates/${templateId}/word`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dossierId,
          tacheId,
          title: templateTitre,
          downloadOnly: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${templateTitre}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={handleDownload}
          disabled={loading}
          className="text-cabinet-600 transition-colors hover:text-cabinet-800 disabled:opacity-50"
          aria-label="Télécharger le modèle Word"
          title="Télécharger le modèle Word"
        >
          {loading ? (
            <span className="text-xs text-gray-400">...</span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
        </button>
        {error && (
          <span className="text-xs text-red-600" title={error}>!</span>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className="text-xs font-medium text-cabinet-700 hover:underline disabled:opacity-50"
      >
        {loading ? "Téléchargement..." : "Télécharger"}
      </button>
      {error && (
        <span className="text-xs text-red-600" title={error}>Erreur</span>
      )}
    </>
  );
}
