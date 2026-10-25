"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ItemDiscussion } from "@/components/item-discussion";

type EvenementDetail = {
  id: string;
  type: string;
  titre: string;
  dateDebut: string;
  dateFin: string | null;
  lieu: string | null;
  dossier: { referenceInterne: string } | null;
  estPublicClient: boolean;
  createurId: string | null;
  createurNom?: string;
  commentaires: unknown;
};

type TacheDetail = {
  id: string;
  titre: string;
  description: string | null;
  echeance: string | null;
  priorite: string;
  statut: string;
  dossier: { referenceInterne: string } | null;
  createurId: string;
  createurNom?: string;
  responsableId: string;
  responsableNom?: string;
  commentaires: unknown;
};

type Item = ({ kind: "evenement" } & EvenementDetail) | ({ kind: "tache" } & TacheDetail);

function formatPlage(d: string, f: string | null) {
  const debut = new Date(d).toLocaleString("fr-FR");
  if (!f) return debut;
  return `${debut} → ${new Date(f).toLocaleString("fr-FR")}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleString("fr-FR");
}

export function CalendrierModal({
  id,
  kind,
  currentUserId,
  estAdmin,
  onClose,
  onCommentChange,
}: {
  id: string;
  kind: "evenement" | "tache";
  currentUserId: string;
  estAdmin: boolean;
  onClose: () => void;
  onCommentChange?: (id: string, kind: "evenement" | "tache", commentaires: unknown) => void;
}) {
  const [item, setItem] = useState<Item | null>(null);
  const [tab, setTab] = useState<"detail" | "commentaires">("detail");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = kind === "evenement" ? `/api/evenements/${id}` : `/api/taches/${id}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => setItem({ ...data, kind }))
      .catch(() => setItem(null))
      .finally(() => setLoading(false));
  }, [id, kind]);

  const canEdit =
    estAdmin ||
    (item?.kind === "evenement" && item.createurId === currentUserId) ||
    (item?.kind === "tache" &&
      (item.createurId === currentUserId || item.responsableId === currentUserId));

  function renderDetail() {
    if (!item) return null;

    if (item.kind === "tache") {
      return (
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <span className="font-medium">Statut :</span> {item.statut}
          </p>
          <p>
            <span className="font-medium">Priorité :</span> {item.priorite}
          </p>
          {item.echeance && (
            <p>
              <span className="font-medium">Échéance :</span> {formatDate(item.echeance)}
            </p>
          )}
          {item.responsableNom && (
            <p>
              <span className="font-medium">Responsable :</span> {item.responsableNom}
            </p>
          )}
          {item.createurNom && (
            <p>
              <span className="font-medium">Créé par :</span> {item.createurNom}
            </p>
          )}
          {item.description && (
            <p>
              <span className="font-medium">Description :</span> {item.description}
            </p>
          )}
          {item.dossier && (
            <p>
              <span className="font-medium">Dossier :</span> {item.dossier.referenceInterne}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2 text-sm text-gray-700">
        <p>
          <span className="font-medium">Type :</span> {item.type}
        </p>
        <p>
          <span className="font-medium">Quand :</span> {formatPlage(item.dateDebut, item.dateFin)}
        </p>
        {item.lieu && (
          <p>
            <span className="font-medium">Lieu :</span> {item.lieu}
          </p>
        )}
        {item.createurNom && (
          <p>
            <span className="font-medium">Créé par :</span> {item.createurNom}
          </p>
        )}
        {item.dossier && (
          <p>
            <span className="font-medium">Dossier :</span> {item.dossier.referenceInterne}
          </p>
        )}
        <p>
          <span className="font-medium">Public client :</span>{" "}
          {item.estPublicClient ? "Oui" : "Non"}
        </p>
      </div>
    );
  }

  const modifierHref =
    item?.kind === "tache"
      ? `/cabinet/taches/${id}/modifier`
      : `/cabinet/calendrier/${id}/modifier`;

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          Chargement...
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          Introuvable.
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-xl font-bold text-cabinet-900">{item.titre}</h2>
          <button
            onClick={onClose}
            className="text-2xl text-gray-500 hover:text-gray-700"
            aria-label="Fermer"
          >
            &times;
          </button>
        </div>

        <div className="mb-4 flex border-b">
          <button
            onClick={() => setTab("detail")}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "detail"
                ? "border-b-2 border-cabinet-700 text-cabinet-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Visualiser
          </button>
          <button
            onClick={() => setTab("commentaires")}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "commentaires"
                ? "border-b-2 border-cabinet-700 text-cabinet-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Commentaires
          </button>
        </div>

        {tab === "detail" && (
          <div>
            {renderDetail()}
            {canEdit && (
              <div className="mt-4">
                <Link href={modifierHref} className="btn-primary">
                  Modifier
                </Link>
              </div>
            )}
          </div>
        )}

        {tab === "commentaires" && item && (
          <ItemDiscussion
            id={id}
            kind={kind}
            onChange={(commentaires) => onCommentChange?.(id, kind, commentaires)}
          />
        )}
      </div>
    </div>
  );
}
