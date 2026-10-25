"use client";

import { useRef, useState } from "react";

interface SignatureUploadProps {
  initialUrl: string | null;
}

export function SignatureUpload({ initialUrl }: SignatureUploadProps) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/users/signature", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Erreur lors de l'envoi.");
        return;
      }

      setUrl(data.url);
    } catch (err) {
      console.error(err);
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!window.confirm("Retirer votre signature ?")) return;

    setLoading(true);
    setError("");

    const res = await fetch("/api/users/signature", { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Erreur lors du retrait.");
    } else {
      setUrl(null);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {url ? (
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <img
            src={url}
            alt="Signature"
            className="max-h-32 object-contain"
          />
        </div>
      ) : (
        <p className="text-sm text-gray-500">Aucune signature enregistrée.</p>
      )}

      {error && (
        <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFile}
          className="hidden"
          id="signature-file"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? "Envoi..." : url ? "Remplacer la signature" : "Téléverser ma signature"}
        </button>
        {url && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="btn-secondary"
          >
            Retirer
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Formats acceptés : PNG, JPEG, WebP — 2 Mo maximum.
      </p>
    </div>
  );
}
