"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { AuroraBackground } from "@/components/landing/aurora";

function ResetVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Code invalide");
        return;
      }
      router.push(`/reset-password/new?email=${encodeURIComponent(email)}`);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cabinet-950 px-6 py-12 text-white">
      <AuroraBackground />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cabinet-950/0 via-cabinet-950/30 to-cabinet-950" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            <span className="text-gold-300">Avocat</span>.sn
          </Link>
          <h1 className="mt-6 font-display text-3xl font-medium tracking-tight md:text-4xl">
            Vérification 2FA
          </h1>
          <p className="mt-2 text-sm text-cabinet-200/70">
            Saisissez le code à 6 chiffres généré par votre application
            d&apos;authentification pour réinitialiser votre mot de passe.
          </p>
          {email && (
            <p className="mt-1 text-xs text-cabinet-300/60">{email}</p>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cabinet-950/40 backdrop-blur-xl"
        >
          {error && (
            <div className="mb-5 rounded-md bg-red-500/15 p-3 text-sm text-red-200">
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
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
              className="input w-full bg-cabinet-900/50 text-center text-2xl tracking-widest text-white placeholder:text-cabinet-300/50"
              placeholder="000000"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || token.length !== 6}
            className="btn-primary mt-6 w-full py-3 text-base"
          >
            {loading ? "Vérification..." : "Vérifier"}
          </button>

          <div className="mt-6 text-center text-sm text-cabinet-200/70">
            <Link href="/forgot-password" className="text-gold-300 hover:underline">
              Recommencer
            </Link>
          </div>
        </form>

        <p className="mt-8 text-center text-xs text-cabinet-300/60">
          &copy; {new Date().getFullYear()} Avocat.sn. Tous droits réservés.
        </p>
      </div>
    </main>
  );
}

export default function ResetVerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-cabinet-950 text-white">
          <p>Chargement...</p>
        </main>
      }
    >
      <ResetVerifyContent />
    </Suspense>
  );
}
