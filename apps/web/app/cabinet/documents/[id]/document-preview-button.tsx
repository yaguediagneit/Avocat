"use client";

import { useState } from "react";

interface DocumentPreviewButtonProps {
  documentId: string;
  documentName: string;
}

/**
 * Bouton « Visualiser » :
 * - Pour les .docx : ouvre le fichier dans Word en mode lecture seule
 *   (ms-word:ofv|u|URL) via WebDAV.
 * - Pour les autres types (PDF, images...) : ouvre l'aperçu inline classique
 *   dans le navigateur via /api/documents/[id]/preview.
 */
export function DocumentPreviewButton({
  documentId,
  documentName,
}: DocumentPreviewButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isDocx = documentName.toLowerCase().endsWith(".docx");

  async function handlePreview() {
    if (!isDocx) {
      // PDF, images, etc. : aperçu inline dans le navigateur
      window.open(`/api/documents/${documentId}/preview`, "_blank");
      return;
    }

    // .docx : ouvrir dans Word en mode lecture seule
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/documents/${documentId}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  return (
    <>
      <button
        type="button"
        onClick={handlePreview}
        disabled={loading}
        className="btn-secondary disabled:opacity-50"
      >
        {loading ? "Ouverture..." : "Visualiser"}
      </button>
      {error && (
        <span className="text-xs text-red-600" title={error}>Erreur</span>
      )}
    </>
  );
}
