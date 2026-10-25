"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PaginatedUl } from "@/components/pagination";

interface Notification {
  id: string;
  type: string;
  titre: string;
  message: string;
  severite: string;
  lu: boolean;
  dossierId: string | null;
  dateDeclenchement: string;
}

const SEVERITE_BADGES: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markAsRead(id: string) {
    setLoading(true);
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lu: true } : n))
      );
    } finally {
      setLoading(false);
    }
  }

  async function markAllAsRead() {
    setLoading(true);
    try {
      const nonLues = notifications.filter((n) => !n.lu);
      await Promise.all(
        nonLues.map((n) => fetch(`/api/notifications/${n.id}`, { method: "PATCH" }))
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })));
    } finally {
      setLoading(false);
    }
  }

  async function generateRappels() {
    setGenerating(true);
    try {
      const res = await fetch("/api/notifications", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        await load();
        if (data.generees === 0) {
          alert("Aucun nouveau rappel à générer pour le moment.");
        } else {
          alert(`${data.generees} rappel(s) généré(s).`);
        }
      }
    } finally {
      setGenerating(false);
    }
  }

  const nonLues = notifications.filter((n) => !n.lu);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Notifications &amp; rappels</h2>
          <p className="text-sm text-gray-600">
            Rappels automatiques J-7, J-3, J-1 sur les échéances et audiences.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={generateRappels}
            disabled={generating}
            className="rounded-lg border border-cabinet-700/40 bg-white px-3 py-1.5 text-xs font-medium text-cabinet-900 transition hover:bg-cabinet-100 disabled:opacity-50"
          >
            {generating ? "Génération..." : "Générer les rappels"}
          </button>
          {nonLues.length > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={loading}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Tout marquer lu
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 && (
        <p className="rounded-md bg-gray-50 p-4 text-center text-sm text-gray-500">
          Aucune notification. Cliquez sur « Générer les rappels » pour vérifier les
          échéances à venir.
        </p>
      )}

      <ul className="space-y-2">
        <PaginatedUl>
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`flex items-start gap-3 rounded-md border p-3 text-sm ${
              n.lu
                ? "border-gray-100 bg-white"
                : "border-cabinet-200 bg-cabinet-50"
            }`}
          >
            <span
              className={`mt-0.5 flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                SEVERITE_BADGES[n.severite] || "bg-gray-100 text-gray-700"
              }`}
            >
              {n.severite}
            </span>
            <div className="flex-1">
              <p className={`font-medium ${n.lu ? "text-gray-700" : "text-cabinet-900"}`}>
                {n.titre}
              </p>
              <p className="mt-0.5 text-gray-600">{n.message}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
                <span>{new Date(n.dateDeclenchement).toLocaleString("fr-FR")}</span>
                {n.dossierId && (
                  <Link
                    href={`/cabinet/dossiers/${n.dossierId}`}
                    className="text-cabinet-700 hover:underline"
                  >
                    Voir le dossier
                  </Link>
                )}
              </div>
            </div>
            {!n.lu && (
              <button
                type="button"
                onClick={() => markAsRead(n.id)}
                disabled={loading}
                className="flex-shrink-0 text-xs font-medium text-cabinet-700 hover:underline"
              >
                Marquer lu
              </button>
            )}
          </li>
        ))}
        </PaginatedUl>
      </ul>
    </div>
  );
}
