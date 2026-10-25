"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTenantUrl } from "@/lib/tenant-url";
import { useTableSort } from "@/components/table-sort";

interface Plan {
  id: string;
  code: string;
  nom: string;
}

interface Tenant {
  id: string;
  slug: string;
  raisonSociale: string;
  domaine: string | null;
  planId: string | null;
  modeAbonnement: string | null;
  debutAbonnement: string | null;
  finAbonnement: string | null;
  actif: boolean;
  configuration: { proprietaire?: string } | null;
  createdAt: string;
  _count: { keys: number };
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export default function SuperadminTenantsPage() {
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [editForm, setEditForm] = useState({
    planId: "",
    modeAbonnement: "mensuel",
    debutAbonnement: "",
    finAbonnement: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async (url: string) => {
      try {
        const r = await fetch(url, { signal: controller.signal });
        const data = await r.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    };
    Promise.all([load("/api/superadmin/tenants"), load("/api/superadmin/plans")]).then(([t, p]) => {
      if (controller.signal.aborted) return;
      setTenants(t);
      setPlans(p);
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  const toggleActif = async (id: string, actif: boolean) => {
    try {
      const res = await fetch(`/api/superadmin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif }),
      });
      const data = await res.json().catch(() => ({ error: "Erreur réseau" }));
      if (!res.ok) {
        setMessage(data.error?.message || data.error || "Erreur");
      } else {
        setTenants((prev) => prev.map((t) => (t.id === id ? data : t)));
      }
    } catch (err) {
      setMessage("Erreur réseau");
    }
  };

  const isExpired = (t: Tenant) => t.finAbonnement && new Date(t.finAbonnement) < new Date();

  const reactivate = async (t: Tenant) => {
    const next = new Date();
    next.setFullYear(next.getFullYear() + 1);
    const fin = next.toISOString().split("T")[0];
    try {
      const res = await fetch(`/api/superadmin/tenants/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif: true, finAbonnement: fin }),
      });
      const data = await res.json().catch(() => ({ error: "Erreur réseau" }));
      if (!res.ok) {
        setMessage(data.error?.message || data.error || "Erreur");
      } else {
        setTenants((prev) => prev.map((x) => (x.id === t.id ? data : x)));
      }
    } catch (err) {
      setMessage("Erreur réseau");
    }
  };

  const openEdit = (t: Tenant) => {
    setEditing(t);
    setEditForm({
      planId: t.planId || "",
      modeAbonnement: t.modeAbonnement || "mensuel",
      debutAbonnement: t.debutAbonnement?.slice(0, 10) || "",
      finAbonnement: t.finAbonnement?.slice(0, 10) || "",
    });
  };

  const closeEdit = () => setEditing(null);

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const res = await fetch(`/api/superadmin/tenants/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: editForm.planId || null,
          modeAbonnement: editForm.modeAbonnement,
          debutAbonnement: editForm.debutAbonnement || undefined,
          finAbonnement: editForm.finAbonnement || undefined,
        }),
      });
      const data = await res.json().catch(() => ({ error: "Erreur réseau" }));
      if (!res.ok) {
        setMessage(data.error?.message || data.error || "Erreur");
      } else {
        setMessage("Cabinet mis à jour.");
        setTenants((prev) => prev.map((t) => (t.id === editing.id ? { ...t, ...data } : t)));
        setEditing(null);
      }
    } catch (err) {
      setMessage("Erreur réseau");
    }
  };

  const exportTenants = () => {
    const data = tenants.map((t) => ({
      slug: t.slug,
      raisonSociale: t.raisonSociale,
      domaine: t.domaine,
      planId: t.planId,
      modeAbonnement: t.modeAbonnement,
      finAbonnement: t.finAbonnement,
      actif: t.actif,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tenants-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const res = await fetch("/api/superadmin/tenants/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const data = await res.json().catch(() => ({ error: "Erreur réseau" }));
      if (!res.ok) {
        setMessage(data.error?.message || data.error || "Erreur");
      } else {
        setMessage(`${data.count} cabinet(s) importé(s).`);
        setTenants((prev) => [...data.tenants, ...prev]);
      }
    } catch (err) {
      setMessage("Erreur lors de l’import");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">gérer les tenants</h1>
        <Link href="/superadmin/tenants/nouveau" className="btn-primary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
          Nouveau tenant
        </Link>
      </div>
      <p className="text-sm text-white/60">{loading ? "Chargement…" : `${tenants.length} tenant(s) au total`}</p>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-emerald-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Importer un tenant local
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/60">Fichier ZIP du tenant</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 transition hover:bg-white/10">
              <span className="rounded bg-purple-600 px-3 py-1 text-xs font-semibold text-white">Choisir un fichier</span>
              <span>Aucun fichier choisi</span>
              <input type="file" accept=".json,application/json" onChange={importFile} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded border border-purple-300/30 bg-purple-500/20 p-3 text-sm text-white">
          {message}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Cabinets</h2>
          <button onClick={exportTenants} className="btn-secondary text-sm">Exporter</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
              {sortTh("tenants", "cabinet", "Cabinet", "pb-3")}
              {sortTh("tenants", "admin", "Admin", "pb-3")}
              {sortTh("tenants", "domaine", "Domaine", "pb-3")}
              {sortTh("tenants", "plan", "Plan", "pb-3")}
              {sortTh("tenants", "statut", "Statut", "pb-3")}
              {sortTh("tenants", "expiration", "Expiration", "pb-3")}
              {sortTh("tenants", "lien", "Lien", "pb-3")}
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortRows("tenants", tenants, {
              cabinet: (t) => t.raisonSociale,
              admin: (t) => t.configuration?.proprietaire,
              domaine: (t) => t.domaine,
              plan: (t) => plans.find((p) => p.id === t.planId)?.code,
              statut: (t) => (t.actif ? "ACTIF" : "INACTIF"),
              expiration: (t) => t.finAbonnement,
              lien: (t) => getTenantUrl(t.slug, t.domaine),
            }).map((t) => (
              <tr key={t.id} className="border-b border-white/5 last:border-0">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/30 text-sm font-semibold">
                      {t.raisonSociale.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-medium">{t.raisonSociale}</p>
                      <p className="text-xs text-white/50">{t.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 text-white/70">{t.configuration?.proprietaire || "—"}</td>
                <td className="py-3 text-white/70">{t.domaine || "app.domaine.sn"}</td>
                <td className="py-3">
                  <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-200">
                    {plans.find((p) => p.id === t.planId)?.code || "—"}
                  </span>
                </td>
                <td className="py-3">
                  <select
                    value={t.actif ? "actif" : "inactif"}
                    onChange={(e) => toggleActif(t.id, e.target.value === "actif")}
                    className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
                  >
                    <option value="actif" className="bg-[#1e1b4b]">ACTIF</option>
                    <option value="inactif" className="bg-[#1e1b4b]">INACTIF</option>
                  </select>
                </td>
                <td className={`py-3 ${isExpired(t) ? "text-red-400" : "text-white/70"}`}>{fmtDate(t.finAbonnement)}</td>
                <td className="py-3">
                  <a href={getTenantUrl(t.slug, t.domaine)} target="_blank" rel="noreferrer" className="text-purple-300 hover:underline">
                    {getTenantUrl(t.slug, t.domaine)}
                  </a>
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/superadmin/tenants/${t.id}`} className="text-purple-300 hover:text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    </Link>
                    <button onClick={() => openEdit(t)} className="text-xs text-purple-300 hover:text-white">
                      Modifier
                    </button>
                    {isExpired(t) && (
                      <button onClick={() => reactivate(t)} className="text-xs text-red-400 hover:text-red-300">
                        Réactiver
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-cabinet-900 p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Modifier {editing.raisonSociale}</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-white/60">Plan</label>
                <select name="planId" value={editForm.planId} onChange={handleEditChange} className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                  <option value="" className="bg-[#1e1b4b]">—</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#1e1b4b]">{p.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Mode d&apos;abonnement</label>
                <select name="modeAbonnement" value={editForm.modeAbonnement} onChange={handleEditChange} className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                  <option value="mensuel" className="bg-[#1e1b4b]">Mensuel</option>
                  <option value="annuel" className="bg-[#1e1b4b]">Annuel</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Début d&apos;abonnement</label>
                <input type="date" name="debutAbonnement" value={editForm.debutAbonnement} onChange={handleEditChange} className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/60">Fin d&apos;abonnement</label>
                <input type="date" name="finAbonnement" value={editForm.finAbonnement} onChange={handleEditChange} className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeEdit} className="rounded border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5">Annuler</button>
              <button onClick={saveEdit} className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
