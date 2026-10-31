"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function VerifyMfaPageContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const method = searchParams.get("method") || "email";
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/verify-mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Code invalide");
      return;
    }
    if (data.passwordChangeRequired) {
      window.location.href = "/changer-mot-de-passe";
    } else if (data.totpSetupRequired) {
      window.location.href = "/configurer-2fa";
    } else if (data.isClient) {
      // Navigation hard : invalide le Router Cache pour un rendu frais.
      window.location.href = "/client";
    } else {
      window.location.href = "/cabinet/dossiers";
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-center text-xl font-bold">Vérification MFA</h1>
        <p className="text-center text-sm text-gray-600">
          {method === "totp"
            ? "Saisissez le code à 6 chiffres de votre application d'authentification (Google ou Microsoft Authenticator)."
            : "Saisissez le code à 6 chiffres envoyé à votre adresse e-mail."}
        </p>
        <p className="text-center text-xs text-gray-500">{email}</p>
        {error && (
          <div className="rounded-md bg-red-100 p-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">Code TOTP</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="input text-center text-2xl tracking-widest"
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full">
          Vérifier
        </button>
      </form>
    </main>
  );
}

export default function VerifyMfaPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center"><p>Chargement...</p></main>}>
      <VerifyMfaPageContent />
    </Suspense>
  );
}
