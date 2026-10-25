"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { AuroraBackground } from "@/components/landing/aurora";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Erreur lors de la demande.");
        return;
      }
      // Si le compte existe et dispose d'un MFA, on passe à la vérification.
      // Sinon on affiche quand même un message neutre pour éviter le user enumeration.
      if (data.requiresMfa) {
        router.push(`/reset-password/verify?email=${encodeURIComponent(data.email || email)}`);
      } else {
        setError(
          "Si ce compte existe et dispose d'une authentification à deux facteurs, un code vous sera demandé à l'étape suivante."
        );
      }
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
            Mot de passe oublié
          </h1>
          <p className="mt-2 text-sm text-cabinet-200/70">
            Saisissez votre e-mail. La réinitialisation est protégée par votre
            authentification à deux facteurs (TOTP).
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cabinet-950/40 backdrop-blur-xl"
        >
          {error && (
            <div className="mb-5 rounded-md bg-cabinet-800/60 p-3 text-sm text-cabinet-100">
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
                placeholder="vous@cabinet.sn"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-6 w-full py-3 text-base"
          >
            {loading ? "Envoi..." : "Continuer"}
          </button>

          <div className="mt-6 text-center text-sm text-cabinet-200/70">
            <Link href="/login" className="text-gold-300 hover:underline">
              Retour à la connexion cabinet
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
