"use client";

import { useState } from "react";
import Link from "next/link";
import { AuroraBackground } from "@/components/landing/aurora";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenant, setTenant] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, tenant: tenant || undefined }),
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
    if (data.requiresMfa) {
      window.location.href = `/verify-mfa?email=${encodeURIComponent(email)}`;
    } else if (data.isClient) {
      // Navigation hard : invalide le Router Cache pour garantir un rendu
      // frais du layout avec la nouvelle session.
      window.location.href = "/client";
    } else {
      window.location.href = "/cabinet/dossiers";
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cabinet-950 px-6 py-12 text-white">
      <AuroraBackground />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cabinet-950/0 via-cabinet-950/30 to-cabinet-950" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
            Connexion cabinet
          </h1>
          <p className="mt-2 text-sm text-cabinet-200/70">
            Avocats, assistants, huissiers et fonctions administratives.
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
              <label className="mb-1 block text-sm font-medium">Cabinet (slug ou domaine)</label>
              <input
                type="text"
                value={tenant}
                onChange={(e) => setTenant(e.target.value)}
                className="input w-full bg-cabinet-900/50 text-white placeholder:text-cabinet-300/50"
                placeholder="mon-cabinet ou mon-cabinet.sn"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input w-full bg-cabinet-900/50 text-white placeholder:text-cabinet-300/50"
                placeholder="admin@cabinet.sn"
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
            Vous êtes client ?{" "}
            <Link href="/client/login" className="text-gold-300 hover:underline">
              Accéder à l'espace client
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
