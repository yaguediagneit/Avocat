"use client";

import { useRef, useState } from "react";

interface WordUploadButtonProps {
  templateId: string;
  dossierId: string;
  tacheId?: string;
  templateTitre: string;
  /** Style compact (icône seule) pour le tableau de tâches du dossier. */
  compact?: boolean;
}

/**
 * Bouton « Uploader » séparé : permet d'enregistrer un fichier .docx édité
 * dans le dossier. À utiliser à côté du bouton « Ouvrir dans Word ».
 *
 * Le modèle Word original n'est jamais modifié.
 */
export function WordUploadButton({
  templateId,
  dossierId,
  tacheId,
  templateTitre,
  compact = false,
}: WordUploadButtonProps) {
  const [state, setState] = useState<"idle" | "uploading" | "done">("idle");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setState("uploading");
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dossierId", dossierId);
      if (tacheId) formData.append("tacheId", tacheId);
      formData.append("title", templateTitre);

      const res = await fetch(`/api/tache-templates/${templateId}/word/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur lors de l'enregistrement");
        setState("idle");
        return;
      }

      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setError("Erreur réseau");
      setState("idle");
    }
  }

  if (compact) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
        {state === "idle" && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-emerald-600 transition-colors hover:text-emerald-800"
            aria-label="Enregistrer le document Word"
            title="Enregistrer le document Word"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
        )}
        {state === "uploading" && (
          <span className="text-xs text-gray-400">...</span>
        )}
        {state === "done" && (
          <span className="text-xs text-emerald-600" title="Document enregistré">✓</span>
        )}
        {error && (
          <span className="text-xs text-red-600" title={error}>!</span>
        )}
      </>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
      {state === "idle" && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs font-medium text-emerald-700 hover:underline"
        >
          Enregistrer
        </button>
      )}
      {state === "uploading" && (
        <span className="text-xs text-gray-400">Enregistrement...</span>
      )}
      {state === "done" && (
        <span className="text-xs font-medium text-emerald-700">
          ✓ Enregistré
        </span>
      )}
      {error && (
        <span className="text-xs text-red-600" title={error}>Erreur</span>
      )}
    </>
  );
}
