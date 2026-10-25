"use client";

import { useState, useEffect, useCallback } from "react";

interface Commentaire {
  id: string;
  auteurId: string;
  auteurNom: string;
  message: string;
  type: string;
  createdAt: string;
}

interface FilDiscussionProps {
  dossierId: string;
  currentUserId: string;
}

const TYPE_LABELS: Record<string, string> = {
  commentaire: "Commentaire",
  decision: "Décision",
  note_interne: "Note interne",
};

const TYPE_BADGES: Record<string, string> = {
  commentaire: "bg-cabinet-100 text-cabinet-700",
  decision: "bg-emerald-100 text-emerald-700",
  note_interne: "bg-amber-100 text-amber-700",
};

export function FilDiscussion({ dossierId, currentUserId }: FilDiscussionProps) {
  const [commentaires, setCommentaires] = useState<Commentaire[]>([]);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<string>("commentaire");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCommentaires = useCallback(async () => {
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/commentaires`);
      if (res.ok) {
        const data = await res.json();
        setCommentaires(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [dossierId]);

  useEffect(() => {
    loadCommentaires();
  }, [loadCommentaires]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/dossiers/${dossierId}/commentaires`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), type }),
      });

      if (!res.ok) {
        let msg = "Erreur lors de l'envoi du message.";
        try {
          const data = await res.json();
          if (data?.error) {
            msg = typeof data.error === "string" ? data.error : JSON.stringify(data.error);
          } else {
            msg = `Erreur ${res.status}${res.statusText ? ` : ${res.statusText}` : ""}`;
          }
        } catch {
          msg = `Erreur ${res.status}`;
        }
        setError(msg);
        return;
      }

      const nouveau: Commentaire = await res.json();
      setCommentaires((prev) => [...prev, nouveau]);
      setMessage("");
      setType("commentaire");
    } catch (err) {
      console.error(err);
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Fil de discussion</h2>
        <p className="text-sm text-gray-600">
          Toutes les communications internes relatives à ce dossier restent ici.
        </p>
      </div>

      {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      <div className="max-h-96 space-y-3 overflow-y-auto rounded-md border border-gray-100 bg-gray-50 p-4">
        {commentaires.length === 0 && (
          <p className="text-center text-sm text-gray-500">
            Aucun message pour le moment. Démarrez la conversation ci-dessous.
          </p>
        )}
        {commentaires.map((c) => {
          const isOwn = c.auteurId === currentUserId;
          return (
            <div
              key={c.id}
              className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  isOwn
                    ? "bg-cabinet-700 text-white"
                    : "bg-white border border-gray-200"
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className={`text-xs font-medium ${isOwn ? "text-cabinet-200" : "text-gray-600"}`}>
                    {c.auteurNom}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      isOwn
                        ? "bg-white/20 text-white"
                        : TYPE_BADGES[c.type] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {TYPE_LABELS[c.type] || c.type}
                  </span>
                </div>
                <p className={`text-sm whitespace-pre-wrap ${isOwn ? "text-white" : "text-gray-800"}`}>
                  {c.message}
                </p>
                <p className={`mt-1 text-[10px] ${isOwn ? "text-cabinet-200" : "text-gray-400"}`}>
                  {new Date(c.createdAt).toLocaleString("fr-FR")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="input max-w-[160px]"
          >
            {Object.entries(TYPE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            className="input flex-1"
            placeholder="Saisissez votre message..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                onSubmit(e as any);
              }
            }}
          />
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="btn-primary self-end"
          >
            {loading ? "..." : "Envoyer"}
          </button>
        </div>
        <p className="text-xs text-gray-400">Ctrl+Entrée pour envoyer rapidement.</p>
      </form>
    </div>
  );
}
