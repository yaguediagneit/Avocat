"use client";

import { useState, useEffect, useCallback } from "react";
import { PaginatedUl } from "@/components/pagination";

interface ChecklistItem {
  id: string;
  libelle: string;
  ordre: number;
  coche: boolean;
  cochePar: string | null;
  cocheLe: string | null;
}

interface ChecklistClotureProps {
  dossierId: string;
  onAllChecked?: (allChecked: boolean) => void;
}

export function ChecklistCloture({ dossierId, onAllChecked }: ChecklistClotureProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newLibelle, setNewLibelle] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/checklist`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
        const allChecked = data.length > 0 && data.every((i: ChecklistItem) => i.coche);
        onAllChecked?.(allChecked);
      }
    } catch (err) {
      console.error(err);
    }
  }, [dossierId, onAllChecked]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(item: ChecklistItem) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dossiers/${dossierId}/checklist?itemId=${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coche: !item.coche }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, coche: data.coche, cochePar: data.cochePar, cocheLe: data.cocheLe } : i))
        );
        onAllChecked?.(data.allChecked);
      }
    } finally {
      setLoading(false);
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newLibelle.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/dossiers/${dossierId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libelle: newLibelle.trim() }),
      });

      if (!res.ok) {
        setError("Erreur lors de l'ajout.");
        return;
      }

      const item: ChecklistItem = await res.json();
      setItems((prev) => [...prev, item]);
      setNewLibelle("");
      setShowAdd(false);
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm("Retirer cet item ?")) return;
    try {
      await fetch(`/api/dossiers/${dossierId}/checklist?itemId=${itemId}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      console.error(err);
    }
  }

  const checkedCount = items.filter((i) => i.coche).length;
  const progress = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;
  const allChecked = items.length > 0 && checkedCount === items.length;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Check-list de clôture</h2>
          <p className="text-sm text-gray-600">
            Vérifications à effectuer avant de clôturer le dossier.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cabinet-700/40 bg-white px-3 py-1.5 text-xs font-medium text-cabinet-900 transition hover:bg-cabinet-100"
        >
          + Ajouter un item
        </button>
      </div>

      {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      {/* Barre de progression */}
      {items.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">
              {checkedCount} / {items.length} vérifications effectuées
            </span>
            <span className={`font-medium ${allChecked ? "text-emerald-600" : "text-gray-500"}`}>
              {progress}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full transition-all ${allChecked ? "bg-emerald-500" : "bg-cabinet-600"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {showAdd && (
        <form onSubmit={addItem} className="flex gap-2">
          <input
            type="text"
            value={newLibelle}
            onChange={(e) => setNewLibelle(e.target.value)}
            className="input flex-1"
            placeholder="Ex. Récupérer le titre exécutoire"
            maxLength={300}
          />
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "..." : "Ajouter"}
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(false)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Annuler
          </button>
        </form>
      )}

      {items.length === 0 && !showAdd && (
        <p className="rounded-md bg-gray-50 p-4 text-center text-sm text-gray-500">
          La check-list sera générée automatiquement au premier accès.
        </p>
      )}

      <ul className="space-y-1">
        <PaginatedUl>
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-md border border-gray-100 p-3 text-sm hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={item.coche}
              onChange={() => toggle(item)}
              disabled={loading}
              className="h-4 w-4 rounded border-gray-300 text-cabinet-700 focus:ring-cabinet-500"
            />
            <span className={`flex-1 ${item.coche ? "text-gray-400 line-through" : "text-gray-800"}`}>
              {item.libelle}
            </span>
            {item.coche && item.cocheLe && (
              <span className="text-xs text-gray-400">
                ✓ {new Date(item.cocheLe).toLocaleDateString("fr-FR")}
              </span>
            )}
            <button
              type="button"
              onClick={() => deleteItem(item.id)}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Retirer
            </button>
          </li>
        ))}
        </PaginatedUl>
      </ul>

      {allChecked && (
        <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
          ✓ Toutes les vérifications sont effectuées. Le dossier peut être clôturé.
        </div>
      )}
    </div>
  );
}
