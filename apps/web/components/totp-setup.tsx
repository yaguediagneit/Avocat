"use client";

import { useState } from "react";

/**
 * Bloc « Authentification à deux facteurs (TOTP) » du profil :
 * active/désactive Google Authenticator ou Microsoft Authenticator
 * via QR code + premier code de vérification.
 */
export function TotpSetup({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [qr, setQr] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [token, setToken] = useState("");
  const [mode, setMode] = useState<"idle" | "enable" | "disable">("idle");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function startSetup() {
    setError("");
    setSuccess("");
    setLoading(true);
    const res = await fetch("/api/auth/mfa/totp/setup", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Impossible de générer le QR code.");
      return;
    }
    setQr({ qrDataUrl: data.qrDataUrl, secret: data.secret });
    setToken("");
    setMode("enable");
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/mfa/totp/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Code incorrect.");
      return;
    }
    setEnabled(true);
    setMode("idle");
    setQr(null);
    setToken("");
    setSuccess("L'authentification à deux facteurs est activée.");
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/mfa/totp/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Code incorrect.");
      return;
    }
    setEnabled(false);
    setMode("idle");
    setToken("");
    setSuccess("L'authentification à deux facteurs est désactivée.");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Utilisez Google Authenticator ou Microsoft Authenticator pour générer un
        code à 6 chiffres demandé à chaque connexion.
      </p>
      <p className="text-sm">
        Statut :{" "}
        <span className={`font-medium ${enabled ? "text-emerald-600" : "text-gray-500"}`}>
          {enabled ? "Activée" : "Désactivée"}
        </span>
      </p>

      {error && <div className="rounded-md bg-red-100 p-2 text-sm text-red-700">{error}</div>}
      {success && (
        <div className="rounded-md bg-emerald-100 p-2 text-sm text-emerald-700">{success}</div>
      )}

      {mode === "idle" && !enabled && (
        <button type="button" onClick={startSetup} disabled={loading} className="btn-primary">
          {loading ? "Génération..." : "Activer la double authentification"}
        </button>
      )}

      {mode === "enable" && qr && (
        <form onSubmit={confirmEnable} className="space-y-3">
          <p className="text-sm text-gray-600">
            1. Scannez ce QR code avec Google Authenticator ou Microsoft
            Authenticator, ou saisissez la clé manuellement :
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.qrDataUrl} alt="QR code TOTP" className="h-40 w-40 rounded border" />
          <p className="select-all rounded bg-gray-100 p-2 font-mono text-xs break-all">
            {qr.secret}
          </p>
          <p className="text-sm text-gray-600">2. Saisissez le code affiché par l'application :</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="input w-40 text-center text-xl tracking-widest"
            required
          />
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Vérification..." : "Activer"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setMode("idle");
                setQr(null);
              }}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {mode === "idle" && enabled && (
        <button type="button" onClick={() => { setToken(""); setMode("disable"); }} className="btn-secondary">
          Désactiver la double authentification
        </button>
      )}

      {mode === "disable" && (
        <form onSubmit={confirmDisable} className="space-y-3">
          <p className="text-sm text-gray-600">
            Saisissez le code de votre application d'authentification pour confirmer la désactivation :
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="input w-40 text-center text-xl tracking-widest"
            required
          />
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Vérification..." : "Désactiver"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setMode("idle")}>
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
