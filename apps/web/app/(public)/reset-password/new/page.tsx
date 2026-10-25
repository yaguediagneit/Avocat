"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { AuroraBackground } from "@/components/landing/aurora";

function ResetNewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Erreur lors de la réinitialisation.");
        return;
      }
      setSuccess(true);
      // Redirection vers la page de login correspondante après 1,5s.
      setTimeout(() => {
        router.push(data.isClient ? "/client/login" : "/login");
      }, 1500);
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
            Nouveau mot de passe
          </h1>
          <p className="mt-2 text-sm text-cabinet-200/70">
            Choisissez un nouveau mot de passe pour votre compte.
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
          {success && (
            <div className="mb-5 rounded-md bg-emerald-500/15 p-3 text-sm text-emerald-200">
              Votre mot de passe a été réinitialisé. Redirection vers la
              connexion...
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full bg-cabinet-900/50 text-white placeholder:text-cabinet-300/50"
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input w-full bg-cabinet-900/50 text-white placeholder:text-cabinet-300/50"
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="btn-primary mt-6 w-full py-3 text-base"
          >
            {loading ? "Enregistrement..." : "Réinitialiser le mot de passe"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-cabinet-300/60">
          &copy; {new Date().getFullYear()} Avocat.sn. Tous droits réservés.
        </p>
      </div>
    </main>
  );
}

export default function ResetNewPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-cabinet-950 text-white">
          <p>Chargement...</p>
        </main>
      }
    >
      <ResetNewContent />
    </Suspense>
  );
}
