"use client";

import { useState } from "react";

const RULES = [
  { label: "Au moins 10 caractères", test: (p: string) => p.length >= 10 },
  { label: "Une lettre majuscule", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Une lettre minuscule", test: (p: string) => /[a-z]/.test(p) },
  { label: "Un chiffre", test: (p: string) => /[0-9]/.test(p) },
  { label: "Un caractère spécial", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function ChangerMotDePassePage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!RULES.every((r) => r.test(password))) {
      setError("Le nouveau mot de passe ne respecte pas les règles de sécurité.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/profil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(
        typeof data.error === "string"
          ? data.error
          : data.error?.fieldErrors?.password?.[0] ||
              data.error?.fieldErrors?.currentPassword?.[0] ||
              "Erreur lors du changement de mot de passe."
      );
      return;
    }
    window.location.href = data.isClient ? "/client" : "/cabinet/dossiers";
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-4">
        <h1 className="text-center text-xl font-bold">Changement de mot de passe requis</h1>
        <p className="text-center text-sm text-gray-600">
          Votre mot de passe ne respecte pas les règles de sécurité en vigueur.
          Définissez-en un nouveau pour continuer.
        </p>
        {error && <div className="rounded-md bg-red-100 p-2 text-sm text-red-700">{error}</div>}
        <div>
          <label className="mb-1 block text-sm font-medium">Mot de passe actuel</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input w-full"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Nouveau mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input w-full"
            required
            minLength={10}
          />
          <ul className="mt-2 space-y-1">
            {RULES.map((r) => {
              const ok = r.test(password);
              return (
                <li key={r.label} className={`text-xs ${ok ? "text-emerald-600" : "text-gray-400"}`}>
                  {ok ? "✓" : "•"} {r.label}
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Confirmer le nouveau mot de passe</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input w-full"
            required
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Enregistrement..." : "Changer le mot de passe"}
        </button>
      </form>
    </main>
  );
}
