"use client";

import { useState } from "react";

interface AdminUnlockButtonProps {
  /** Fonction appelée après authentification admin réussie. */
  onUnlock: () => void;
  /** Style compact (icône seule). */
  compact?: boolean;
}

/**
 * Bouton « Réactiver » : demande l'email et le mot de passe d'un admin
 * pour déverrouiller les actions d'une tâche terminée.
 *
 * Vérifie les credentials via /api/auth/login. Si l'authentification
 * réussit et que l'utilisateur est admin, on déverrouille les actions.
 */
export function AdminUnlockButton({ onUnlock, compact = false }: AdminUnlockButtonProps) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Identifiants invalides");
        return;
      }

      // Succès : déverrouiller
      setShowForm(false);
      setEmail("");
      setPassword("");
      onUnlock();
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="text-gray-400 transition-colors hover:text-gray-600"
          aria-label="Réactiver (admin)"
          title="Réactiver les actions (admin)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </button>
        {showForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowForm(false)}
          >
            <form
              className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleSubmit}
            >
              <h3 className="mb-4 text-lg font-semibold">Réactiver les actions</h3>
              <p className="mb-4 text-sm text-gray-600">
                Cette tâche est terminée. Saisissez les identifiants d'un
                administrateur pour réactiver les actions.
              </p>
              {error && (
                <div className="mb-3 rounded-md bg-red-100 p-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Email admin</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Mot de passe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    required
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? "Vérification..." : "Réactiver"}
                </button>
              </div>
            </form>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowForm((s) => !s)}
        className="text-xs font-medium text-gray-500 hover:text-gray-700"
      >
        🔒 Réactiver (admin)
      </button>
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
          >
            <h3 className="mb-4 text-lg font-semibold">Réactiver les actions</h3>
            <p className="mb-4 text-sm text-gray-600">
              Cette tâche est terminée. Saisissez les identifiants d'un
              administrateur pour réactiver les actions.
            </p>
            {error && (
              <div className="mb-3 rounded-md bg-red-100 p-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Email admin</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? "Vérification..." : "Réactiver"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
