"use client";

import { useState } from "react";

interface WordGenerateButtonProps {
  templateId: string;
  dossierId: string;
  tacheId?: string;
  templateTitre: string;
  /** Style compact (icône seule) pour le tableau de tâches du dossier. */
  compact?: boolean;
}

/**
 * Bouton « Word » : ouvre un menu avec deux options :
 *  1. « Ouvrir dans Word » → ouvre le modèle directement dans Word (ms-word:)
 *  2. « Télécharger » → télécharge le .docx
 *
 * L'upload du fichier édité se fait via le bouton séparé WordUploadButton.
 * Le modèle Word original n'est jamais modifié.
 */
export function WordGenerateButton({
  templateId,
  dossierId,
  tacheId,
  templateTitre,
  compact = false,
}: WordGenerateButtonProps) {
  const [state, setState] = useState<"idle" | "generating">("idle");
  const [error, setError] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  async function handleOpenInWord() {
    setShowMenu(false);
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
    }
  }

  async function handleDownload() {
    setShowMenu(false);
    setState("generating");
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
        setError(data.error || "Erreur de génération");
        setState("idle");
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

      setState("idle");
    } catch {
      setError("Erreur réseau");
      setState("idle");
    }
  }

  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowMenu((s) => !s)}
          disabled={state === "generating"}
          className="text-blue-600 transition-colors hover:text-blue-800 disabled:opacity-50"
          aria-label="Word"
          title="Word"
        >
          {state === "generating" ? (
            <span className="text-xs text-gray-400">...</span>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M9 13h6M9 17h6" />
            </svg>
          )}
        </button>
        {showMenu && (
          <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={handleOpenInWord}
              className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100"
            >
              Ouvrir dans Word
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100"
            >
              Télécharger
            </button>
          </div>
        )}
        {error && (
          <span className="text-xs text-red-600" title={error}>!</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setShowMenu((s) => !s)}
        disabled={state === "generating"}
        className="text-xs font-medium text-blue-700 hover:underline disabled:opacity-50"
      >
        {state === "generating" ? "Génération..." : "Word ▾"}
      </button>
      {showMenu && (
        <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={handleOpenInWord}
            className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100"
          >
            Ouvrir dans Word
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100"
          >
            Télécharger
          </button>
        </div>
      )}
      {error && (
        <span className="text-xs text-red-600" title={error}>Erreur</span>
      )}
    </div>
  );
}
