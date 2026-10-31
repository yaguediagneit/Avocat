"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuroraBackground } from "@/components/landing/aurora";

const RULES = [
  { label: "Au moins 10 caractères", test: (p: string) => p.length >= 10 },
  { label: "Une lettre majuscule", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Une lettre minuscule", test: (p: string) => /[a-z]/.test(p) },
  { label: "Un chiffre", test: (p: string) => /[0-9]/.test(p) },
  { label: "Un caractère spécial", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function InvitationContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = decodeURIComponent(String(params?.token || ""));
  const tenant = searchParams.get("t") || "";

  const [status, setStatus] = useState<"loading" | "ready" | "invalid" | "done">("loading");
  const [invite, setInvite] = useState<{ prenom: string; nom: string; email: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/invitation?token=${encodeURIComponent(token)}&t=${encodeURIComponent(tenant)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Lien invalide ou expiré.");
          setStatus("invalid");
          return;
        }
        setInvite(data);
        setStatus("ready");
      })
      .catch(() => {
        setError("Erreur réseau.");
        setStatus("invalid");
      });
  }, [token, tenant]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!RULES.every((r) => r.test(password))) {
      setError("Le mot de passe ne respecte pas les règles de sécurité.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, tenant, password, confirmPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Erreur lors de l'enregistrement.");
      return;
    }
    setIsClient(Boolean(data.isClient));
    setStatus("done");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cabinet-950 px-6 py-12 text-white">
      <AuroraBackground />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
            Bienvenue
          </h1>
          {invite && (
            <p className="mt-2 text-sm text-cabinet-200/70">
              {invite.prenom} {invite.nom} — {invite.email}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-cabinet-950/40 backdrop-blur-xl">
          {status === "loading" && <p className="text-center text-sm">Vérification du lien…</p>}

          {(status === "invalid" || error) && status !== "done" && (
            <div className="rounded-md bg-red-500/15 p-3 text-sm text-red-200">{error}</div>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-cabinet-200/70">
                Définissez votre mot de passe pour activer votre compte.
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input w-full bg-cabinet-900/50 text-white placeholder:text-cabinet-300/50"
                  minLength={10}
                  required
                />
                <ul className="mt-2 space-y-1">
                  {RULES.map((r) => {
                    const ok = r.test(password);
                    return (
                      <li key={r.label} className={`text-xs ${ok ? "text-emerald-300" : "text-cabinet-300/50"}`}>
                        {ok ? "✓" : "•"} {r.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Confirmer le mot de passe</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input w-full bg-cabinet-900/50 text-white placeholder:text-cabinet-300/50"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
                {loading ? "Enregistrement..." : "Activer mon compte"}
              </button>
            </form>
          )}

          {status === "done" && (
            <div className="space-y-4 text-center">
              <div className="rounded-md bg-emerald-500/15 p-3 text-sm text-emerald-200">
                Votre mot de passe a été enregistré. Vous pouvez vous connecter.
              </div>
              <a
                href={isClient ? "/client/login" : "/login"}
                className="btn-primary inline-block w-full py-3 text-center text-base"
              >
                Se connecter
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function InvitationPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-cabinet-950 text-white"><p>Chargement...</p></main>}>
      <InvitationContent />
    </Suspense>
  );
}
