"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ClientCreated {
  id: string;
  raisonSociale: string;
  type: string;
}

interface ClientCreateDialogProps {
  open: boolean;
  onClose: () => void;
  /// Appelé après création réussie avec le client créé.
  onCreated: (client: ClientCreated) => void;
}

const EMPTY_FORM = {
  type: "physique",
  raisonSociale: "",
  identifiant: "",
  telephone: "",
  email: "",
  adresse: "",
};

export function ClientCreateDialog({ open, onClose, onCreated }: ClientCreateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setGeneralError("");
      setErrors({});
    }
  }, [open]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Le portail propage les événements dans l'arbre React : sans stopPropagation,
    // ce submit remonterait jusqu'au <form> parent (ex. formulaire dossier).
    e.stopPropagation();
    setLoading(true);
    setGeneralError("");
    setErrors({});

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        raisonSociale: form.raisonSociale,
        identifiant: form.identifiant,
        adresse: form.adresse,
        coordonnees: { telephone: form.telephone, email: form.email },
      }),
    });

    setLoading(false);

    if (res.ok) {
      const client = (await res.json()) as ClientCreated;
      setForm(EMPTY_FORM);
      onCreated({ id: client.id, raisonSociale: client.raisonSociale, type: client.type });
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (data?.error?.fieldErrors) {
      setErrors(data.error.fieldErrors);
      setGeneralError(data.error.formErrors?.[0] || "");
    } else if (typeof data.error === "string") {
      setGeneralError(data.error);
    } else {
      setGeneralError("Erreur lors de la création du client");
    }
  }

  function fieldError(name: string) {
    return errors[name]?.[0] ? (
      <p className="mt-1 text-xs text-red-600">{errors[name][0]}</p>
    ) : null;
  }

  // Rendu via portail : la modale contient son propre <form>, qui ne doit pas
  // être imbriqué dans le formulaire appelant (ex. formulaire dossier).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-xl font-bold text-cabinet-900">Nouveau client</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-gray-500 hover:text-gray-700"
            aria-label="Fermer"
          >
            &times;
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {generalError && (
            <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{generalError}</div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="input"
              >
                <option value="physique">Physique</option>
                <option value="entreprise">Entreprise</option>
                <option value="administration">Administration</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Nom / Raison sociale</label>
              <input
                value={form.raisonSociale}
                onChange={(e) => setForm({ ...form, raisonSociale: e.target.value })}
                className="input"
                required
                autoFocus
              />
              {fieldError("raisonSociale")}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Identifiant (optionnel)</label>
              <input
                value={form.identifiant}
                onChange={(e) => setForm({ ...form, identifiant: e.target.value })}
                className="input"
                placeholder="NINEA, CNI, etc."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Téléphone</label>
              <input
                type="tel"
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                className="input"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
              />
              {fieldError("email")}
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Adresse</label>
              <textarea
                value={form.adresse}
                onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                className="input"
                rows={2}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Annuler
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Enregistrement..." : "Enregistrer le client"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
