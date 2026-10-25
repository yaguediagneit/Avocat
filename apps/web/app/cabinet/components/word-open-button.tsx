"use client";

import { useState } from "react";

interface WordOpenButtonProps {
  templateId: string;
  dossierId: string;
  tacheId?: string;
  templateTitre: string;
  /** Style compact (icône seule) pour le tableau de tâches du dossier. */
  compact?: boolean;
}

/**
 * Bouton « Ouvrir » : ouvre le modèle Word directement dans Microsoft Word
 * via le protocole ms-word: et WebDAV. Ne télécharge pas le fichier.
 *
 * Le modèle Word original n'est jamais modifié.
 */
export function WordOpenButton({
  templateId,
  dossierId,
  tacheId,
  templateTitre,
  compact = false,
}: WordOpenButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleOpen() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tache-templates/${templateId}/word/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dossierId, tacheId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur");
        return;
      }

      const { msWordUrl } = await res.json();
      window.location.href = msWordUrl;
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
          onClick={handleOpen}
          disabled={loading}
          className="text-blue-600 transition-colors hover:text-blue-800 disabled:opacity-50"
          aria-label="Ouvrir dans Word"
          title="Ouvrir dans Word"
        >
          {loading ? (
            <span className="text-xs text-gray-400">...</span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M9 13h6M9 17h6" />
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
        onClick={handleOpen}
        disabled={loading}
        className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-50"
      >
        {loading ? "Ouverture..." : "Ouvrir dans Word"}
      </button>
      {error && (
        <span className="text-xs text-red-600" title={error}>Erreur</span>
      )}
    </>
  );
}
