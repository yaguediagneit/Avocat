"use client";

import { useEffect, useState } from "react";

type Commentaire = {
  id: string;
  auteurId: string;
  auteurNom: string;
  contenu: string;
  date: string;
};

export function ItemDiscussion({
  id,
  kind,
  onChange,
}: {
  id: string;
  kind: "tache" | "evenement";
  onChange?: (commentaires: unknown) => void;
}) {
  const [item, setItem] = useState<{ titre: string; commentaires: unknown } | null>(null);
  const [loading, setLoading] = useState(true);
  const [contenu, setContenu] = useState("");
  const [saving, setSaving] = useState(false);

  const url = `/api/${kind === "evenement" ? "evenements" : "taches"}/${id}`;

  useEffect(() => {
    fetch(url)
      .then((r) => r.json())
      .then((data) => setItem({ titre: data.titre, commentaires: data.commentaires }))
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [id, kind, url]);

  const commentaires = Array.isArray(item?.commentaires)
    ? (item.commentaires as Commentaire[])
    : [];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const c = contenu.trim();
    if (!c) return;
    setSaving(true);
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentaire: { contenu: c } }),
    });
    setSaving(false);
    if (res.ok) {
      setContenu("");
      const fresh = await fetch(url).then((r) => r.json());
      setItem({ titre: fresh.titre, commentaires: fresh.commentaires });
      onChange?.(fresh.commentaires);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Chargement...</p>;
  if (!item) return <p className="text-sm text-gray-500">Introuvable.</p>;

  return (
    <div className="space-y-4">
      {commentaires.length === 0 && (
        <p className="text-sm text-gray-500">Aucun commentaire.</p>
      )}
      <div className="max-h-80 space-y-3 overflow-y-auto">
        {commentaires.map((c) => (
          <div key={c.id} className="rounded border bg-gray-50 p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
              <span className="font-medium text-cabinet-800">{c.auteurNom}</span>
              <span>{new Date(c.date).toLocaleString("fr-FR")}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-gray-800">{c.contenu}</p>
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <textarea
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          placeholder="Ajouter un commentaire..."
          className="input min-h-[80px]"
          required
        />
        <button
          type="submit"
          disabled={saving || !contenu.trim()}
          className="btn-primary self-end"
        >
          {saving ? "Envoi..." : "Commenter"}
        </button>
      </form>
    </div>
  );
}
