"use client";

import { useEffect, useState } from "react";
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
  adresse: string | null;
  identifiantFiscal: string | null;
  domaine: string | null;
  planId: string | null;
  modeAbonnement: string | null;
  debutAbonnement: string | null;
  finAbonnement: string | null;
  configuration: unknown;
  actif: boolean;
  createdAt: string;
  _count: { keys: number };
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export function SuperadminTenantsClient({ initialTenants }: { initialTenants: Tenant[] }) {
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const [tenants, setTenants] = useState(initialTenants);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const [form, setForm] = useState({
    slug: "",
    raisonSociale: "",
    adresse: "",
    identifiantFiscal: "",
    domaine: "",
    planId: "",
    modeAbonnement: "mensuel",
    debutAbonnement: today,
    finAbonnement: nextYear.toISOString().split("T")[0],
    liens: "",
    adminEmail: "",
    adminPrenom: "",
    adminNom: "",
    adminPassword: "",
  });

  useEffect(() => {
    fetch("/api/superadmin/plans")
      .then((r) => r.json())
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => setPlans([]));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: form.slug,
          raisonSociale: form.raisonSociale,
          adresse: form.adresse || undefined,
          identifiantFiscal: form.identifiantFiscal || undefined,
          domaine: form.domaine || undefined,
          planId: form.planId || undefined,
          modeAbonnement: form.modeAbonnement,
          debutAbonnement: form.debutAbonnement,
          finAbonnement: form.finAbonnement,
          liens: form.liens
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
          admin: {
            email: form.adminEmail,
            prenom: form.adminPrenom,
            nom: form.adminNom,
            password: form.adminPassword,
          },
        }),
      });
      const data = await res.json().catch(() => ({ error: "Erreur réseau" }));
      if (!res.ok) {
        setMessage(data.error?.message || data.error || "Erreur");
      } else {
        setMessage("Cabinet créé avec succès.");
        setTenants((prev) => [data, ...prev]);
        const next = new Date();
        next.setFullYear(next.getFullYear() + 1);
        setForm({
          slug: "",
          raisonSociale: "",
          adresse: "",
          identifiantFiscal: "",
          domaine: "",
          planId: "",
          modeAbonnement: "mensuel",
          debutAbonnement: today,
          finAbonnement: next.toISOString().split("T")[0],
          liens: "",
          adminEmail: "",
          adminPrenom: "",
          adminNom: "",
          adminPassword: "",
        });
      }
    } catch (err) {
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

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
        setMessage(actif ? "Cabinet activé." : "Cabinet désactivé.");
        setTenants((prev) => prev.map((t) => (t.id === id ? { ...t, actif } : t)));
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
        setMessage("Cabinet réactivé.");
        setTenants((prev) => prev.map((x) => (x.id === t.id ? data : x)));
      }
    } catch (err) {
      setMessage("Erreur réseau");
    }
  };

  const exportTenants = () => {
    const data = tenants.map((t) => ({
      slug: t.slug,
      raisonSociale: t.raisonSociale,
      adresse: t.adresse,
      identifiantFiscal: t.identifiantFiscal,
      domaine: t.domaine,
      planId: t.planId,
      modeAbonnement: t.modeAbonnement,
      debutAbonnement: t.debutAbonnement,
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
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importTenants = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/superadmin/tenants/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({ error: "Erreur réseau" }));
      if (!res.ok) {
        setMessage(result.error?.message || result.error || "Erreur");
      } else {
        setMessage(`${result.count} cabinet(s) importé(s).`);
        setTenants((prev) => [...result.tenants, ...prev]);
      }
    } catch (err) {
      setMessage("Erreur lors de l’import");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-8">
      {message && (
        <div className="rounded border border-cabinet-200 bg-cabinet-50 p-3 text-sm text-cabinet-800">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <h2 className="font-semibold">Nouveau cabinet</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-gray-600">Slug</label>
            <input name="slug" value={form.slug} onChange={handleChange} className="input" required />
          </div>
          <div>
            <label className="text-sm text-gray-600">Raison sociale</label>
            <input name="raisonSociale" value={form.raisonSociale} onChange={handleChange} className="input" required />
          </div>
          <div>
            <label className="text-sm text-gray-600">Adresse</label>
            <input name="adresse" value={form.adresse} onChange={handleChange} className="input" />
          </div>
          <div>
            <label className="text-sm text-gray-600">Identifiant fiscal</label>
            <input name="identifiantFiscal" value={form.identifiantFiscal} onChange={handleChange} className="input" />
          </div>
          <div>
            <label className="text-sm text-gray-600">Domaine</label>
            <input name="domaine" value={form.domaine} onChange={handleChange} className="input" />
          </div>
          <div>
            <label className="text-sm text-gray-600">Plan</label>
            <select name="planId" value={form.planId} onChange={handleChange} className="input">
              <option value="">—</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600">Mode d&apos;abonnement</label>
            <select name="modeAbonnement" value={form.modeAbonnement} onChange={handleChange} className="input">
              <option value="mensuel">Mensuel</option>
              <option value="annuel">Annuel</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600">Début d&apos;abonnement</label>
            <input type="date" name="debutAbonnement" value={form.debutAbonnement} onChange={handleChange} className="input" required />
          </div>
          <div>
            <label className="text-sm text-gray-600">Fin d&apos;abonnement</label>
            <input type="date" name="finAbonnement" value={form.finAbonnement} onChange={handleChange} className="input" required />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-gray-600">Liens (un par ligne)</label>
            <input name="liens" value={form.liens} onChange={handleChange} className="input" placeholder="https://..." />
          </div>
          <div>
            <label className="text-sm text-gray-600">Email admin</label>
            <input name="adminEmail" type="email" value={form.adminEmail} onChange={handleChange} className="input" required />
          </div>
          <div>
            <label className="text-sm text-gray-600">Prénom admin</label>
            <input name="adminPrenom" value={form.adminPrenom} onChange={handleChange} className="input" required />
          </div>
          <div>
            <label className="text-sm text-gray-600">Nom admin</label>
            <input name="adminNom" value={form.adminNom} onChange={handleChange} className="input" required />
          </div>
          <div>
            <label className="text-sm text-gray-600">Mot de passe admin</label>
            <input name="adminPassword" type="password" value={form.adminPassword} onChange={handleChange} className="input" required />
          </div>
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Création…" : "Créer le cabinet"}
        </button>
      </form>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Cabinets</h2>
          <div className="flex gap-3">
            <button onClick={exportTenants} type="button" className="btn-secondary">
              Exporter
            </button>
            <label className="btn-secondary cursor-pointer">
              Importer
              <input type="file" accept=".json,application/json" onChange={importTenants} className="hidden" />
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
              {sortTh("tenants", "raisonSociale", "Raison sociale", "pb-2")}
              {sortTh("tenants", "slug", "Slug", "pb-2")}
              {sortTh("tenants", "domaine", "Domaine", "pb-2")}
              {sortTh("tenants", "plan", "Plan", "pb-2")}
              {sortTh("tenants", "mode", "Mode", "pb-2")}
              {sortTh("tenants", "fin", "Fin", "pb-2")}
              {sortTh("tenants", "statut", "Statut", "pb-2")}
              {sortTh("tenants", "cles", "Clés", "pb-2")}
              <th className="pb-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortRows("tenants", tenants, {
              raisonSociale: (t) => t.raisonSociale,
              slug: (t) => t.slug,
              domaine: (t) => t.domaine,
              plan: (t) => plans.find((p) => p.id === t.planId)?.nom,
              mode: (t) => t.modeAbonnement,
              fin: (t) => t.finAbonnement,
              statut: (t) => (t.actif ? "Actif" : "Inactif"),
              cles: (t) => t._count.keys,
            }).map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="py-2">{t.raisonSociale}</td>
                <td className="py-2 font-mono">{t.slug}</td>
                <td className="py-2">{t.domaine || "—"}</td>
                <td className="py-2">{plans.find((p) => p.id === t.planId)?.nom || "—"}</td>
                <td className="py-2">{t.modeAbonnement || "—"}</td>
                <td className={`py-2 ${isExpired(t) ? "text-red-600" : ""}`}>{fmtDate(t.finAbonnement)}</td>
                <td className="py-2">{t.actif ? "Actif" : "Inactif"}</td>
                <td className="py-2">{t._count.keys}</td>
                <td className="py-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => toggleActif(t.id, !t.actif)}
                    className="text-sm text-cabinet-700 hover:underline"
                  >
                    {t.actif ? "Désactiver" : "Activer"}
                  </button>
                  {isExpired(t) && (
                    <button
                      type="button"
                      onClick={() => reactivate(t)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Réactiver
                    </button>
                  )}
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
