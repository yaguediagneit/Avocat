"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ParametreSelect } from "@/components/parametre-select";

interface DossierOption {
  id: string;
  referenceInterne: string;
  client?: { raisonSociale: string } | null;
}

interface UserOption {
  id: string;
  prenom: string;
  nom: string;
  titre?: string | null;
}

interface TacheData {
  id: string;
  dossierId: string;
  titre: string;
  description: string | null;
  responsableId: string;
  echeance: Date | null;
  priorite: string;
  statut: string;
}

interface TacheEditFormProps {
  tache: TacheData;
  dossiers: DossierOption[];
  users: UserOption[];
  currentUserId: string;
}

export function TacheEditForm({ tache, dossiers, users, currentUserId }: TacheEditFormProps) {
  const router = useRouter();
  const [dossierQuery, setDossierQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    dossierId: tache.dossierId,
    titre: tache.titre,
    description: tache.description || "",
    responsableId: tache.responsableId,
    echeance: tache.echeance ? new Date(tache.echeance).toISOString().slice(0, 16) : "",
    priorite: tache.priorite,
    statut: tache.statut,
  });

  const filteredDossiers = useMemo(() => {
    const q = dossierQuery.trim().toLowerCase();
    if (!q) return dossiers;
    return dossiers.filter(
      (d) =>
        d.referenceInterne.toLowerCase().includes(q) ||
        d.client?.raisonSociale?.toLowerCase().includes(q)
    );
  }, [dossiers, dossierQuery]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body = {
      ...form,
      echeance: form.echeance ? new Date(form.echeance).toISOString() : null,
    };

    const res = await fetch(`/api/taches/${tache.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/cabinet/taches");
      return;
    }

    const data = await res.json().catch(() => ({}));
    setError(typeof data.error === "string" ? data.error : "Erreur lors de la mise à jour");
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      <div>
        <label className="mb-1 block text-sm font-medium">Dossier</label>
        <input
          type="text"
          value={dossierQuery}
          onChange={(e) => {
            setDossierQuery(e.target.value);
            setForm((f) => ({ ...f, dossierId: "" }));
          }}
          className="input mb-2"
          placeholder="Rechercher un dossier..."
        />
        <select
          value={form.dossierId}
          onChange={(e) => setForm({ ...form, dossierId: e.target.value })}
          className="input"
          required
          size={Math.min(5, filteredDossiers.length + 1)}
        >
          <option value="">Sélectionner un dossier</option>
          {filteredDossiers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.referenceInterne} {d.client?.raisonSociale ? `— ${d.client.raisonSociale}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Responsable</label>
          <select
            value={form.responsableId}
            onChange={(e) => setForm({ ...form, responsableId: e.target.value })}
            className="input"
            required
          >
            <option value="">Sélectionner</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.titre ? `${u.titre} ` : ""}{u.prenom} {u.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Priorité</label>
          <ParametreSelect
            categorie="priorite_tache"
            value={form.priorite}
            onChange={(value) => setForm({ ...form, priorite: value })}
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Statut</label>
          <select
            value={form.statut}
            onChange={(e) => setForm({ ...form, statut: e.target.value })}
            className="input"
            required
          >
            <option value="À faire">À faire</option>
            <option value="En cours">En cours</option>
            <option value="Terminée">Terminée</option>
            <option value="Annulée">Annulée</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Échéance</label>
          <input
            type="datetime-local"
            value={form.echeance}
            onChange={(e) => setForm({ ...form, echeance: e.target.value })}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Titre</label>
        <input
          type="text"
          value={form.titre}
          onChange={(e) => setForm({ ...form, titre: e.target.value })}
          className="input"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input"
          rows={3}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <Link href="/cabinet/taches" className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
          Annuler
        </Link>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Enregistrement..." : "Enregistrer les modifications"}
        </button>
      </div>
    </form>
  );
}
