"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Plan {
  id: string;
  code: string;
  nom: string;
  prixMensuel: number;
  prixAnnuel: number;
}

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

export default function NouveauTenantPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);

  const [form, setForm] = useState({
    raisonSociale: "",
    email: "",
    telephone: "",
    ville: "Dakar",
    pays: "Sénégal",
    monnaie: "XOF (Franc CFA)",
    adresse: "",
    slug: "",
    domaine: "",
    proprietaire: "",
    planId: "",
    modeAbonnement: "mensuel" as "mensuel" | "annuel",
    debutAbonnement: today,
    finAbonnement: nextYear.toISOString().split("T")[0],
    note: "",
    adminPrenom: "",
    adminNom: "",
    adminEmail: "",
    adminPassword: "",
    nbUtilisateurs: "",
    nbUtilisateursIllimite: false,
    supportMail: false,
    supportTelephone: false,
    supportPrioritaire: false,
    modules: MODULES.map((m) => m.key),
  });

  useEffect(() => {
    fetch("/api/superadmin/plans")
      .then((r) => r.json())
      .then((data) => setPlans(Array.isArray(data) ? data : []))
      .catch(() => setPlans([]));
  }, []);

  const toggleModule = (key: string) => {
    setForm((f) => ({
      ...f,
      modules: f.modules.includes(key) ? f.modules.filter((m) => m !== key) : [...f.modules, key],
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const selectedPlan = plans.find((p) => p.id === form.planId);
    const modeLabel = form.modeAbonnement === "mensuel" ? "mois" : "an";
    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: form.slug || form.raisonSociale.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""),
          raisonSociale: form.raisonSociale,
          adresse: form.adresse || undefined,
          domaine: form.domaine || undefined,
          planId: form.planId || undefined,
          modeAbonnement: form.modeAbonnement,
          debutAbonnement: form.debutAbonnement,
          finAbonnement: form.finAbonnement,
          configuration: {
            email: form.email,
            telephone: form.telephone,
            ville: form.ville,
            pays: form.pays,
            monnaie: form.monnaie,
            proprietaire: form.proprietaire,
            note: form.note,
            modules: form.modules,
            nbUtilisateurs: form.nbUtilisateursIllimite ? "illimite" : Number(form.nbUtilisateurs) || undefined,
            support: {
              mail: form.supportMail,
              telephone: form.supportTelephone,
              prioritaire: form.supportPrioritaire,
            },
            prixLabel: selectedPlan
              ? `${selectedPlan[form.modeAbonnement === "mensuel" ? "prixMensuel" : "prixAnnuel"].toLocaleString("fr-FR")} XOF / ${modeLabel}`
              : undefined,
          },
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
        window.location.href = "/superadmin/tenants";
      }
    } catch (err) {
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-white/60">
        <Link href="/superadmin" className="hover:text-white">Superadmin</Link>
        <span>/</span>
        <span>Nouveau tenant</span>
      </div>
      <h1 className="text-2xl font-bold">créer un nouveau tenant</h1>

      {message && (
        <div className="rounded border border-purple-300/30 bg-purple-500/20 p-3 text-sm text-white">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-purple-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            Informations du cabinet
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Nom du cabinet *</label>
              <input name="raisonSociale" value={form.raisonSociale} onChange={handleChange} className="input w-full bg-white/5 text-white placeholder:text-white/30" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Propriétaire</label>
              <input name="proprietaire" value={form.proprietaire} onChange={handleChange} className="input w-full bg-white/5 text-white placeholder:text-white/30" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Email du cabinet</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} className="input w-full bg-white/5 text-white placeholder:text-white/30" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Téléphone</label>
              <input name="telephone" value={form.telephone} onChange={handleChange} className="input w-full bg-white/5 text-white placeholder:text-white/30" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Ville</label>
              <input name="ville" value={form.ville} onChange={handleChange} className="input w-full bg-white/5 text-white placeholder:text-white/30" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Pays</label>
              <input name="pays" value={form.pays} onChange={handleChange} className="input w-full bg-white/5 text-white placeholder:text-white/30" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Monnaie</label>
              <select name="monnaie" value={form.monnaie} onChange={handleChange} className="input w-full bg-white/5 text-white">
                <option value="XOF (Franc CFA)">XOF (Franc CFA)</option>
                <option value="EUR (Euro)">EUR (Euro)</option>
                <option value="USD (Dollar)">USD (Dollar)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Adresse</label>
              <input name="adresse" value={form.adresse} onChange={handleChange} className="input w-full bg-white/5 text-white placeholder:text-white/30" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-purple-300">Abonnement</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Plan</label>
              <select name="planId" value={form.planId} onChange={handleChange} className="input w-full bg-white/5 text-white">
                <option value="">Sélectionner un plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom} — {p.prixMensuel.toLocaleString("fr-FR")} XOF / mois
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Mode d&apos;abonnement</label>
              <select name="modeAbonnement" value={form.modeAbonnement} onChange={handleChange} className="input w-full bg-white/5 text-white">
                <option value="mensuel">Mensuel</option>
                <option value="annuel">Annuel</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Date d&apos;expiration</label>
              <input type="date" name="finAbonnement" value={form.finAbonnement} onChange={handleChange} className="input w-full bg-white/5 text-white" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Domaine personnalisé</label>
              <input name="domaine" value={form.domaine} onChange={handleChange} className="input w-full bg-white/5 text-white placeholder:text-white/30" placeholder="app.monsite.sn" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Note interne (admin)</label>
              <textarea name="note" value={form.note} onChange={handleChange} className="input w-full bg-white/5 text-white placeholder:text-white/30" rows={3} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-purple-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            Compte admin du tenant
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Prénom admin</label>
              <input name="adminPrenom" value={form.adminPrenom} onChange={handleChange} className="input w-full bg-white/5 text-white placeholder:text-white/30" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Nom admin</label>
              <input name="adminNom" value={form.adminNom} onChange={handleChange} className="input w-full bg-white/5 text-white placeholder:text-white/30" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Email admin * (identifiant connexion)</label>
              <input name="adminEmail" type="email" value={form.adminEmail} onChange={handleChange} className="input w-full bg-white/5 text-white placeholder:text-white/30" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Mot de passe admin *</label>
              <input name="adminPassword" type="password" value={form.adminPassword} onChange={handleChange} className="input w-full bg-white/5 text-white placeholder:text-white/30" required />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            Nombre d&apos;utilisateurs
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-white/60">Limite</label>
              <input
                name="nbUtilisateurs"
                type="number"
                min={1}
                disabled={form.nbUtilisateursIllimite}
                value={form.nbUtilisateurs}
                onChange={handleChange}
                className="input w-full bg-white/5 text-white placeholder:text-white/30 disabled:opacity-50"
                placeholder="Ex. 10"
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
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-amber-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5A2.5 2.5 0 0 1 4.5 7h15A2.5 2.5 0 0 1 22 9.5V17z" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
            Support
          </h2>
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

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
            Modules & Sections activés
          </h2>
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

        <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          {loading ? "Création…" : "créer le tenant"}
        </button>
      </form>
    </div>
  );
}
