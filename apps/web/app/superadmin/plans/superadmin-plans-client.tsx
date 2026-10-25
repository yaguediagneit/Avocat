"use client";

import { useState } from "react";
import { useTableSort } from "@/components/table-sort";

const MODULES = [
  { key: "tableau", label: "Tableau de bord" },
  { key: "dossiers", label: "Dossiers" },
  { key: "clients", label: "Clients" },
  { key: "calendrier", label: "Calendrier" },
  { key: "taches", label: "Tâches" },
  { key: "taches_admin", label: "Tâches administratives" },
  { key: "missions", label: "Missions" },
  { key: "documents", label: "Documents" },
  { key: "factures", label: "Factures" },
  { key: "comptabilite", label: "Comptabilité Syscohada Automatisée" },
  { key: "personnel", label: "Personnel - salaires" },
  { key: "charges", label: "Charges & Dépenses" },
  { key: "rapports", label: "Rapports PDF" },
  { key: "parametrage", label: "Paramétrage cabinet" },
  { key: "utilisateurs", label: "Utilisateurs & Rôles" },
  { key: "portail", label: "Portail Web" },
  { key: "espace_client", label: "Espace client" },
  { key: "aide", label: "Aide & Guides" },
];

interface Support {
  mail?: boolean;
  telephone?: boolean;
  prioritaire?: boolean;
}

interface Plan {
  id: string;
  code: string;
  nom: string;
  joursEssai: number;
  acces: string | null;
  modules: string[] | null;
  nbUtilisateurs: number | null;
  support: Support | null;
  prixMensuel: number;
  prixAnnuel: number;
  ordre: number;
  actif: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { tenants: number };
}

interface Props {
  initialPlans: Plan[];
}

function normalizeModules(m: string[] | null | undefined): string[] {
  if (!m) return [];
  if (Array.isArray(m)) return m;
  try {
    return JSON.parse(String(m)) as string[];
  } catch {
    return [];
  }
}

export function SuperadminPlansClient({ initialPlans }: Props) {
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState({
    code: "",
    nom: "",
    joursEssai: "14",
    prixMensuel: "",
    prixAnnuel: "",
    ordre: "0",
    modules: MODULES.map((m) => m.key),
    nbUtilisateurs: "",
    nbUtilisateursIllimite: false,
    supportMail: false,
    supportTelephone: false,
    supportPrioritaire: false,
  });

  const reset = () => {
    setForm({
      code: "",
      nom: "",
      joursEssai: "14",
      prixMensuel: "",
      prixAnnuel: "",
      ordre: "0",
      modules: MODULES.map((m) => m.key),
      nbUtilisateurs: "",
      nbUtilisateursIllimite: false,
      supportMail: false,
      supportTelephone: false,
      supportPrioritaire: false,
    });
    setEditing(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const toggleModule = (key: string) => {
    setForm((f) => ({
      ...f,
      modules: f.modules.includes(key) ? f.modules.filter((m) => m !== key) : [...f.modules, key],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload: any = {
      code: form.code,
      nom: form.nom,
      joursEssai: parseInt(form.joursEssai, 10),
      modules: form.modules,
      nbUtilisateurs: form.nbUtilisateursIllimite ? null : parseInt(form.nbUtilisateurs, 10) || null,
      support: {
        mail: form.supportMail,
        telephone: form.supportTelephone,
        prioritaire: form.supportPrioritaire,
      },
      prixMensuel: parseInt(form.prixMensuel, 10) || 0,
      prixAnnuel: parseInt(form.prixAnnuel, 10) || 0,
      ordre: parseInt(form.ordre, 10) || 0,
    };

    try {
      const url = editing ? `/api/superadmin/plans/${editing.id}` : "/api/superadmin/plans";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({ error: "Erreur réseau" }));
      if (!res.ok) {
        setMessage(data.error?.message || data.error || "Erreur");
      } else {
        setMessage(editing ? "Plan mis à jour." : "Plan créé.");
        if (editing) {
          setPlans((prev) => prev.map((p) => (p.id === data.id ? data : p)).sort((a, b) => a.ordre - b.ordre));
        } else {
          setPlans((prev) => [...prev, data].sort((a, b) => a.ordre - b.ordre));
        }
        reset();
      }
    } catch (err) {
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    try {
      const res = await fetch("/api/superadmin/plans/seed", { method: "POST" });
      const data = await res.json().catch(() => ({ error: "Erreur réseau" }));
      if (!res.ok) {
        setMessage(data.error?.message || data.error || "Erreur");
      } else {
        setMessage(`${data.created} plan(s) créé(s).`);
        setPlans((prev) => [...prev, ...data.plans].sort((a, b) => a.ordre - b.ordre));
      }
    } catch (err) {
      setMessage("Erreur réseau");
    }
  };

  const toggleActif = async (plan: Plan) => {
    try {
      const res = await fetch(`/api/superadmin/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif: !plan.actif }),
      });
      const data = await res.json().catch(() => ({ error: "Erreur réseau" }));
      if (!res.ok) {
        setMessage(data.error?.message || data.error || "Erreur");
      } else {
        setPlans((prev) => prev.map((p) => (p.id === plan.id ? data : p)));
      }
    } catch (err) {
      setMessage("Erreur réseau");
    }
  };

  const onEdit = (plan: Plan) => {
    setEditing(plan);
    const support = plan.support ?? {};
    setForm({
      code: plan.code,
      nom: plan.nom,
      joursEssai: String(plan.joursEssai),
      prixMensuel: String(plan.prixMensuel),
      prixAnnuel: String(plan.prixAnnuel),
      ordre: String(plan.ordre),
      modules: normalizeModules(plan.modules),
      nbUtilisateurs: plan.nbUtilisateurs === null ? "" : String(plan.nbUtilisateurs),
      nbUtilisateursIllimite: plan.nbUtilisateurs === null,
      supportMail: !!support.mail,
      supportTelephone: !!support.telephone,
      supportPrioritaire: !!support.prioritaire,
    });
  };

  return (
    <div className="space-y-8">
      {message && (
        <div className="rounded border border-purple-300/30 bg-purple-500/20 p-3 text-sm text-white">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h2 className="font-semibold">{editing ? "Modifier le plan" : "Nouveau plan"}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-white/60">Code</label>
            <input name="code" value={form.code} onChange={handleChange} className="input w-full bg-white/5 text-white" required disabled={!!editing} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Nom</label>
            <input name="nom" value={form.nom} onChange={handleChange} className="input w-full bg-white/5 text-white" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Jours d&apos;essai</label>
            <input name="joursEssai" type="number" value={form.joursEssai} onChange={handleChange} className="input w-full bg-white/5 text-white" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Prix mensuel (FCFA)</label>
            <input name="prixMensuel" type="number" value={form.prixMensuel} onChange={handleChange} className="input w-full bg-white/5 text-white" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Prix annuel (FCFA)</label>
            <input name="prixAnnuel" type="number" value={form.prixAnnuel} onChange={handleChange} className="input w-full bg-white/5 text-white" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Ordre</label>
            <input name="ordre" type="number" value={form.ordre} onChange={handleChange} className="input w-full bg-white/5 text-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/60">Nombre d&apos;utilisateurs</label>
            <input
              name="nbUtilisateurs"
              type="number"
              min={1}
              disabled={form.nbUtilisateursIllimite}
              value={form.nbUtilisateurs}
              onChange={handleChange}
              className="input w-full bg-white/5 text-white disabled:opacity-50"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={form.nbUtilisateursIllimite}
                onChange={() => setForm((f) => ({ ...f, nbUtilisateursIllimite: !f.nbUtilisateursIllimite }))}
                className="h-4 w-4 rounded border-white/20 bg-white/10 text-purple-500"
              />
              Illimité
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="mb-3 block text-sm font-medium text-white/80">Modules & Sections activés</label>
            <div className="grid gap-2 md:grid-cols-2">
              {MODULES.map((m) => (
                <label key={m.key} className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={form.modules.includes(m.key)}
                    onChange={() => toggleModule(m.key)}
                    className="h-4 w-4 rounded border-white/20 bg-white/10 text-purple-500"
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="mb-3 block text-sm font-medium text-white/80">Support</label>
            <div className="grid gap-2 md:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={form.supportMail}
                  onChange={() => setForm((f) => ({ ...f, supportMail: !f.supportMail }))}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-purple-500"
              />
                Mail
              </label>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={form.supportTelephone}
                  onChange={() => setForm((f) => ({ ...f, supportTelephone: !f.supportTelephone }))}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-purple-500"
              />
                Téléphone
              </label>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={form.supportPrioritaire}
                  onChange={() => setForm((f) => ({ ...f, supportPrioritaire: !f.supportPrioritaire }))}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-purple-500"
              />
                Prioritaire
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer le plan"}
          </button>
          {editing && (
            <button type="button" onClick={reset} className="btn-secondary">
              Annuler
            </button>
          )}
        </div>
      </form>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Plans & Tarifs</h2>
          <div className="flex gap-3">
            <button onClick={handleSeed} type="button" className="btn-secondary">
              Plans par défaut
            </button>
            <button onClick={() => setEditing(null)} type="button" className="btn-primary flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
              Nouveau plan
            </button>
          </div>
        </div>
        <p className="mb-4 text-sm text-white/60">{plans.length} plan(s) configuré(s)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
              {sortTh("plans", "plan", "Plan", "pb-3")}
              {sortTh("plans", "code", "Code", "pb-3")}
              {sortTh("plans", "prix", "Prix", "pb-3")}
              {sortTh("plans", "modules", "Modules", "pb-3")}
              {sortTh("plans", "tenants", "Tenants", "pb-3")}
              {sortTh("plans", "statut", "Statut", "pb-3")}
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortRows("plans", plans, {
              plan: (p) => p.nom,
              code: (p) => p.code,
              prix: (p) => p.prixMensuel,
              modules: (p) => normalizeModules(p.modules).length,
              tenants: (p) => p._count?.tenants ?? 0,
              statut: (p) => (p.actif ? "ACTIF" : "INACTIF"),
            }).map((p) => (
              <tr key={p.id} className="border-b border-white/5 last:border-0">
                <td className="py-3">
                  <p className="font-medium">{p.nom}</p>
                </td>
                <td className="py-3">
                  <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-medium text-purple-200">{p.code}</span>
                </td>
                <td className="py-3">
                  <p>{p.prixMensuel.toLocaleString("fr-FR")} XOF / mois</p>
                  <p className="text-xs text-white/50">{p.prixAnnuel.toLocaleString("fr-FR")} XOF / an</p>
                </td>
                <td className="py-3 text-white/60">{normalizeModules(p.modules).length} activé(s)</td>
                <td className="py-3">{p._count?.tenants ?? 0}</td>
                <td className="py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.actif ? "bg-emerald-500/20 text-emerald-200" : "bg-red-500/20 text-red-200"}`}>
                    {p.actif ? "ACTIF" : "INACTIF"}
                  </span>
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => onEdit(p)} className="text-purple-300 hover:text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button onClick={() => toggleActif(p)} title={p.actif ? "Désactiver" : "Activer"} className="text-white/60 hover:text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    </button>
                  </div>
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
