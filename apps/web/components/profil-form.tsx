"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ProfilFormProps {
  initialUser: {
    prenom: string;
    nom: string;
    titre: string;
    specialite: string;
    email: string;
    role: string;
    isClient: boolean;
  };
}

export function ProfilForm({ initialUser }: ProfilFormProps) {
  const router = useRouter();

  const [info, setInfo] = useState({
    prenom: initialUser.prenom,
    nom: initialUser.nom,
    titre: initialUser.titre || "",
    specialite: initialUser.specialite || "",
    email: initialUser.email,
  });
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState("");
  const [infoSuccess, setInfoSuccess] = useState("");

  const [pwd, setPwd] = useState({
    currentPassword: "",
    password: "",
    confirmPassword: "",
  });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");

  function extractError(data: any, fallback: string) {
    return (
      data?.error?.fieldErrors?.currentPassword?.[0] ||
      data?.error?.formErrors?.[0] ||
      (typeof data?.error === "string" ? data.error : fallback)
    );
  }

  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!info.prenom.trim() || !info.nom.trim() || !info.email.trim()) {
      setInfoError("Le prénom, le nom et l'email sont obligatoires.");
      return;
    }

    setInfoLoading(true);
    setInfoError("");
    setInfoSuccess("");

    try {
      const res = await fetch("/api/auth/profil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prenom: info.prenom.trim(),
          nom: info.nom.trim(),
          titre: info.titre.trim(),
          specialite: info.specialite.trim(),
          email: info.email.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInfoError(extractError(data, "Erreur lors de l'enregistrement."));
        return;
      }
      setInfoSuccess("Vos informations ont été mises à jour.");
      router.refresh();
    } catch {
      setInfoError("Erreur réseau.");
    } finally {
      setInfoLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.password.length < 8) {
      setPwdError("Le nouveau mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (pwd.password !== pwd.confirmPassword) {
      setPwdError("Les mots de passe ne correspondent pas.");
      return;
    }

    setPwdLoading(true);
    setPwdError("");
    setPwdSuccess("");

    try {
      const res = await fetch("/api/auth/profil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: pwd.currentPassword,
          password: pwd.password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwdError(extractError(data, "Erreur lors du changement de mot de passe."));
        return;
      }
      setPwdSuccess("Votre mot de passe a été modifié.");
      setPwd({ currentPassword: "", password: "", confirmPassword: "" });
    } catch {
      setPwdError("Erreur réseau.");
    } finally {
      setPwdLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card">
        <h2 className="mb-1 text-lg font-semibold">Mes informations</h2>
        <p className="mb-4 text-sm text-gray-500">
          Rôle : <span className="font-medium text-cabinet-700">{initialUser.role}</span>
        </p>

        {infoError && (
          <div className="mb-4 rounded-md bg-red-100 p-3 text-sm text-red-700">{infoError}</div>
        )}
        {infoSuccess && (
          <div className="mb-4 rounded-md bg-emerald-100 p-3 text-sm text-emerald-700">
            {infoSuccess}
          </div>
        )}

        <form onSubmit={handleInfoSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Prénom</label>
              <input
                type="text"
                value={info.prenom}
                onChange={(e) => setInfo((i) => ({ ...i, prenom: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nom</label>
              <input
                type="text"
                value={info.nom}
                onChange={(e) => setInfo((i) => ({ ...i, nom: e.target.value }))}
                className="input"
                required
              />
            </div>
          </div>

          {!initialUser.isClient && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Titre</label>
                <input
                  type="text"
                  value={info.titre}
                  onChange={(e) => setInfo((i) => ({ ...i, titre: e.target.value }))}
                  className="input"
                  placeholder="Ex. Avocat, Huissier"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Spécialité</label>
                <input
                  type="text"
                  value={info.specialite}
                  onChange={(e) => setInfo((i) => ({ ...i, specialite: e.target.value }))}
                  className="input"
                  placeholder="Ex. Droit civil"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              value={info.email}
              onChange={(e) => setInfo((i) => ({ ...i, email: e.target.value }))}
              className="input"
              required
            />
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={infoLoading} className="btn-primary">
              {infoLoading ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="mb-1 text-lg font-semibold">Changer mon mot de passe</h2>
        <p className="mb-4 text-sm text-gray-500">
          Saisissez votre mot de passe actuel pour confirmer le changement.
        </p>

        {pwdError && (
          <div className="mb-4 rounded-md bg-red-100 p-3 text-sm text-red-700">{pwdError}</div>
        )}
        {pwdSuccess && (
          <div className="mb-4 rounded-md bg-emerald-100 p-3 text-sm text-emerald-700">
            {pwdSuccess}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Mot de passe actuel</label>
            <input
              type="password"
              value={pwd.currentPassword}
              onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))}
              className="input"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nouveau mot de passe</label>
            <input
              type="password"
              value={pwd.password}
              onChange={(e) => setPwd((p) => ({ ...p, password: e.target.value }))}
              className="input"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={pwd.confirmPassword}
              onChange={(e) => setPwd((p) => ({ ...p, confirmPassword: e.target.value }))}
              className="input"
              required
            />
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={pwdLoading} className="btn-primary">
              {pwdLoading ? "Modification..." : "Changer le mot de passe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
