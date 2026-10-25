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

interface EvenementData {
  id: string;
  dossierId: string | null;
  type: string;
  titre: string;
  dateDebut: Date;
  dateFin: Date | null;
  lieu: string | null;
  estPublicClient: boolean;
  commentaires: unknown;
}

interface Commentaire {
  id: string;
  auteurId: string;
  auteurNom: string;
  contenu: string;
  date: string;
}

interface EvenementEditFormProps {
  evenement: EvenementData;
  dossiers: DossierOption[];
}

export function EvenementEditForm({ evenement, dossiers }: EvenementEditFormProps) {
  const router = useRouter();
  const [dossierQuery, setDossierQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  const commentaires = useMemo<Commentaire[]>(() => {
    return Array.isArray(evenement.commentaires) ? (evenement.commentaires as Commentaire[]) : [];
  }, [evenement.commentaires]);

  async function ajouterCommentaire(e: React.FormEvent) {
    e.preventDefault();
    const contenu = commentaire.trim();
    if (!contenu) return;
    setSavingComment(true);
    setError("");
    const res = await fetch(`/api/evenements/${evenement.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentaire: { contenu } }),
    });
    setSavingComment(false);
    if (res.ok) {
      setCommentaire("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Erreur lors de l'ajout du commentaire");
    }
  }

  const [form, setForm] = useState({
    dossierId: evenement.dossierId || "",
    type: evenement.type,
    titre: evenement.titre,
    dateDebut: new Date(evenement.dateDebut).toISOString().slice(0, 16),
    dateFin: evenement.dateFin ? new Date(evenement.dateFin).toISOString().slice(0, 16) : "",
    lieu: evenement.lieu || "",
    estPublicClient: evenement.estPublicClient,
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
      dossierId: form.dossierId || null,
      dateDebut: new Date(form.dateDebut).toISOString(),
      dateFin: form.dateFin ? new Date(form.dateFin).toISOString() : null,
    };

    const res = await fetch(`/api/evenements/${evenement.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/cabinet/calendrier");
      return;
    }

    const data = await res.json().catch(() => ({}));
    setError(typeof data.error === "string" ? data.error : "Erreur lors de la mise à jour");
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      <div>
        <label className="mb-1 block text-sm font-medium">
          Dossier <span className="font-normal text-gray-500">(optionnel)</span>
        </label>
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
        <label className="mb-1 block text-sm font-medium">Type</label>
        <ParametreSelect
          categorie="type_evenement"
          value={form.type}
          onChange={(value) => setForm({ ...form, type: value })}
        />
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

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Début</label>
          <input
            type="datetime-local"
            value={form.dateDebut}
            onChange={(e) => setForm({ ...form, dateDebut: e.target.value })}
            className="input"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Fin (optionnel)</label>
          <input
            type="datetime-local"
            value={form.dateFin}
            onChange={(e) => setForm({ ...form, dateFin: e.target.value })}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Lieu</label>
        <input
          type="text"
          value={form.lieu}
          onChange={(e) => setForm({ ...form, lieu: e.target.value })}
          className="input"
          placeholder="Tribunal, cabinet, client..."
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.estPublicClient}
          onChange={(e) => setForm({ ...form, estPublicClient: e.target.checked })}
          id="estPublicClient"
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="estPublicClient" className="text-sm">
          Visible dans l&apos;espace client
        </label>
      </div>

      <div className="space-y-3 border-t pt-5">
        <h3 className="text-sm font-semibold text-cabinet-900">Commentaires</h3>
        <div className="max-h-72 space-y-3 overflow-y-auto">
          {commentaires.length === 0 && (
            <p className="text-sm text-gray-500">Aucun commentaire pour cet événement.</p>
          )}
          {commentaires.map((c) => (
            <div key={c.id} className="rounded border bg-white p-3">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-gray-500">
                <span className="font-medium text-cabinet-800">{c.auteurNom}</span>
                <span>{new Date(c.date).toLocaleString("fr-FR")}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-800">{c.contenu}</p>
            </div>
          ))}
        </div>

        <form onSubmit={ajouterCommentaire} className="flex flex-col gap-2 pt-2">
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Ajouter un commentaire..."
            className="input min-h-[80px]"
            required
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingComment || !commentaire.trim()}
              className="btn-primary"
            >
              {savingComment ? "Envoi..." : "Commenter"}
            </button>
          </div>
        </form>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <Link href="/cabinet/calendrier" className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
          Annuler
        </Link>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Enregistrement..." : "Enregistrer les modifications"}
        </button>
      </div>
    </form>
  );
}
