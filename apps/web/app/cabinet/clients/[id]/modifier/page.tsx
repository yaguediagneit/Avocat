"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Representative {
  nom?: string;
  prenom?: string;
  raisonSociale?: string;
  fonction?: string;
  telephone?: string;
  email?: string;
}

export default function EditClientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState({
    type: "physique",
    raisonSociale: "",
    identifiant: "",
    adresse: "",
    telephone: "",
    email: "",
  });
  const [representants, setRepresentants] = useState<Representative[]>([]);

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Client non trouvé");
        return res.json();
      })
      .then((client) => {
        const coordonnees = client.coordonnees as Record<string, string> | null;
        setForm({
          type: client.type,
          raisonSociale: client.raisonSociale,
          identifiant: client.identifiant || "",
          adresse: client.adresse || "",
          telephone: coordonnees?.telephone || "",
          email: coordonnees?.email || "",
        });
        setRepresentants(client.representants || []);
      })
      .catch((err) => setGeneralError(err.message || "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, [id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setGeneralError("");
    setErrors({});

    const res = await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        coordonnees: { telephone: form.telephone, email: form.email },
        representants: representants.filter(
          (r) => r.nom || r.prenom || r.raisonSociale || r.fonction
        ),
      }),
    });

    setSaving(false);

    if (res.ok) {
      router.push(`/cabinet/clients/${id}`);
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (data?.error?.fieldErrors) {
      setErrors(data.error.fieldErrors);
      setGeneralError(data.error.formErrors?.[0] || "");
    } else if (typeof data.error === "string") {
      setGeneralError(data.error);
    } else {
      setGeneralError("Erreur lors de la mise à jour");
    }
  }

  function addRepresentant() {
    setRepresentants([...representants, {}]);
  }

  function updateRepresentant(index: number, field: keyof Representative, value: string) {
    const updated = [...representants];
    updated[index] = { ...updated[index], [field]: value };
    setRepresentants(updated);
  }

  function removeRepresentant(index: number) {
    setRepresentants(representants.filter((_, i) => i !== index));
  }

  function fieldError(name: string) {
    return errors[name]?.[0] ? (
      <p className="mt-1 text-xs text-red-600">{errors[name][0]}</p>
    ) : null;
  }

  if (loading) {
    return <p className="py-10 text-center text-gray-600">Chargement...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Modifier le client</h1>
        <Link href={`/cabinet/clients/${id}`} className="text-sm text-cabinet-700 hover:underline">
          ← Retour au client
        </Link>
      </div>

      <form onSubmit={onSubmit} className="card space-y-5">
        {generalError && (
          <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{generalError}</div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
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

          <div>
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
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Représentants</h3>
            <button
              type="button"
              onClick={addRepresentant}
              className="text-sm text-cabinet-700 hover:underline"
            >
              + Ajouter un représentant
            </button>
          </div>

          {representants.map((rep, index) => (
            <div key={index} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  placeholder="Nom"
                  value={rep.nom || ""}
                  onChange={(e) => updateRepresentant(index, "nom", e.target.value)}
                  className="input"
                />
                <input
                  placeholder="Prénom"
                  value={rep.prenom || ""}
                  onChange={(e) => updateRepresentant(index, "prenom", e.target.value)}
                  className="input"
                />
                <input
                  placeholder="Fonction"
                  value={rep.fonction || ""}
                  onChange={(e) => updateRepresentant(index, "fonction", e.target.value)}
                  className="input"
                />
                <input
                  placeholder="Téléphone"
                  value={rep.telephone || ""}
                  onChange={(e) => updateRepresentant(index, "telephone", e.target.value)}
                  className="input"
                />
                <div className="md:col-span-2 flex items-center gap-3">
                  <input
                    placeholder="E-mail"
                    type="email"
                    value={rep.email || ""}
                    onChange={(e) => updateRepresentant(index, "email", e.target.value)}
                    className="input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeRepresentant(index)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href={`/cabinet/clients/${id}`}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Annuler
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      </form>
    </div>
  );
}
