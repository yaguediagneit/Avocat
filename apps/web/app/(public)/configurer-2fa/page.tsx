"use client";

import { useEffect, useState } from "react";

/**
 * Page d'activation obligatoire du 2FA (TOTP) : génère le secret + QR code
 * au chargement, puis valide le premier code de l'application
 * d'authentification. Le middleware bloque tout accès tant que le compte
 * n'a pas de secret TOTP enregistré.
 */
export default function Configurer2FAPage() {
  const [qr, setQr] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/mfa/totp/setup", { method: "POST" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Impossible de générer le QR code.");
          return;
        }
        setQr({ qrDataUrl: data.qrDataUrl, secret: data.secret });
      })
      .catch(() => setError("Erreur réseau."))
      .finally(() => setSetupLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
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
    // Le middleware libère l'accès dès que le secret est enregistré.
    window.location.href = data.isClient ? "/client" : "/cabinet/dossiers";
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="card w-full max-w-md space-y-5">
        <h1 className="text-center text-xl font-bold">
          Activation de la double authentification
        </h1>
        <p className="text-center text-sm text-gray-600">
          La double authentification est obligatoire. Scannez le QR code avec
          Google Authenticator ou Microsoft Authenticator, puis saisissez le
          code à 6 chiffres affiché.
        </p>

        {error && <div className="rounded-md bg-red-100 p-2 text-sm text-red-700">{error}</div>}
        {setupLoading && <p className="text-center text-sm text-gray-500">Génération du QR code…</p>}

        {qr && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.qrDataUrl} alt="QR code TOTP" className="h-48 w-48 rounded border" />
            </div>
            <div>
              <p className="mb-1 text-xs text-gray-500">
                Impossible de scanner ? Saisissez cette clé manuellement :
              </p>
              <p className="select-all break-all rounded bg-gray-100 p-2 font-mono text-xs">
                {qr.secret}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Code de vérification</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="input w-full text-center text-2xl tracking-widest"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
              {loading ? "Vérification..." : "Activer"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
