"use client";

import { useEffect, useState } from "react";

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  entityLabel: string;
  loading?: boolean;
  error?: string | null;
}

function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  entityLabel,
  loading = false,
  error = null,
}: DeleteConfirmDialogProps) {
  const [token, setToken] = useState("");
  const [input, setInput] = useState("");

  useEffect(() => {
    if (open) {
      setToken(generateToken());
      setInput("");
    }
  }, [open]);

  if (!open) return null;

  const match = input.trim().toUpperCase() === token;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-cabinet-950/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-cabinet-900">Confirmer la suppression</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-gray-500 hover:text-gray-800"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-gray-700">
          Vous êtes sur le point de supprimer définitivement <strong>{entityLabel}</strong>.
          Cette action est irréversible. Pour confirmer, saisissez le code suivant :
        </p>

        <div className="rounded-lg bg-gray-100 p-3 text-center">
          <span className="font-mono text-xl font-semibold tracking-widest text-cabinet-900 select-all">
            {token}
          </span>
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Saisissez le code de confirmation"
          className="input text-center font-mono uppercase"
          disabled={loading}
          autoFocus
        />

        {error && (
          <div className="rounded-md bg-red-100 p-3 text-sm text-red-700 whitespace-pre-line">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!match || loading}
            className="inline-flex items-center rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Suppression..." : "Supprimer définitivement"}
          </button>
        </div>
      </div>
    </div>
  );
}
