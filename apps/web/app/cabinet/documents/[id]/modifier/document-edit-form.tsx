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

interface DocumentData {
  id: string;
  dossierId: string;
  nom: string;
  categorie: string;
  publieClient: boolean;
  partageExterne: boolean;
}

interface DocumentEditFormProps {
  document: DocumentData;
  dossiers: DossierOption[];
}

export function DocumentEditForm({ document, dossiers }: DocumentEditFormProps) {
  const router = useRouter();
  const [dossierQuery, setDossierQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    dossierId: document.dossierId,
    nom: document.nom,
    categorie: document.categorie,
    publieClient: document.publieClient,
    partageExterne: document.partageExterne,
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

    const res = await fetch(`/api/documents/${document.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/cabinet/documents");
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

      <div>
        <label className="mb-1 block text-sm font-medium">Catégorie</label>
        <ParametreSelect
          categorie="categorie_document"
          value={form.categorie}
          onChange={(value) => setForm({ ...form, categorie: value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Nom du document</label>
        <input
          type="text"
          value={form.nom}
          onChange={(e) => setForm({ ...form, nom: e.target.value })}
          className="input"
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.publieClient}
          onChange={(e) => setForm({ ...form, publieClient: e.target.checked })}
          id="publieClient"
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="publieClient" className="text-sm">
          Publié dans l&apos;espace client
        </label>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.partageExterne}
          onChange={(e) => setForm({ ...form, partageExterne: e.target.checked })}
          id="partageExterne"
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="partageExterne" className="text-sm">
          Partagé avec le huissier et les collaborateurs externes du dossier
        </label>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <Link href="/cabinet/documents" className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
          Annuler
        </Link>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Enregistrement..." : "Enregistrer les modifications"}
        </button>
      </div>
    </form>
  );
}
