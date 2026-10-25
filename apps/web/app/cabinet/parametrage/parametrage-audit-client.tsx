"use client";

import { useCallback, useEffect, useState } from "react";
import { useTableSort } from "@/components/table-sort";

interface AuditLog {
  id: string;
  userId: string | null;
  userNom: string | null;
  action: string;
  entite: string;
  entiteId: string | null;
  adresseIp: string | null;
  createdAt: string;
}

const PAGE_SIZE = 5;

export function ParametrageAuditClient({ initialLogs }: { initialLogs: AuditLog[] }) {
  const { th: sortTh, sorts } = useTableSort();
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [total, setTotal] = useState<number>(initialLogs.length);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const sortSpec = sorts["audit"];

  const fetchPage = useCallback(async (p: number, q: string, sort?: string, dir?: string) => {
    setLoading(true);
    const params = new URLSearchParams({ take: String(PAGE_SIZE), skip: String(p * PAGE_SIZE) });
    if (q) params.set("q", q);
    if (sort) {
      params.set("sort", sort);
      params.set("dir", dir === "asc" ? "asc" : "desc");
    }
    try {
      const res = await fetch(`/api/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleExport = (format: "csv" | "json") => {
    const params = new URLSearchParams({ format });
    if (query) params.set("q", query);
    window.open(`/api/audit/export?${params.toString()}`, "_blank");
  };

  const handleReset = async (mode: "older" | "all") => {
    const message =
      mode === "all"
        ? "Vider intégralement le journal d'audit ? Cette action est irréversible."
        : "Supprimer les entrées d'audit de plus de 90 jours ?";
    if (!window.confirm(message)) return;
    setResetting(true);
    try {
      const res = await fetch("/api/audit/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, days: 90 }),
      });
      if (res.ok) {
        setPage(0);
        await fetchPage(0, query, sortSpec?.key, sortSpec?.dir === 1 ? "asc" : "desc");
      }
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(
      () => fetchPage(page, query, sortSpec?.key, sortSpec?.dir === 1 ? "asc" : "desc"),
      300
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, sortSpec]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Journal d&apos;audit</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={loading || resetting}
            onClick={() => handleExport("csv")}
          >
            Exporter CSV
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={loading || resetting}
            onClick={() => handleExport("json")}
          >
            Exporter JSON
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={loading || resetting}
            onClick={() => handleReset("older")}
          >
            Vider &gt; 90 j
          </button>
          <button
            type="button"
            className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
            disabled={loading || resetting}
            onClick={() => handleReset("all")}
          >
            Tout vider
          </button>
          <input
            type="search"
            placeholder="Rechercher (action, entité, IP, utilisateur…)"
            className="input w-full max-w-xs"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>

      {total > 50000 && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Le journal contient {total.toLocaleString("fr-FR")} entrées. Sa taille devient importante ; pensez à exporter puis à le réinitialiser.
        </div>
      )}

      <div className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-cabinet-100 text-cabinet-900">
            <tr>
              {sortTh("audit", "createdAt", "Date", "px-4 py-3")}
              <th className="px-4 py-3">Utilisateur</th>
              {sortTh("audit", "action", "Action", "px-4 py-3")}
              {sortTh("audit", "entite", "Entité", "px-4 py-3")}
              {sortTh("audit", "entiteId", "ID", "px-4 py-3")}
              {sortTh("audit", "adresseIp", "Adresse IP", "px-4 py-3")}
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">{new Date(log.createdAt).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3">{log.userNom || "Système"}</td>
                <td className="px-4 py-3">{log.action}</td>
                <td className="px-4 py-3">{log.entite}</td>
                <td className="px-4 py-3">{log.entiteId || "—"}</td>
                <td className="px-4 py-3">{log.adresseIp || "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={6}>
                  {loading ? "Chargement…" : "Aucun événement enregistré"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {total === 0 ? "0" : `${from}–${to}`} sur {total}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary disabled:opacity-40"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Précédent
          </button>
          <span className="text-xs">
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary disabled:opacity-40"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </button>
        </div>
      </div>
    </section>
  );
}
