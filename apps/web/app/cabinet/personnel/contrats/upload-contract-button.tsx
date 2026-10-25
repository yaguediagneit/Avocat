"use client";

import { useRef, useState } from "react";

interface ContractUploadButtonProps {
  contractId: string;
  hasDocument: boolean;
  onUploaded: () => void;
}

function UploadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
  );
}

function ReplaceIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
  );
}

export function ContractUploadButton({ contractId, hasDocument, onUploaded }: ContractUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/personnel/contracts/${contractId}/upload`, {
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Échec de l'upload");
        return;
      }
      onUploaded();
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
      <input ref={inputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={onChange} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        title={hasDocument ? "Remplacer" : "Uploader"}
        className="rounded p-1 text-cabinet-700 hover:bg-cabinet-100 disabled:opacity-50"
      >
        {loading ? "..." : hasDocument ? <ReplaceIcon /> : <UploadIcon />}
      </button>
    </>
  );
}
