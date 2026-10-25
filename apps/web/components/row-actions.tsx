"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Resource =
  | "clients"
  | "dossiers"
  | "documents"
  | "taches"
  | "evenements"
  | "factures"
  | "charges"
  | "employees"
  | "missions";

interface RowActionsProps {
  resource: Resource;
  id: string;
  active: boolean;
  isAdmin: boolean;
  canEdit?: boolean;
  editHref?: string;
  printHref?: string;
  entityLabel: string;
  onChange?: () => void;
  /// Surcharge le chemin d'API utilisé pour PATCH (ex: missions de profession).
  customApiPath?: string;
}

function apiPath(resource: Resource, id: string, custom?: string) {
  if (custom) return custom;
  // Le personnel utilise un namespace dédié côté API.
  if (resource === "employees") return `/api/personnel/employees/${id}`;
  return `/api/${resource}/${id}`;
}

export function RowActions({
  resource,
  id,
  active,
  isAdmin,
  canEdit = true,
  editHref,
  printHref,
  entityLabel,
  onChange,
  customApiPath,
}: RowActionsProps) {
  const router = useRouter();
  const [currentActive, setCurrentActive] = useState(active);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiPath(resource, id, customApiPath), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif: !currentActive }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Erreur lors du changement d'état");
        return;
      }

      setCurrentActive((a) => !a);
      if (onChange) onChange();
      else router.refresh();
    } catch (err) {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {editHref && canEdit && (
        <Link
          href={editHref}
          className="rounded-md p-1.5 text-cabinet-700 transition hover:bg-cabinet-100"
          title="Modifier"
          aria-label="Modifier"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </Link>
      )}

      {printHref && (
        <Link
          href={printHref}
          className="rounded-md p-1.5 text-cabinet-700 transition hover:bg-cabinet-100"
          title="Imprimer"
          aria-label="Imprimer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
        </Link>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          className={`rounded-md p-1.5 transition disabled:opacity-50 ${
            currentActive
              ? "text-emerald-600 hover:bg-emerald-100"
              : "text-red-600 hover:bg-red-100"
          }`}
          title={currentActive ? "Désactiver" : "Activer"}
          aria-label={currentActive ? "Désactiver" : "Activer"}
        >
          {currentActive ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          )}
        </button>
      )}

      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  );
}
