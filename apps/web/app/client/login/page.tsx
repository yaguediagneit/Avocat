"use client";

import { useState } from "react";
import Link from "next/link";
import { AuroraBackground } from "@/components/landing/aurora";

export default function ClientLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/client/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    let data;
    try {
      data = await res.json();
    } catch {
      setLoading(false);
      setError(`Erreur serveur (${res.status}) — réponse non JSON`);
      return;
    }
    setLoading(false);
    if (!res.ok) {
      const message = data.detail
        ? `${data.error} — ${data.detail}`
        : data.error || "Identifiants invalides";
      setError(message);
      return;
    }
    // Navigation hard : invalide le Router Cache pour un rendu frais.
    window.location.href = "/client";
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cabinet-950 px-6 py-12 text-white">
      <AuroraBackground />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cabinet-950/0 via-cabinet-950/30 to-cabinet-950" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
            Espace client
          </h1>
          <p className="mt-2 text-sm text-cabinet-200/70">
            Consultez vos dossiers, documents et factures en toute sécurité.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cabinet-950/40 backdrop-blur-xl"
        >
          {error && (
            <div className="mb-5 rounded-md bg-red-100 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input w-full bg-cabinet-900/50 text-white placeholder:text-cabinet-300/50"
                placeholder="client@exemple.sn"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full bg-cabinet-900/50 text-white placeholder:text-cabinet-300/50"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="mt-3 text-right">
            <Link
              href="/forgot-password"
              className="text-xs text-cabinet-200/70 transition hover:text-gold-300"
            >
              Mot de passe oublié ?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-4 w-full py-3 text-base"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          <div className="mt-6 text-center text-sm text-cabinet-200/70">
            Vous travaillez dans le cabinet ?{" "}
            <Link href="/login" className="text-gold-300 hover:underline">
              Connexion interne
            </Link>
          </div>
        </form>

        <p className="mt-8 text-center text-xs text-cabinet-300/60">
          &copy; {new Date().getFullYear()} Tous droits réservés.
        </p>
        <p className="mt-2 pointer-events-none select-none text-center text-[10px] font-medium tracking-[0.2em] text-cabinet-300/25">
          Concepteur : yaguediagne.it@gmail.com | +221 77 514 74 41 | +221 77 712 61 39
        </p>
      </div>
    </main>
  );
}
