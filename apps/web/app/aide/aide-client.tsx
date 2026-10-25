"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* ============================================================
   Données structurées : navigation rapide + sections
   ============================================================ */

interface QuickNavCard {
  id: string;
  label: string;
  desc: string;
  icon: string;
  color: string;
}

const QUICK_NAV: QuickNavCard[] = [
  { id: "sec-dashboard", label: "Tableau de bord", desc: "Vue d'ensemble du cabinet", icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z", color: "blue" },
  { id: "sec-alertes", label: "Alertes", desc: "Urgences & notifications", icon: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01", color: "red" },
  { id: "sec-clients", label: "Clients", desc: "Base de données clients", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", color: "emerald" },
  { id: "sec-dossiers", label: "Dossiers", desc: "Cœur du métier juridique", icon: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z", color: "cabinet" },
  { id: "sec-demarches", label: "Démarches adm.", desc: "Foncier, urbanisme, fiscalité", icon: "M9 12h6M9 16h6M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM13 3v6h6", color: "violet" },
  { id: "sec-taches", label: "Tâches", desc: "Suivi et génération PDF", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", color: "amber" },
  { id: "sec-calendrier", label: "Calendrier", desc: "Audiences & échéances", icon: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18", color: "rose" },
  { id: "sec-missions", label: "Missions", desc: "Actes d'huissier & externes", icon: "M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z", color: "purple" },
  { id: "sec-administration", label: "Administration", desc: "Courrier, formalités et suivi administratif", icon: "M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5", color: "violet" },
  { id: "sec-documents", label: "Documents", desc: "Gestion & partage", icon: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v4a2 2 0 0 0 2 2h4", color: "cyan" },
  { id: "sec-factures", label: "Facturation", desc: "Factures & paiements", icon: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2zM16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8", color: "green" },
  { id: "sec-charges", label: "Charges", desc: "Dépenses & immobilisations", icon: "M3 6h18M3 12h18M3 18h12", color: "orange" },
  { id: "sec-comptabilite", label: "Comptabilité", desc: "Syscohada automatisée", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", color: "indigo" },
  { id: "sec-personnel", label: "Personnel", desc: "Paie & passage de mois", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", color: "teal" },
  { id: "sec-parametrage", label: "Paramétrage", desc: "Configuration du cabinet", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 15a1.9 1.9 0 0 0 .5 1.7 1.9 1.9 0 0 1-2.7 2.7 1.9 1.9 0 0 0-1.7-.5 1.9 1.9 0 0 0-1.1 1.1 1.9 1.9 0 0 1-3.7 0 1.9 1.9 0 0 0-1.1-1.1 1.9 1.9 0 0 0-1.7.5 1.9 1.9 0 0 1-2.7-2.7 1.9 1.9 0 0 0 .5-1.7 1.9 1.9 0 0 0-1.1-1.1 1.9 1.9 0 0 1 0-3.7 1.9 1.9 0 0 0 1.1-1.1 1.9 1.9 0 0 0-.5-1.7 1.9 1.9 0 0 1 2.7-2.7 1.9 1.9 0 0 0 1.7.5 1.9 1.9 0 0 0 1.1-1.1 1.9 1.9 0 0 1 3.7 0 1.9 1.9 0 0 0 1.1 1.1 1.9 1.9 0 0 0 1.7-.5 1.9 1.9 0 0 1 2.7 2.7 1.9 1.9 0 0 0-.5 1.7 1.9 1.9 0 0 0 1.1 1.1 1.9 1.9 0 0 1 0 3.7z", color: "slate" },
  { id: "sec-espace-client", label: "Espace client", desc: "Portail dédié aux clients", icon: "M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4z", color: "gold" },
  { id: "sec-vitrine", label: "Vitrine web", desc: "Landing page publique du cabinet", icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20", color: "violet" },
  { id: "sec-profil", label: "Mon profil", desc: "Compte, mot de passe, signature", icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", color: "cyan" },
  { id: "sec-securite", label: "Sécurité", desc: "Rôles, RBAC & confidentialité", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", color: "red" },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; gradient: string; headerBg: string; headerText: string; chip: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", gradient: "from-blue-50 to-blue-100", headerBg: "bg-blue-600", headerText: "text-blue-900", chip: "bg-blue-100 text-blue-700" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", gradient: "from-emerald-50 to-emerald-100", headerBg: "bg-emerald-600", headerText: "text-emerald-900", chip: "bg-emerald-100 text-emerald-700" },
  cabinet: { bg: "bg-cabinet-50", text: "text-cabinet-700", border: "border-cabinet-200", gradient: "from-cabinet-50 to-cabinet-100", headerBg: "bg-cabinet-700", headerText: "text-cabinet-900", chip: "bg-cabinet-100 text-cabinet-800" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", gradient: "from-amber-50 to-amber-100", headerBg: "bg-amber-600", headerText: "text-amber-900", chip: "bg-amber-100 text-amber-700" },
  rose: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", gradient: "from-rose-50 to-rose-100", headerBg: "bg-rose-600", headerText: "text-rose-900", chip: "bg-rose-100 text-rose-700" },
  purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", gradient: "from-purple-50 to-purple-100", headerBg: "bg-purple-600", headerText: "text-purple-900", chip: "bg-purple-100 text-purple-700" },
  cyan: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", gradient: "from-cyan-50 to-cyan-100", headerBg: "bg-cyan-600", headerText: "text-cyan-900", chip: "bg-cyan-100 text-cyan-700" },
  green: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", gradient: "from-green-50 to-green-100", headerBg: "bg-green-600", headerText: "text-green-900", chip: "bg-green-100 text-green-700" },
  orange: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", gradient: "from-orange-50 to-orange-100", headerBg: "bg-orange-600", headerText: "text-orange-900", chip: "bg-orange-100 text-orange-700" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", gradient: "from-indigo-50 to-indigo-100", headerBg: "bg-indigo-600", headerText: "text-indigo-900", chip: "bg-indigo-100 text-indigo-700" },
  teal: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", gradient: "from-teal-50 to-teal-100", headerBg: "bg-teal-600", headerText: "text-teal-900", chip: "bg-teal-100 text-teal-700" },
  slate: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", gradient: "from-slate-50 to-slate-100", headerBg: "bg-slate-600", headerText: "text-slate-900", chip: "bg-slate-100 text-slate-700" },
  gold: { bg: "bg-gold-50", text: "text-cabinet-800", border: "border-gold-200", gradient: "from-gold-50 to-gold-100", headerBg: "bg-gold-400", headerText: "text-cabinet-900", chip: "bg-gold-100 text-cabinet-800" },
  violet: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", gradient: "from-violet-50 to-violet-100", headerBg: "bg-violet-600", headerText: "text-violet-900", chip: "bg-violet-100 text-violet-700" },
  red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", gradient: "from-red-50 to-red-100", headerBg: "bg-red-600", headerText: "text-red-900", chip: "bg-red-100 text-red-700" },
};

/* ============================================================
   Sous-composants de mise en forme
   ============================================================ */

function Icon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 rounded-xl bg-cabinet-50/60 p-4">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cabinet-700 text-xs font-bold text-white">
        {n}
      </div>
      <div>
        <h4 className="font-semibold text-cabinet-900">{title}</h4>
        <p className="mt-1 text-xs leading-relaxed text-cabinet-600">{children}</p>
      </div>
    </div>
  );
}

function Overview({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-cabinet-100 bg-cabinet-50 p-6">
      <h3 className="mb-3 flex items-center gap-2 font-bold text-cabinet-900">
        <Icon d="M12 16v-4M12 8h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" className="h-4 w-4 text-cabinet-500" />
        Vue d'ensemble
      </h3>
      <p className="text-sm leading-relaxed text-cabinet-700">{children}</p>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <span className="mt-0.5 text-amber-500">
        <Icon d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" className="h-5 w-5" />
      </span>
      <p className="text-xs leading-relaxed text-amber-800">{children}</p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <span className="mt-0.5 text-blue-500">
        <Icon d="M12 16v-4M12 8h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" className="h-5 w-5" />
      </span>
      <p className="text-xs leading-relaxed text-blue-800">{children}</p>
    </div>
  );
}

function Tag({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>;
}

function FeatureCard({ title, icon, children, color }: { title: string; icon: string; children: React.ReactNode; color: string }) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.cabinet;
  return (
    <div className={`rounded-xl border ${c.border} bg-gradient-to-br ${c.gradient} p-6`}>
      <h3 className={`mb-4 flex items-center gap-2 font-bold ${c.headerText}`}>
        <Icon d={icon} className="h-5 w-5" />
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SectionWrapper({ id, color, icon, title, subtitle, children }: { id: string; color: string; icon: string; title: string; subtitle: string; children: React.ReactNode }) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.cabinet;
  return (
    <section id={id} className="help-section overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className={`flex items-center gap-4 border-b px-6 py-5 bg-gradient-to-r ${c.gradient} ${c.border.replace("border-", "border-b-")}`}>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.headerBg} text-white`}>
          <Icon d={icon} className="h-6 w-6" />
        </div>
        <div>
          <h2 className={`text-xl font-bold ${c.headerText}`}>{title}</h2>
          <p className={`text-sm ${c.text}`}>{subtitle}</p>
        </div>
      </div>
      <div className="space-y-6 p-6 text-sm text-cabinet-700">{children}</div>
    </section>
  );
}

/* ============================================================
   Composant principal
   ============================================================ */

export function AideClient() {
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState("");
  const [showTop, setShowTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* Recherche : filtre les cartes de navigation rapide */
  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QUICK_NAV;
    return QUICK_NAV.filter(
      (c) => c.label.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q),
    );
  }, [query]);

  /* Recherche globale : sections correspondantes */
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return QUICK_NAV.filter(
      (c) => c.label.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query]);

  /* Progression de lecture + scrollspy */
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".help-section"));
    let frame = 0;
    const update = () => {
      frame = 0;
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0);
      setShowTop(scrollTop > 600);

      /* Scrollspy : section la plus proche du haut */
      let current = "";
      for (const s of sections) {
        if (s.getBoundingClientRect().top <= 140) current = s.id;
      }
      if (current) setActiveId(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  /* Raccourci Ctrl+K / Cmd+K pour focus recherche */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, []);

  return (
    <div className="min-h-screen bg-cabinet-50">
      {/* En-tête fixe */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-cabinet-900 text-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
          <Link href="/cabinet" className="flex items-center gap-2 text-sm font-medium text-cabinet-200 transition hover:text-white">
            <Icon d="M19 12H5M12 19l-7-7 7-7" className="h-4 w-4" />
            Retour au cabinet
          </Link>
          <span className="ml-6 font-display text-lg font-semibold tracking-tight">
            Aide <span className="text-gold-300">& Guide</span>
          </span>
          <Link href="/client" className="ml-auto text-sm text-cabinet-200 transition hover:text-white">
            Espace client
          </Link>
        </div>
        {/* Barre de progression */}
        <div className="h-0.5 w-full bg-cabinet-800">
          <div className="h-full bg-gradient-to-r from-gold-400 to-gold-300 transition-all duration-150" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main ref={contentRef} className="mx-auto max-w-6xl px-6 py-10">
        {/* Hero */}
        <div className="mb-10 animate-fade-in">
          <div className="mb-3 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cabinet-700 to-cabinet-900 shadow-lg">
              <Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4" className="h-7 w-7 text-gold-300" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-cabinet-950 sm:text-4xl">Aide & Guide complet</h1>
              <p className="text-sm text-cabinet-600">Plateforme de gestion juridique multidisciplinaire — Avocats, Huissiers & Assistants</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-cabinet-500">
            <Tag className="bg-cabinet-100 text-cabinet-800">Version 2.0</Tag>
            <Tag className="bg-emerald-100 text-emerald-700">À jour</Tag>
            <span className="ml-2 flex items-center gap-1">
              <Icon d="M12 6v6l4 2M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" className="h-3.5 w-3.5" />
              Temps de lecture estimé : 35 min
            </span>
          </div>
        </div>

        {/* Recherche rapide */}
        <div className="mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <div className="relative max-w-2xl">
            <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-cabinet-400">
              <Icon d="M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM21 21l-4.3-4.3" className="h-5 w-5" />
            </span>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une fonctionnalité, un module, une question…"
              className="w-full rounded-2xl border-2 border-cabinet-200 bg-white py-4 pl-14 pr-6 text-sm text-cabinet-900 shadow-sm transition-all focus:border-cabinet-500 focus:outline-none focus:ring-2 focus:ring-cabinet-500/20"
            />
            <div className="absolute right-4 top-1/2 flex -translate-y-1/2 gap-2">
              <kbd className="rounded border border-cabinet-200 bg-cabinet-50 px-1.5 py-0.5 text-[10px] font-semibold text-cabinet-500">Ctrl</kbd>
              <kbd className="rounded border border-cabinet-200 bg-cabinet-50 px-1.5 py-0.5 text-[10px] font-semibold text-cabinet-500">K</kbd>
            </div>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-cabinet-200 bg-white p-3 shadow-lg">
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { scrollTo(r.id); setQuery(""); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-cabinet-50"
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${COLOR_MAP[r.color].bg} ${COLOR_MAP[r.color].text}`}>
                    <Icon d={r.icon} className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-medium text-cabinet-900">{r.label}</span>
                    <span className="block text-xs text-cabinet-500">{r.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation rapide */}
        <div className="mb-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" id="quick-nav">
          {filteredNav.map((card) => {
            const c = COLOR_MAP[card.color];
            const active = activeId === card.id;
            return (
              <button
                key={card.id}
                onClick={() => scrollTo(card.id)}
                className={`help-card flex flex-col items-center gap-3 rounded-xl border p-4 text-center transition hover:shadow-md ${c.bg} ${c.text} hover:${c.bg.replace("50", "100")} ${c.border} ${active ? "ring-2 ring-offset-2 ring-cabinet-500" : ""}`}
              >
                <Icon d={card.icon} className="h-7 w-7" />
                <div>
                  <span className="block text-sm font-bold">{card.label}</span>
                  <span className="block text-xs opacity-75">{card.desc}</span>
                </div>
              </button>
            );
          })}
          {filteredNav.length === 0 && (
            <p className="col-span-full py-6 text-center text-sm text-cabinet-500">
              Aucun module ne correspond à « {query} ».
            </p>
          )}
        </div>

        {/* Contenu détaillé */}
        <div className="space-y-8">
          {/* ===================== TABLEAU DE BORD ===================== */}
          <SectionWrapper id="sec-dashboard" color="blue" icon="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" title="Tableau de bord" subtitle="Vue d'ensemble instantanée de l'activité du cabinet">
            <Overview>
              Le tableau de bord est la page d'accueil de l'espace cabinet. Il offre un aperçu en temps réel des
              indicateurs clés : dossiers actifs, clients, événements à venir et tâches en cours. Des raccourcis
              permettent de créer immédiatement un nouveau dossier ou un nouveau client.
            </Overview>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-cabinet-900">Indicateurs en un coup d'œil</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">Dossiers actifs</Tag><span className="text-xs">Dossiers non clôturés ni archivés</span></div>
                  <div className="flex items-center gap-3"><Tag className="bg-emerald-100 text-emerald-700">Clients</Tag><span className="text-xs">Total des clients visibles selon votre rôle</span></div>
                  <div className="flex items-center gap-3"><Tag className="bg-amber-100 text-amber-700">Événements à venir</Tag><span className="text-xs">Audiences, échéances et rendez-vous futurs</span></div>
                  <div className="flex items-center gap-3"><Tag className="bg-blue-100 text-blue-700">Tâches en cours</Tag><span className="text-xs">Tâches non terminées, triées par échéance</span></div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-cabinet-900">Tableaux latéraux</h3>
                <p className="text-xs leading-relaxed text-cabinet-600">
                  Quatre tableaux complètent la vue : <strong>Dossiers récents</strong>, <strong>Tâches à venir</strong>
                  (triées par échéance la plus proche), <strong>Prochains événements</strong> et <strong>Clients récents</strong>.
                  Chaque ligne est cliquable et mène directement à la fiche correspondante.
                </p>
                <Tip>Les chiffres sont animés au chargement et reflètent uniquement les données accessibles à votre rôle (isolation par permissions).</Tip>
              </div>
            </div>
          </SectionWrapper>

          {/* ===================== ALERTES ===================== */}
          <SectionWrapper id="sec-alertes" color="red" icon="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" title="Alertes & notifications" subtitle="Tout ce qui requiert votre attention immédiate">
            <Overview>
              La page <strong>Alertes</strong> (menu Pilotage) centralise les urgences du cabinet : tâches en retard
              ou échéant dans les 7 jours, événements des 7 prochains jours et factures échues non payées.
              Un panneau de <strong>notifications</strong> signale en plus les événements métier (démarches mises à
              jour, documents reçus, validations attendues…).
            </Overview>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard title="Tâches urgentes" icon="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" color="amber">
                <p className="text-xs"><strong>En retard</strong> : échéance dépassée et statut ni terminé ni annulé.</p>
                <p className="text-xs"><strong>Sous 7 jours</strong> : échéances imminentes, triées de la plus proche à la plus lointaine.</p>
                <p className="text-xs">Chaque ligne renvoie au dossier concerné (référence interne cliquable).</p>
              </FeatureCard>
              <FeatureCard title="Événements & factures" icon="M3 4h18v18H3zM16 2v4M8 2v4M3 10h18" color="rose">
                <p className="text-xs"><strong>Événements prochains</strong> : audiences, rendez-vous et échéances des 7 prochains jours.</p>
                <p className="text-xs"><strong>Factures en retard</strong> : factures dont la date d'échéance est dépassée et le statut différent de « Payée » — avec client et dossier associés.</p>
              </FeatureCard>
            </div>
            <Note>
              Les alertes respectent l'isolation par rôle : vous ne voyez que les tâches, événements et factures des
              dossiers auxquels votre rôle vous donne accès. Consultez cette page chaque matin pour prioriser votre journée.
            </Note>
          </SectionWrapper>

          {/* ===================== CLIENTS ===================== */}
          <SectionWrapper id="sec-clients" color="emerald" icon="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" title="Gestion des clients" subtitle="Base de données des clients (physiques, entreprises, administrations)">
            <Overview>
              Le module Clients centralise toutes les informations sur vos clients. Chaque client possède un type
              (physique, entreprise, administration), un identifiant, des coordonnées et peut être lié à un ou plusieurs
              dossiers. Les clients peuvent aussi disposer d'un compte utilisateur pour accéder à l'espace client.
            </Overview>
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-bold text-cabinet-900">
                <Icon d="M12 5v14M5 12h14" className="h-5 w-5 text-emerald-600" />
                Créer un client
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Step n={1} title="Démarrer">Cliquer sur <strong>+ Nouveau client</strong> en haut à droite de la liste des clients.</Step>
                <Step n={2} title="Type de client">Choisir le type : <strong>Physique</strong> (personne), <strong>Entreprise</strong> ou <strong>Administration</strong>.</Step>
                <Step n={3} title="Identité">Renseigner la raison sociale (ou nom), l'identifiant fiscal et les représentants le cas échéant.</Step>
                <Step n={4} title="Coordonnées">Saisir téléphone et email — ces informations apparaîtront dans la liste et sur les documents.</Step>
                <Step n={5} title="Enregistrer">Le client apparaît immédiatement dans la liste, triée par ordre alphabétique.</Step>
              </div>
            </div>
            <FeatureCard title="Créer un client depuis un demandeur" icon="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" color="emerald">
              <p className="text-xs">Le formulaire « Nouveau client » propose en tête un bloc <strong>« Créer depuis un demandeur existant »</strong> : sélectionnez un demandeur du module Démarches adm. pour pré-remplir type, raison sociale, identifiant (NINEA / n° de pièce), adresse, téléphone et e-mail.</p>
              <p className="text-xs">Pour une personne morale, le <strong>représentant légal</strong> du demandeur est automatiquement ajouté comme représentant du client.</p>
              <p className="text-xs">À l'enregistrement, le demandeur est <strong>lié automatiquement au client créé</strong> — plus de double saisie entre le registre des clients et celui des demandeurs.</p>
            </FeatureCard>
            <FeatureCard title="Actions sur un client" icon="M12 5v14M5 12h14" color="emerald">
              <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">Consulter</Tag><span className="text-xs">Ouvrir la fiche détaillée du client et ses dossiers</span></div>
              <div className="flex items-center gap-3"><Tag className="bg-blue-100 text-blue-700">Modifier</Tag><span className="text-xs">Mettre à jour les informations (permission <code>clients:write</code>)</span></div>
              <div className="flex items-center gap-3"><Tag className="bg-amber-100 text-amber-700">Désactiver / Activer</Tag><span className="text-xs">Rendre inactif sans supprimer — la donnée est conservée pour la traçabilité (réservé à l'administrateur)</span></div>
            </FeatureCard>
            <Tip>Un client peut être associé à un compte utilisateur (onglet Paramétrage → Utilisateurs) pour lui donner accès à l'espace client sécurisé.</Tip>
          </SectionWrapper>

          {/* ===================== DOSSIERS ===================== */}
          <SectionWrapper id="sec-dossiers" color="cabinet" icon="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" title="Gestion des dossiers" subtitle="Le cœur du métier : suivi complet d'une affaire juridique">
            <Overview>
              Le dossier est l'unité centrale de la plateforme. Il relie un client à un type d'affaire, un avocat
              responsable, un huissier, des intervenants, des tâches, des documents, des événements et des missions.
              Chaque dossier suit un cycle de vie via son statut, de « Prospect » à « Clôturé ».
            </Overview>
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-bold text-cabinet-900">
                <Icon d="M12 5v14M5 12h14" className="h-5 w-5 text-cabinet-600" />
                Créer un dossier
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Step n={1} title="Démarrer">Cliquer sur <strong>+ Nouveau dossier</strong> depuis la liste ou le tableau de bord.</Step>
                <Step n={2} title="Client principal">Sélectionner le client dans la liste déroulante.</Step>
                <Step n={3} title="Type d'affaire">Choisir parmi les <strong>spécialités sélectionnées</strong> du cabinet (le code est stocké dans <code>typeAffaire</code>).</Step>
                <Step n={4} title="Nature de la mission">Cocher une ou plusieurs natures de mission (multi-choix parmi les paramètres <code>nature_mission</code>).</Step>
                <Step n={5} title="Responsables">Désigner l'avocat responsable et, le cas échéant, l'huissier responsable.</Step>
                <Step n={6} title="Intervenants">Ajouter des collaborateurs et définir leurs <strong>tâches attendues</strong> (cases à cocher parmi les modèles de tâches de la spécialité).</Step>
                <Step n={7} title="Parties adverses">Renseigner les parties adverses (nom, qualité) et le niveau de confidentialité.</Step>
                <Step n={8} title="Enregistrer">Les tâches sont <strong>générées automatiquement</strong> depuis les modèles de la spécialité et affectées à l'intervenant dont les tâches attendues incluent le titre du modèle.</Step>
              </div>
            </div>
            <Note>
              À la création, les tâches issues des <code>TacheTemplate</code> de la spécialité sont créées et affectées
              automatiquement. Si aucune « tâche attendue » ne correspond, le responsable par défaut reste l'huissier
              (<code>roleAttendu = "huissier"</code>) ou l'avocat responsable.
            </Note>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-cabinet-900">Page de détail — onglets</h3>
              <p className="text-xs leading-relaxed text-cabinet-600">
                La fiche d'un dossier contient un résumé (client, avocat, huissier, confidentialité, parties adverses,
                échéance) puis cinq onglets :
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <FeatureCard title="Documents" icon="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" color="cyan">
                  <p className="text-xs">Liste des documents du dossier + <strong>documents attendus</strong> selon la spécialité (statut Reçu/Manquant avec lien « Téléverser »).</p>
                  <p className="text-xs">Indicateurs « Publié client » et « Partage externe » par document.</p>
                </FeatureCard>
                <FeatureCard title="Tâches" icon="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" color="amber">
                  <p className="text-xs">Tâches du dossier triées par échéance, avec responsable, priorité et statut.</p>
                  <p className="text-xs">Bouton <strong>Générer</strong> pour produire le PDF du modèle de document lié à la tâche.</p>
                </FeatureCard>
                <FeatureCard title="Missions" icon="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8z" color="purple">
                  <p className="text-xs">Missions d'huissier, d'architecte, de conseiller juridique et de clerc rattachées au dossier.</p>
                  <p className="text-xs">Lien direct pour ajouter une nouvelle mission pré-remplie avec le dossier.</p>
                </FeatureCard>
                <FeatureCard title="Démarches" icon="M9 12h6M9 16h6M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM13 3v6h6" color="violet">
                  <p className="text-xs">Démarches administratives rattachées au dossier (référence, type, statut) avec accès direct à chaque fiche.</p>
                  <p className="text-xs">Bouton <strong>+ Ajouter</strong> : ouvre l'assistant de création de démarche avec le dossier déjà pré-sélectionné.</p>
                </FeatureCard>
                <FeatureCard title="Événements" icon="M3 4h18v18H3zM16 2v4M8 2v4M3 10h18" color="rose">
                  <p className="text-xs">Audiences, échéances, rendez-vous et significations liés au dossier.</p>
                  <p className="text-xs">Fil de discussion cliquable sur chaque événement.</p>
                </FeatureCard>
              </div>
            </div>

            <Note>
              En plus des spécialités contentieuses, le type d'affaire propose les spécialités du domaine
              <strong> démarches administratives</strong> : Urbanisme, Cadastre, Foncier &amp; domaines, Fiscalité &amp;
              enregistrement, Démarches administratives diverses. Chacune génère à la création un workflow
              (qualification → collecte → préparation → dépôt → instruction → décision → remise → clôture), des tâches
              de démarrage avec modèles de courrier (note de qualification, demande administrative, demande de pièces,
              bordereau de dépôt, relance, PV de remise…) et les types de documents attendus. Voir la section
              <strong> Démarches administratives</strong> ci-dessous.
            </Note>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-cabinet-900">Fonctions avancées du dossier</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FeatureCard title="Matrice RACI" icon="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18" color="indigo">
                  <p className="text-xs">Définit pour chaque intervenant son rôle : <strong>R</strong>esponsable, <strong>A</strong>pprouveur, <strong>C</strong>onsulté, <strong>I</strong>nformé.</p>
                  <p className="text-xs">Les « tâches attendues » sont des cases à cocher parmi les titres des modèles de tâches de la spécialité.</p>
                </FeatureCard>
                <FeatureCard title="Fil de discussion" icon="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" color="blue">
                  <p className="text-xs">Commentaires collaboratifs sur le dossier, accessibles aux utilisateurs autorisés.</p>
                  <p className="text-xs">Chaque événement et tâche possède aussi son propre fil de discussion.</p>
                </FeatureCard>
                <FeatureCard title="Conflits d'intérêts" icon="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" color="red">
                  <p className="text-xs">Détection et suivi des conflits d'intérêts entre dossiers (statut : détecté, ignoré, validé).</p>
                  <p className="text-xs">Lien vers le dossier en conflit pour vérification.</p>
                </FeatureCard>
                <FeatureCard title="Checklist de clôture" icon="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" color="green">
                  <p className="text-xs">Liste de contrôle à valider avant de clôturer un dossier.</p>
                  <p className="text-xs">Assure qu'aucune tâche ou document obligatoire ne reste en suspens.</p>
                </FeatureCard>
                <FeatureCard title="Statut & partage client" icon="M12 16v-4M12 8h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" color="cabinet">
                  <p className="text-xs">Le <strong>statut</strong> est modifiable directement depuis la fiche (liste déroulante de 20+ statuts).</p>
                  <p className="text-xs">Le <strong>partage client</strong> rend le dossier visible dans l'espace client (réservé au créateur, responsable ou admin).</p>
                </FeatureCard>
              </div>
            </div>
            <Tip>Les intervenants externes (huissier, architecte…) ne voient que les documents cochés « Partage externe ». Pensez à cocher cette option à l'upload si vous souhaitez partager un document avec eux.</Tip>
          </SectionWrapper>

          {/* ===================== TÂCHES ===================== */}
          <SectionWrapper id="sec-taches" color="amber" icon="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" title="Gestion des tâches" subtitle="Suivi des actions, échéances et génération de documents PDF">
            <Overview>
              Les tâches représentent les actions à accomplir sur les dossiers. Elles sont souvent créées
              automatiquement à partir des modèles de tâches (<code>TacheTemplate</code>) de la spécialité du dossier,
              mais peuvent aussi être créées manuellement. Chaque tâche a un responsable, une priorité, une échéance
              et un statut.
            </Overview>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard title="Priorités" icon="M12 2 2 22h20z M12 9v4M12 17h.01" color="amber">
                <div className="flex items-center gap-3"><Tag className="bg-gray-100 text-gray-700">Basse</Tag><span className="text-xs">Action non urgente</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-cabinet-50 text-cabinet-700">Moyenne</Tag><span className="text-xs">À planifier</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-amber-100 text-amber-700">Haute</Tag><span className="text-xs">Prioritaire</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-red-100 text-red-700">Critique</Tag><span className="text-xs">Échéance imminente</span></div>
              </FeatureCard>
              <FeatureCard title="Statuts" icon="M12 16v-4M12 8h.01" color="cabinet">
                <div className="flex items-center gap-3"><Tag className="bg-gray-100 text-gray-700">À faire</Tag><span className="text-xs">Créée, pas encore démarrée</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">En cours</Tag><span className="text-xs">En traitement</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-emerald-100 text-emerald-700">Terminée</Tag><span className="text-xs">Action achevée</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-red-100 text-red-700">Annulée</Tag><span className="text-xs">Abandonnée</span></div>
              </FeatureCard>
            </div>
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-bold text-cabinet-900">
                <Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" className="h-5 w-5 text-amber-600" />
                Générer un document PDF depuis une tâche
              </h3>
              <p className="text-xs leading-relaxed text-cabinet-600">
                Quand une tâche correspond à un modèle de tâche (<code>TacheTemplate</code>), un lien <strong>Générer</strong>
                apparaît. Il ouvre le formulaire PDF pré-rempli avec les variables du dossier, du client et du cabinet.
                La substitution des variables est refaite côté serveur pour garantir la conformité du document.
              </p>
            </div>
            <Note>
              Les tâches déchargées sur un intervenant restent actionnables par le responsable du dossier (avocat ou
              huissier) et par l'administrateur. Les autres utilisateurs n'ont qu'un accès en lecture seule.
            </Note>
          </SectionWrapper>

          {/* ===================== CALENDRIER ===================== */}
          <SectionWrapper id="sec-calendrier" color="rose" icon="M3 4h18v18H3zM16 2v4M8 2v4M3 10h18" title="Calendrier & événements" subtitle="Audiences, échéances, rendez-vous et deadlines procédurales">
            <Overview>
              Le calendrier agrège tous les événements du cabinet et les échéances des tâches. Il offre une vue
              mensuelle interactive, permet de créer des événements liés ou non à un dossier, et d'exporter le
              calendrier au format iCal pour synchronisation avec une application externe.
            </Overview>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard title="Types d'événements" icon="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" color="rose">
                <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">Audience</Tag><span className="text-xs">Passage devant une juridiction</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-amber-100 text-amber-700">Échéance</Tag><span className="text-xs">Date limite procédurale</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-blue-100 text-blue-700">Rendez-vous</Tag><span className="text-xs">Rencontre avec client ou tiers</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-purple-100 text-purple-700">Signification</Tag><span className="text-xs">Acte d'huissier programmé</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-red-100 text-red-700">Deadline</Tag><span className="text-xs">Échéance critique</span></div>
              </FeatureCard>
              <FeatureCard title="Fonctions du calendrier" icon="M12 5v14M5 12h14" color="cabinet">
                <p className="text-xs"><strong>Vue mensuelle</strong> avec navigation entre mois.</p>
                <p className="text-xs"><strong>Échéances de tâches</strong> affichées automatiquement sur le calendrier.</p>
                <p className="text-xs"><strong>Export iCal</strong> pour synchroniser avec Google Calendar, Outlook, etc.</p>
                <p className="text-xs"><strong>Événements publics client</strong> visibles dans l'espace client.</p>
              </FeatureCard>
            </div>
            <Tip>Cochez « Public client » lors de la création d'un événement pour qu'il apparaisse dans le calendrier de l'espace client (rendez-vous, audiences importantes…).</Tip>
          </SectionWrapper>

          {/* ===================== MISSIONS ===================== */}
          <SectionWrapper id="sec-missions" color="purple" icon="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" title="Missions d'huissier & externes" subtitle="Significations, sommations, constats, saisies et missions de tiers">
            <Overview>
              Le module Missions gère les actes confiés aux huissiers et aux intervenants externes (architectes,
              conseillers juridiques, clercs). Chaque mission est rattachée à un dossier, a un type d'acte, un
              destinataire, une date prévue et un statut.
            </Overview>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard title="Types d'actes d'huissier" icon="M12 2l2.4 7.2h7.6l-6 4.8z" color="purple">
                <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">Signification</Tag></div>
                <div className="flex items-center gap-3"><Tag className="bg-amber-100 text-amber-700">Sommation</Tag></div>
                <div className="flex items-center gap-3"><Tag className="bg-red-100 text-red-700">Mise en demeure</Tag></div>
                <div className="flex items-center gap-3"><Tag className="bg-blue-100 text-blue-700">Constat</Tag></div>
                <div className="flex items-center gap-3"><Tag className="bg-emerald-100 text-emerald-700">Convocation</Tag></div>
                <div className="flex items-center gap-3"><Tag className="bg-purple-100 text-purple-700">Saisie</Tag></div>
              </FeatureCard>
              <FeatureCard title="Statuts de mission" icon="M12 16v-4M12 8h.01" color="cabinet">
                <div className="flex items-center gap-3"><Tag className="bg-gray-100 text-gray-700">En préparation</Tag><span className="text-xs">Mission planifiée</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-amber-100 text-amber-700">Tentée</Tag><span className="text-xs">Acte tenté sans succès</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-emerald-100 text-emerald-700">Remise</Tag><span className="text-xs">Acte accompli</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-red-100 text-red-700">Échouée / Annulée</Tag></div>
              </FeatureCard>
            </div>
            <Note>Des missions spécifiques existent pour les architectes, conseillers juridiques et clercs, accessibles via l'onglet « Missions » du dossier ou le menu dédié.</Note>
          </SectionWrapper>

          {/* ===================== ADMINISTRATION ===================== */}
          <SectionWrapper id="sec-administration" color="violet" icon="M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5" title="Administration" subtitle="Courrier, formalités, suivi des pièces et gestion des missions administratives">
            <Overview>
              Le module Administration regroupe l'ensemble des tâches de support et de gestion procédurale du cabinet. Il
              centralise les demandes clients, le suivi des pièces et relances, la préparation des audiences, le suivi des
              formalités auprès des tribunaux et administrations, la gestion des missions confiées aux tiers et la gestion
              du courrier.
            </Overview>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard title="Demandes clients et registre des appels" icon="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" color="violet">
                <p className="text-xs">Consignez les demandes des clients et enregistrez les appels (entrants et sortants) dans un registre chronologique.</p>
                <p className="text-xs">Chaque appel est rattachable à un client ou à un dossier pour un suivi précis des échanges.</p>
              </FeatureCard>
              <FeatureCard title="Suivi des pièces manquantes et relances" icon="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" color="violet">
                <p className="text-xs">Identifiez rapidement les pièces manquantes d'un dossier et planifiez les relances écrites ou téléphoniques.</p>
                <p className="text-xs">Un tableau de bord indique les dossiers en attente de documents et les relances en cours.</p>
              </FeatureCard>
              <FeatureCard title="Préparation des audiences et réunions" icon="M3 4h18v18H3zM16 2v4M8 2v4M3 10h18" color="violet">
                <p className="text-xs">Préparez les audiences, réunions et rendez-vous : convocations, ordres du jour et documents de synthèse.</p>
                <p className="text-xs">Les éléments préparés sont liés au calendrier et aux dossiers concernés.</p>
              </FeatureCard>
              <FeatureCard title="Formalités auprès des tribunaux et administrations" icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" color="violet">
                <p className="text-xs">Suivez les dépôts, assignations, enregistrements et autres formalités auprès des juridictions et services administratifs.</p>
                <p className="text-xs">Chaque formalité est datée, documentée et associée à l'acte ou au dossier correspondant.</p>
              </FeatureCard>
              <FeatureCard title="Missions confiées aux tiers" icon="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" color="violet">
                <p className="text-xs">Confiez, suivez et clôturez les missions aux huissiers, experts, clercs et autres prestataires.</p>
                <p className="text-xs">Les missions sont rattachées à un dossier et indiquent un statut d'avancement.</p>
              </FeatureCard>
              <FeatureCard title="Gestion du courrier" icon="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v4a2 2 0 0 0 2 2h4M6 9h12" color="violet">
                <p className="text-xs">Enregistrez le courrier entrant et sortant, générez des lettres à partir de modèles et conservez l'historique.</p>
                <p className="text-xs">Chaque courrier peut être rattaché à un client, un dossier ou une affaire en cours.</p>
              </FeatureCard>
            </div>
            <Note>
              <strong>Distinction importante</strong> : « Demandes clients » enregistre les demandes que les clients
              font <em>au cabinet</em> ; « Démarches administratives » (menu dédié) pilote les demandes que le cabinet
              adresse <em>aux administrations</em>. Une carte pont dans la page Administration relie les deux espaces,
              et chaque demande client peut être convertie en démarche (« → Démarche ») avec pré-remplissage.
            </Note>
            <Tip>L'Administration couvre les fonctions transverses du cabinet : pensez à mettre à jour les statuts des relances, formalités et missions pour conserver une vue d'ensemble fiable.</Tip>
          </SectionWrapper>

          {/* ===================== DÉMARCHES ADMINISTRATIVES ===================== */}
          <SectionWrapper id="sec-demarches" color="violet" icon="M9 12h6M9 16h6M13 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM13 3v6h6" title="Démarches administratives" subtitle="Foncier, urbanisme, cadastre, fiscalité et domaines — Sénégal">
            <Overview>
              Le module <strong>Démarches administratives</strong> (groupe de menu « Démarches adm. ») pilote les
              demandes adressées par le cabinet aux administrations sénégalaises : Cadastre (DGID), Urbanisme,
              Conservation foncière, Domaines, mairies et services fiscaux. Principe fondateur : <strong>le cabinet
              prépare, dépose et suit — seule l'administration délivre l'acte officiel</strong>. Chaque démarche est
              obligatoirement rattachée à un dossier juridique (elle hérite de sa confidentialité, de ses permissions
              et de sa GED documentaire).
            </Overview>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-cabinet-900">Catalogue : 16 types de démarches</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FeatureCard title="Urbanisme" icon="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6" color="blue">
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">URB_LOTIR</Tag><span className="text-xs">Autorisation de lotir</span></div>
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">URB_CONSTRUIRE</Tag><span className="text-xs">Autorisation de construire (2 exemplaires, 3 si dossier complexe)</span></div>
                </FeatureCard>
                <FeatureCard title="Cadastre" icon="M3 3h18v18H3zM9 3v18M3 9h18" color="cyan">
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">CAD_AVIS_FAVORABLE</Tag><span className="text-xs">Avis favorable — <strong>qualification obligatoire</strong></span></div>
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">CAD_EXTRAIT_PLAN</Tag><span className="text-xs">Extrait de plan cadastral certifié</span></div>
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">CAD_CIC</Tag><span className="text-xs">Certificat d'identification cadastrale</span></div>
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">CAD_NICAD</Tag><span className="text-xs">Attribution d'un numéro NICAD</span></div>
                </FeatureCard>
                <FeatureCard title="Foncier & livre foncier" icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" color="purple">
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">FON_RAD</Tag><span className="text-xs">Radiation (hypothèque, saisie, servitude…) — <strong>à qualifier</strong></span></div>
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">FON_MAINLEVEE</Tag><span className="text-xs">Mainlevée amiable ou judiciaire — <strong>à qualifier</strong></span></div>
                </FeatureCard>
                <FeatureCard title="Domaines & transformation" icon="M3 21h18M5 21V9l7-5 7 5v12" color="emerald">
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">DOM_BAIL_TF</Tag><span className="text-xs">Transformation d'un bail en titre foncier (DEDT)</span></div>
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">DOM_PERMIS_TF</Tag><span className="text-xs">Transformation d'un permis d'occuper en titre foncier</span></div>
                </FeatureCard>
                <FeatureCard title="Fiscalité & enregistrement" icon="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" color="amber">
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">FIS_ENREG_PROC</Tag><span className="text-xs">Enregistrement d'un acte ou d'une décision — <strong>à qualifier</strong></span></div>
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">FIS_DECES</Tag><span className="text-xs">Déclaration après décès / succession — <strong>à qualifier + validation avocat</strong></span></div>
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">FIS_NON_IMPOSITION</Tag><span className="text-xs">Attestation de non-imposition (CSF du domicile)</span></div>
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">FIS_AVIS_IMPOSITION</Tag><span className="text-xs">Avis d'imposition</span></div>
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">FIS_ACQUIESCEMENT</Tag><span className="text-xs">Acte d'acquiescement fiscal — <strong>à qualifier + validation avocat</strong></span></div>
                </FeatureCard>
                <FeatureCard title="Divers" icon="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v4a2 2 0 0 0 2 2h4" color="slate">
                  <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">ADM_DUPLICATA</Tag><span className="text-xs">Duplicata de document administratif — <strong>à qualifier</strong></span></div>
                </FeatureCard>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-bold text-cabinet-900">
                <Icon d="M12 5v14M5 12h14" className="h-5 w-5 text-violet-600" />
                Créer une démarche — assistant en 5 étapes
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Step n={1} title="Type & dossier">Choisir le type de démarche (les types à qualification obligatoire sont signalés) et le dossier juridique auquel elle se rattache. Depuis la fiche dossier, l'onglet <strong>Démarches</strong> propose « + Ajouter » avec le dossier pré-sélectionné.</Step>
                <Step n={2} title="Demandeur">Choisir un demandeur existant ou en créer un. Le bouton <strong>« Utiliser le client du dossier »</strong> pré-remplit la fiche et lie le demandeur au client. Les demandeurs déjà liés au client du dossier remontent en tête de liste.</Step>
                <Step n={3} title="Parcelle / bien">Si le type l'exige, sélectionner ou créer la parcelle concernée (NICAD, titre foncier, charges…).</Step>
                <Step n={4} title="Autorité & qualification">Choisir l'autorité compétente (paramétrable) et documenter les champs de qualification — obligatoires pour les 7 types ambigus.</Step>
                <Step n={5} title="Récapitulatif">Vérifier et créer. La démarche démarre en <code>BROUILLON</code> ou <code>A_QUALIFIER</code>, avec sa check-list de pièces matérialisée selon le type.</Step>
              </div>
              <Tip>
                Une demande client du registre (Administration → Demandes clients) peut être <strong>convertie en
                démarche</strong> via le bouton « → Démarche » : l'objet, le requérant et le client sont pré-remplis
                et l'origine est tracée dans la qualification.
              </Tip>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-cabinet-900">Cycle de vie — 19 statuts pilotés</h3>
              <p className="text-xs leading-relaxed text-cabinet-600">
                Le workflow impose des transitions contrôlées : <code>Brouillon</code> → <code>À qualifier</code> →
                collecte (<code>Attente client</code> / <code>Pièces partielles</code>) → <code>Contrôle interne</code> →
                <code> Prêt validation</code> → <code>Prêt à déposer</code> → <code>Déposé</code> → <code>En instruction</code> →
                <code> Complément demandé</code> / <code>Relance</code> → <code>Accepté</code> / <code>Refusé</code> /
                <code> Document délivré</code> → <code>Clôturé</code> → <code>Archivé</code>. Les statuts
                <code> Classé sans suite</code> et <code>Recours à étudier</code> couvrent les issues alternatives.
              </p>
              <FeatureCard title="Blocages automatiques (garde-fous juridiques)" icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" color="red">
                <p className="text-xs"><strong>Qualification incomplète</strong> : impossible de passer à la préparation ou au dépôt tant que sous-type, autorité, demandeur et objet ne sont pas documentés.</p>
                <p className="text-xs"><strong>Pièces obligatoires manquantes</strong> : bloque « Prêt validation », sauf <strong>dérogation motivée et journalisée</strong>.</p>
                <p className="text-xs"><strong>Validation avocat</strong> : exigée avant dépôt pour les démarches sensibles (succession, acquiescement, transformations foncières).</p>
                <p className="text-xs"><strong>Dépôt incomplet</strong> : la transition vers « Déposé » exige date, déposant, canal et autorité.</p>
                <p className="text-xs"><strong>Clôture bloquée</strong> tant que des débours ne sont pas rapprochés.</p>
              </FeatureCard>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-cabinet-900">Fiche démarche — tout voir dès l'ouverture</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FeatureCard title="Vue d'ensemble" icon="M12 16v-4M12 8h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" color="blue">
                  <p className="text-xs"><strong>« À faire »</strong> : la prochaine action suggérée selon le statut (collecter des pièces, déposer, relancer, faire valider…).</p>
                  <p className="text-xs">Progression par catégorie de pièce et liste des <strong>documents à établir par le cabinet</strong> non encore couverts.</p>
                </FeatureCard>
                <FeatureCard title="Check-list par nature" icon="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" color="amber">
                  <p className="text-xs">Pièces regroupées en 5 sections : <strong>interne cabinet</strong>, <strong>pièce du client</strong>, <strong>technique</strong>, <strong>administratif à obtenir</strong>, <strong>preuve de dépôt / suivi</strong>.</p>
                  <p className="text-xs">Statuts par pièce : non demandée, demandée, reçue, validée — avec document GED associé et dérogations motivées.</p>
                </FeatureCard>
                <FeatureCard title="Génération PDF" icon="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" color="cyan">
                  <p className="text-xs">Modèles <code>TPL_*</code> cliquables : demande administrative, procuration, bordereau de dépôt, lettre de relance, compte rendu de dépôt, remise de document, note de recevabilité, extrait de plan cadastral…</p>
                  <p className="text-xs">Variables pré-remplies depuis la démarche (référence, demandeur, parcelle, autorité, liste des pièces). Le PDF est chiffré et versé dans la GED du dossier, avec option « Publié client ».</p>
                </FeatureCard>
                <FeatureCard title="Journal, frais & délais" icon="M12 8v4l3 3M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" color="slate">
                  <p className="text-xs">Journal d'événements horodaté (dépôts, relances, compléments, décisions) = piste d'audit opérationnelle.</p>
                  <p className="text-xs">Frais par démarche : honoraires, débours, taxes, timbres, avances — avec rapprochement.</p>
                  <p className="text-xs">Dates de relance programmées et délais paramétrables par autorité.</p>
                </FeatureCard>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-cabinet-900">Registres et tableau de bord</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FeatureCard title="Demandeurs" icon="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" color="emerald">
                  <p className="text-xs">Registre des personnes physiques et morales au nom desquelles les demandes sont faites : identité complète, pièce d'identité / NINEA / RCCM, représentant légal, mandat et procuration.</p>
                  <p className="text-xs">Filtre <strong>Tous / Clients du cabinet / Tiers</strong> : un demandeur peut être le client, un héritier, un mandant ou un bénéficiaire — le lien <code>clientId</code> le rattache le cas échéant.</p>
                </FeatureCard>
                <FeatureCard title="Parcelles" icon="M3 21h18M5 21V9l7-5 7 5v12M3 9l7-5 7 5" color="green">
                  <p className="text-xs">Référentiel des biens immobiliers : localisation, NICAD, titre foncier, section et numéro, charges inscrites, état de vérification.</p>
                  <p className="text-xs">Réutilisable d'une démarche à l'autre pour un même bien.</p>
                </FeatureCard>
                <FeatureCard title="Tableau de bord du module" icon="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" color="blue">
                  <p className="text-xs">Compteurs opérationnels : démarches ouvertes, à qualifier, en attente d'administration, relances dues, documents délivrés non remis, débours non rapprochés.</p>
                </FeatureCard>
                <FeatureCard title="Paramétrage du module" icon="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" color="slate">
                  <p className="text-xs">Trois onglets : <strong>types de démarches</strong> (check-lists, niveaux d'obligation des pièces, règles de qualification), <strong>autorités</strong> (bureaux compétents, délais, taxes), <strong>modèles de documents</strong> (TPL à variables). Réservé à <code>parametres:write</code>.</p>
                </FeatureCard>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-cabinet-900">Articulation dossiers ↔ démarches ↔ spécialités</h3>
              <p className="text-xs leading-relaxed text-cabinet-600">
                Le dossier reste le conteneur principal : créez un dossier avec une spécialité de démarche
                (Urbanisme, Cadastre, Foncier &amp; domaines, Fiscalité, Divers) pour obtenir workflow, tâches et
                documents attendus automatiquement, puis rattachez-y une ou plusieurs démarches précises via
                l'onglet <strong>Démarches</strong>. Chaque démarche suit son propre cycle qualifié auprès de
                l'administration, indépendamment du statut du dossier.
              </p>
              <Note>
                Rôles métier couverts : l'assistante juridique (collecte, dépôt, relances), le juriste (qualification,
                rédaction), l'avocat (validation des dossiers sensibles), l'agent de liaison (dépôts et retraits) et
                le comptable (frais et rapprochement des débours). La permission <code>demarches</code>
                (read / write / validate / delete) se règle dans Paramétrage → Rôles ; la validation juridique exige
                <code> demarches:validate</code> ou un administrateur.
              </Note>
              <Tip>
                L'avertissement « sous réserve de recevabilité » affiché sur chaque démarche rappelle que le logiciel
                prépare et suit la demande : l'acte officiel reste délivré par l'administration compétente.
              </Tip>
            </div>
          </SectionWrapper>

          {/* ===================== DOCUMENTS ===================== */}
          <SectionWrapper id="sec-documents" color="cyan" icon="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v4a2 2 0 0 0 2 2h4" title="Gestion des documents" subtitle="Téléversement, catégorisation, partage client et externe">
            <Overview>
              Le module Documents centralise tous les fichiers du cabinet. Chaque document est rattaché à un dossier,
              possède une catégorie, un auteur, et deux options de visibilité : <strong>Publié client</strong> (visible
              dans l'espace client) et <strong>Partage externe</strong> (visible par les intervenants externes du dossier).
            </Overview>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard title="Catégories" icon="M3 3h18v18H3z" color="cyan">
                <div className="flex flex-wrap gap-2">
                  <Tag className="bg-cabinet-100 text-cabinet-800">Correspondance</Tag>
                  <Tag className="bg-cabinet-100 text-cabinet-800">Contrat</Tag>
                  <Tag className="bg-cabinet-100 text-cabinet-800">Conclusions</Tag>
                  <Tag className="bg-cabinet-100 text-cabinet-800">Procès-verbal</Tag>
                  <Tag className="bg-cabinet-100 text-cabinet-800">Facture</Tag>
                  <Tag className="bg-cabinet-100 text-cabinet-800">Titre foncier</Tag>
                  <Tag className="bg-cabinet-100 text-cabinet-800">Assignation</Tag>
                  <Tag className="bg-cabinet-100 text-cabinet-800">Note interne</Tag>
                  <Tag className="bg-cabinet-100 text-cabinet-800">Autre</Tag>
                </div>
              </FeatureCard>
              <FeatureCard title="Visibilité & partage" icon="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" color="blue">
                <p className="text-xs"><strong>Publié client</strong> : le document est téléchargeable par le client via <code>/api/documents/[id]/download</code>.</p>
                <p className="text-xs"><strong>Partage externe</strong> : visible par les intervenants externes du dossier (huissier, architecte…).</p>
                <p className="text-xs"><strong>Dépôt client</strong> : badge indiquant un document versé par le client lui-même.</p>
              </FeatureCard>
            </div>
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-bold text-cabinet-900">
                <Icon d="M12 5v14M5 12h14" className="h-5 w-5 text-cyan-600" />
                Téléverser un document
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Step n={1} title="Démarrer">Cliquer sur <strong>+ Ajouter un document</strong> depuis la liste ou l'onglet Documents d'un dossier.</Step>
                <Step n={2} title="Fichier">Sélectionner le fichier à téléverser.</Step>
                <Step n={3} title="Dossier & catégorie">Associer le document à un dossier et choisir une catégorie.</Step>
                <Step n={4} title="Type de document">Si l'upload vient d'un lien « Téléverser » d'un type attendu, le type est pré-rempli.</Step>
                <Step n={5} title="Options">Cocher « Publié client » et/ou « Partage externe » selon les besoins.</Step>
                <Step n={6} title="Enregistrer">Le document est immédiatement disponible et son téléchargement est sécurisé par vérification d'accès.</Step>
              </div>
            </div>
            <Tip>Le téléchargement côté client passe par une API dédiée qui vérifie <code>session.clientId</code> + <code>publieClient</code> — la matrice RACI ne s'applique pas aux clients.</Tip>
          </SectionWrapper>

          {/* ===================== FACTURES ===================== */}
          <SectionWrapper id="sec-factures" color="green" icon="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2zM16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" title="Facturation" subtitle="Émission de factures, suivi des paiements et soldes">
            <Overview>
              Le module Facturation permet d'émettre des factures pour les clients et dossiers, d'enregistrer les
              paiements partiels ou totaux, et de suivre le solde restant dû. Chaque facture peut être imprimée
              avec l'en-tête et le pied de page du cabinet.
            </Overview>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard title="Statuts de facture" icon="M12 16v-4M12 8h.01" color="green">
                <div className="flex items-center gap-3"><Tag className="bg-gray-100 text-gray-700">Brouillon</Tag><span className="text-xs">Non encore émise</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-cabinet-100 text-cabinet-800">Émise</Tag><span className="text-xs">Envoyée au client</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-amber-100 text-amber-700">Partiellement payée</Tag><span className="text-xs">Paiement partiel enregistré</span></div>
                <div className="flex items-center gap-3"><Tag className="bg-emerald-100 text-emerald-700">Payée</Tag><span className="text-xs">Solde à zéro</span></div>
              </FeatureCard>
              <FeatureCard title="Suivi des paiements" icon="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" color="cabinet">
                <p className="text-xs">Colonnes <strong>Total TTC</strong>, <strong>Payé</strong> et <strong>Reste</strong> calculées en temps réel.</p>
                <p className="text-xs">Bouton <strong>Payer</strong> pour enregistrer un paiement (permission <code>factures:write</code>).</p>
                <p className="text-xs">Impression de la facture avec logo, raison sociale et slogan du cabinet.</p>
              </FeatureCard>
            </div>
            <Note>Les factures sont visibles par le client dans son espace client, avec le solde restant dû. Seul le client principal du dossier voit les factures.</Note>
          </SectionWrapper>

          {/* ===================== CHARGES ===================== */}
          <SectionWrapper id="sec-charges" color="orange" icon="M3 6h18M3 12h18M3 18h12" title="Charges & immobilisations" subtitle="Dépenses du cabinet, TVA et plans d'amortissement">
            <Overview>
              Le module Charges enregistre les dépenses du cabinet. Une charge peut être simple (débit d'un compte de
              charge) ou une <strong>immobilisation amortie</strong> (débit d'un compte de classe 2, puis dotations
              mensuelles). Les charges peuvent être rattachées à un dossier, une tâche ou une mission d'huissier.
            </Overview>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard title="Charge simple" icon="M12 5v14M5 12h14" color="orange">
                <p className="text-xs">Écriture : <strong>D 6xx</strong> (compte de charge) + <strong>D 445 TVA</strong> / <strong>C 52-57</strong> (trésorerie).</p>
                <p className="text-xs">Catégorie de charge paramétrable (loyer, transport, fournitures, services, impôts, personnel, divers…).</p>
                <p className="text-xs">Possibilité de lignes détaillées (désignation, quantité, prix unitaire, TVA).</p>
              </FeatureCard>
              <FeatureCard title="Immobilisation amortie" icon="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6" color="amber">
                <p className="text-xs">Le HT est débité au <strong>compte de classe 2</strong> choisi au lieu du compte de charge.</p>
                <p className="text-xs">Réparti par <strong>dotations mensuelles</strong> : D 681x / C 28x (une écriture par ligne).</p>
                <p className="text-xs">Deux modes : <strong>montant</strong> fixe ou <strong>taux</strong> annuel (dotation = base × taux / 12).</p>
              </FeatureCard>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-cabinet-900">Comptabilisation des dotations</h3>
              <p className="text-xs leading-relaxed text-cabinet-600">
                Les dotations échues sont passées à la création, puis via le bouton <strong>« Comptabiliser les dotations
                échues »</strong> sur la liste des charges. Cette action est idempotente (clé <code>{"amortissement-<id>"}</code>)
                et peut être automatisée par une tâche planifiée.
              </p>
              <Tip>Le montant d'une immobilisation n'est plus modifiable dès qu'une dotation est comptabilisée, afin de préserver la cohérence comptable.</Tip>
            </div>
          </SectionWrapper>

          {/* ===================== COMPTABILITÉ ===================== */}
          <SectionWrapper id="sec-comptabilite" color="indigo" icon="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" title="Comptabilité Syscohada automatisée" subtitle="Comptabilité double entièrement automatisée, conforme au plan comptable OHADA">
            <Overview>
              Le module Comptabilité implémente une <strong>comptabilité double entièrement automatisée</strong> et
              conforme au <strong>Syscohada</strong> (Système Comptable Ouest-Africain). Chaque opération du cabinet —
              facturation, charge, immobilisation, paie — génère automatiquement ses écritures comptables dans les
              bons comptes et les bons journaux, sans saisie manuelle. Le plan comptable, les journaux, les tiers, le
              grand-livre, le compte de résultat, le bilan et le rapport financier OHADA complet sont produits à
              partir des écritures validées.
            </Overview>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard title="Écritures automatiques" icon="M13 2 3 14h9l-1 8 10-12h-9z" color="indigo">
                <p className="text-xs"><strong>Facture émise</strong> → écriture de vente (D 4xx client / C 70x produit + C 445 TVA).</p>
                <p className="text-xs"><strong>Charge enregistrée</strong> → écriture d'achat (D 6xx charge + D 445 TVA / C 52-57 trésorerie).</p>
                <p className="text-xs"><strong>Immobilisation</strong> → D 2xx + dotations mensuelles D 681x / C 28x automatiques.</p>
                <p className="text-xs"><strong>Bulletin de paie validé</strong> → écritures de charges de personnel (D 6xx / C 4xx).</p>
              </FeatureCard>
              <FeatureCard title="Plan comptable" icon="M4 6h16M4 12h16M4 18h7" color="emerald">
                <p className="text-xs">Consultation et recherche des comptes Syscohada (classes 1 à 7).</p>
                <p className="text-xs">Mappings de comptes paramétrables (Paramétrage → Comptabilité).</p>
              </FeatureCard>
              <FeatureCard title="Journaux & tiers" icon="M3 3h18v18H3z" color="amber">
                <p className="text-xs">Journaux comptables (ACH, VTE, BQ, OD…) et tiers (clients, fournisseurs, employés, collaborateurs externes).</p>
              </FeatureCard>
              <FeatureCard title="Écritures & grand-livre" icon="M12 5v14M5 12h14" color="orange">
                <p className="text-xs">Saisie et consultation des écritures, avec validation. Le grand-livre détaille les mouvements par compte.</p>
              </FeatureCard>
              <FeatureCard title="Compte de résultat" icon="M3 3v18h18" color="indigo">
                <p className="text-xs">Charges et produits sur la période sélectionnée, calculés automatiquement à partir des écritures validées.</p>
              </FeatureCard>
              <FeatureCard title="Bilan" icon="M3 3h18v18H3z" color="slate">
                <p className="text-xs">Bilan actif / passif — photo au dernier jour de la période, avec résultat net cumulé depuis le 1er janvier.</p>
              </FeatureCard>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-cabinet-900">Rapport financier OHADA — automatisé</h3>
              <p className="text-xs leading-relaxed text-cabinet-600">
                Le <strong>rapport financier OHADA complet</strong> est généré automatiquement : bilan, compte de
                résultat, <strong>SIG</strong> (Soldes Intermédiaires de Gestion), flux de trésorerie et paie. L'export
                PDF reproduit l'en-tête et le pied de page du cabinet (logo, raison sociale, slogan, pagination
                « Page X / N »). Le thème PDF est configurable dans Paramétrage → Cabinet & présentation.
              </p>
              <p className="text-xs leading-relaxed text-cabinet-600">
                Le rapport accepte un mode <strong>mois</strong> (1-12) ou une période personnalisée
                <strong> debut/fin</strong> (YYYY-MM-DD). Le compte de résultat, les SIG et les flux sont calculés sur
                la <strong>période sélectionnée</strong> à partir des écritures validées. Le bilan reste une photo au
                dernier jour de la période, avec un résultat net cumulé depuis le 1er janvier pour conserver
                l'équilibre actif / passif.
              </p>
              <Note>
                Les dotations <code>soldeActuel</code> des comptes ne sont plus utilisées directement pour le CR : les
                soldes à date et mouvements période sont recalculés via <code>computeAccountBalancesAt</code> et
                <code>computeAccountMovements</code>. Les lignes OHADA du rapport (SIG / CR / FLUX / CLASS_LABELS) sont
                partagées dans <code>lib/report-rows.ts</code>.
              </Note>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-cabinet-900">Sous-menus complémentaires</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <FeatureCard title="Paiements intervenants" icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" color="purple">
                  <p className="text-xs">Suivi des paiements aux prestataires externes (huissiers, experts…) — catégorie de charge dédiée <code>PAIEMENT_INTERVENANT</code>.</p>
                  <p className="text-xs">Rattachables à un dossier, une tâche ou une mission d'huissier ; statuts Impayée / Payée avec bouton de règlement et impression.</p>
                </FeatureCard>
                <FeatureCard title="Versements sociaux et fiscaux" icon="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" color="indigo">
                  <p className="text-xs">Suivi des versements de cotisations sociales (IPRES, CNSS) et d'impôts (IRPP) déclarés via la paie.</p>
                  <p className="text-xs">Impression des bordereaux de versement avec l'en-tête du cabinet.</p>
                </FeatureCard>
                <FeatureCard title="Pilotage & rapports" icon="M3 3v18h18" color="blue">
                  <p className="text-xs">Page <strong>Pilotage</strong> : indicateurs comptables du cabinet. Pages <strong>Bilan</strong> et <strong>Compte de résultat</strong> autonomes, exportables.</p>
                  <p className="text-xs"><strong>Rapport financier</strong> : vue OHADA complète avec filtre mois ou période personnalisée.</p>
                </FeatureCard>
              </div>
            </div>
            <Tip>Aucune saisie comptable manuelle n'est nécessaire pour les opérations courantes : factures, charges, immobilisations et paie génèrent leurs écritures automatiquement. La saisie manuelle d'écritures reste disponible pour les opérations exceptionnelles (OD).</Tip>
          </SectionWrapper>

          {/* ===================== PERSONNEL ===================== */}
          <SectionWrapper id="sec-personnel" color="teal" icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" title="Personnel & paie" subtitle="Employés, bulletins de paie (IRPP, IPRES, CNSS) et passage de mois facilité">
            <Overview>
              Le module Personnel gère les employés du cabinet et leurs bulletins de paie. Il calcule automatiquement
              les cotisations sociales (IPRES, CNSS) et l'impôt sur le revenu (IRPP), avec un cumul annuel pour le
              barème progressif sénégalais. Les bulletins peuvent être <strong>créés à partir d'un modèle</strong>,
              générés en masse pour le passage d'un mois au suivant, validés, imprimés et téléversés.
            </Overview>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard title="Employés" icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" color="teal">
                <p className="text-xs">Code, nom, poste, service, salaire de base, situation familiale et type de contrat.</p>
                <p className="text-xs">Fiche détaillée et historique des bulletins par employé.</p>
              </FeatureCard>
              <FeatureCard title="Bulletins de paie" icon="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2z" color="amber">
                <p className="text-xs">Brut, net, <strong>IRPP cumulé annuel</strong>, IPRES (part patronale), CNSS (part patronale) et coût employeur.</p>
                <p className="text-xs">Statuts : <strong>Brouillon</strong> → <strong>Validé</strong> → <strong>Payé</strong> (ou Désactivé).</p>
                <p className="text-xs">Rubriques paramétrables (gains, déductions, cotisations) avec calcul automatique.</p>
              </FeatureCard>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-bold text-cabinet-900">
                <Icon d="M12 5v14M5 12h14" className="h-5 w-5 text-teal-600" />
                Créer un bulletin à partir d'un modèle
              </h3>
              <p className="text-xs leading-relaxed text-cabinet-600">
                La page <strong>« Nouvelle fiche de paie »</strong> permet de créer un bulletin individuel facilement.
                Un champ <strong>« Modèle : bulletin d'un autre employé (optionnel) »</strong> permet de sélectionner
                un employé existant : le formulaire pré-remplit automatiquement toutes les rubriques, les taux (CNSS,
                IPRES) et le régime à partir du <strong>dernier bulletin</strong> de cet employé. Il suffit d'ajuster
                les valeurs si besoin et de valider.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Step n={1} title="Démarrer">Cliquer sur <strong>+ Ajouter Nouvelle Fiche Paie</strong> depuis la page Personnel.</Step>
                <Step n={2} title="Employé">Sélectionner l'employé concerné dans la liste déroulante.</Step>
                <Step n={3} title="Modèle (optionnel)">Choisir un employé dans le champ « Modèle » pour pré-remplir les rubriques depuis son dernier bulletin.</Step>
                <Step n={4} title="Ajuster">Modifier les taux, rubriques et valeurs si nécessaire — le brut, le net et les charges se recalculent en temps réel.</Step>
                <Step n={5} title="Créer">Cliquer sur <strong>Créer le bulletin</strong> — le bulletin apparaît dans la liste avec le statut Brouillon.</Step>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-lg font-bold text-cabinet-900">
                <Icon d="M13 2 3 14h9l-1 8 10-12h-9z" className="h-5 w-5 text-amber-600" />
                Passer d'un mois au suivant — facilité
              </h3>
              <p className="text-xs leading-relaxed text-cabinet-600">
                Le passage d'un mois au suivant est <strong>automatisé</strong> pour éviter toute ressaisie manuelle.
                Deux méthodes complémentaires sont disponibles :
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <FeatureCard title="Générer en masse" icon="M13 2 3 14h9l-1 8 10-12h-9z" color="amber">
                  <p className="text-xs">Bouton <strong>Générer bulletins</strong> : ouvre un formulaire avec <strong>mois source</strong> et <strong>mois cible</strong>.</p>
                  <p className="text-xs">Crée automatiquement les bulletins du mois cible pour tous les employés actifs, en copiant les rubriques du mois source.</p>
                  <p className="text-xs">Les bulletins déjà existants sont ignorés (idempotence) — aucun risque de doublon.</p>
                </FeatureCard>
                <FeatureCard title="Navigation Précédent / Suivant" icon="M15 18l-6-6 6-6" color="teal">
                  <p className="text-xs">Boutons <strong>Précédent</strong> et <strong>Suivant</strong> sur la liste des bulletins pour parcourir les mois.</p>
                  <p className="text-xs">Le mois affiché est indiqué en clair (ex. « septembre 2026 »).</p>
                  <p className="text-xs">L'IRPP affiché est le <strong>cumul annuel</strong> (janvier → mois courant), conforme au barème progressif.</p>
                </FeatureCard>
              </div>
              <Tip>Pour clôturer un mois et passer au suivant : vérifiez que tous les bulletins du mois en cours sont validés (bouton « Paie à valider »), puis utilisez « Générer bulletins » avec le mois en cours comme source et le mois suivant comme cible. Les nouveaux bulletins héritent des rubriques et taux du mois précédent.</Tip>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-cabinet-900">Cycle de vie d'un bulletin</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Step n={1} title="Brouillon">Bulletin créé (manuelment ou par génération en masse) — modifiable librement.</Step>
                <Step n={2} title="Valider">Liste <strong>« Paie à valider »</strong> : contrôle des bulletins en brouillon avant validation.</Step>
                <Step n={3} title="Imprimer">Impression du bulletin individuel ou de la paie du mois complète (PDF).</Step>
                <Step n={4} title="Téléverser">Upload du bulletin signé (PDF) pour archivage et partage avec l'employé.</Step>
              </div>
            </div>
            <Note>La validation d'un bulletin de paie génère automatiquement les écritures comptables correspondantes (charges de personnel) dans la comptabilité Syscohada — aucune saisie manuelle supplémentaire n'est nécessaire.</Note>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-cabinet-900">Congés, contrats et assurances</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <FeatureCard title="Congés" icon="M3 4h18v18H3zM16 2v4M8 2v4M3 10h18" color="teal">
                  <p className="text-xs">Demandes de congés des employés avec workflow de validation, soldes calculés automatiquement (<strong>2,5 jours / mois</strong> par défaut, paramétrable).</p>
                  <p className="text-xs">15+ types : congés annuels, maladie, mariage du travailleur ou d'un proche, décès, naissance, baptême, hospitalisation… — chacun avec règle de déduction du solde et justificatif exigé.</p>
                  <p className="text-xs">Plafonds réglementaires sénégalais paramétrables (Paramétrage → Paramètres, catégorie <code>conges</code>) : jours par mois, samedi/dimanche/fériés, durées max par événement familial.</p>
                </FeatureCard>
                <FeatureCard title="Contrats de travail" icon="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" color="indigo">
                  <p className="text-xs">Contrats par employé : type (CDI, CDD, stage…), dates, salaire, clauses paramétrables (confidentialité, non-concurrence).</p>
                  <p className="text-xs">Workflow d'<strong>approbation</strong> : seuls les rôles direction / associés peuvent valider un contrat ; impression PDF disponible par contrat.</p>
                </FeatureCard>
                <FeatureCard title="Assurances" icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" color="red">
                  <p className="text-xs">Gestion des assurances du personnel : assureurs, contrats, employés assurés et ayants droit, prestataires.</p>
                  <p className="text-xs">Suivi des <strong>paiements de primes</strong> et des factures d'assurance, avec circuit d'approbation (comptable / direction).</p>
                  <p className="text-xs">Pages dédiées : <strong>bilan par employé</strong> et impression des attestations.</p>
                </FeatureCard>
              </div>
            </div>
          </SectionWrapper>

          {/* ===================== PARAMÉTRAGE ===================== */}
          <SectionWrapper id="sec-parametrage" color="slate" icon="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" title="Paramétrage" subtitle="Configuration complète du cabinet en 9 onglets — réservé aux administrateurs">
            <Overview>
              Le Paramétrage (lien dans l'en-tête, visible des administrateurs uniquement) regroupe toute la
              configuration du cabinet dans un <strong>classeur à 9 feuilles à onglets</strong>. Chaque feuille
              configure un aspect de la plateforme. La permission <code>parametres:read</code> donne l'accès en
              lecture, <code>parametres:write</code> autorise les modifications.
            </Overview>

            <div className="space-y-3">
              <h3 className="text-lg font-bold text-cabinet-900">Les 9 onglets en détail</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FeatureCard title="1. Cabinet & Présentation" icon="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6" color="blue">
                  <p className="text-xs"><strong>Identité</strong> : raison sociale, description, slogan, adresse, téléphones, e-mail, site web, identifiant fiscal, identification légale.</p>
                  <p className="text-xs"><strong>Visuels</strong> : logo, cachet, image de présentation.</p>
                  <p className="text-xs"><strong>Page publique</strong> : slides du hero (titre, détail, couleur, police, CTA), images de la landing, valeurs, témoignages, thème (couleurs, polices) — voir la section « Vitrine web ».</p>
                  <p className="text-xs"><strong>Thème PDF</strong> : en-tête et pied de page des documents générés (variables <code>{"{{annee}}"}</code> et <code>{"{{date}}"}</code> acceptées).</p>
                </FeatureCard>
                <FeatureCard title="2. Spécialités" icon="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" color="amber">
                  <p className="text-xs">Domaines juridiques du cabinet : code, libellé, description, ordre d'affichage. La case <strong>« Sélectionnée »</strong> fait apparaître la spécialité dans le type d'affaire à la création de dossier.</p>
                  <p className="text-xs"><strong>Types de documents attendus</strong> par spécialité (obligatoire ou non) — affichés Reçu/Manquant dans l'onglet Documents du dossier.</p>
                  <p className="text-xs"><strong>Étapes de workflow</strong> ordonnées par spécialité.</p>
                  <p className="text-xs">Inclut les 5 spécialités du domaine démarches administratives (Urbanisme, Cadastre, Foncier &amp; domaines, Fiscalité, Divers).</p>
                </FeatureCard>
                <FeatureCard title="3. Modèles de tâches" icon="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" color="emerald">
                  <p className="text-xs"><code>TacheTemplate</code> : les modèles qui génèrent automatiquement les tâches à la création d'un dossier, rattachés à une spécialité et à une étape de workflow.</p>
                  <p className="text-xs">Par modèle : titre, délai en jours (J+n), rôle attendu (avocat, juriste, assistant, huissier), priorité.</p>
                  <p className="text-xs"><code>contenuDocument</code> : corps de document à variables <code>[Libellé]</code> ou <code>{"{{cle|Libellé}}"}</code> utilisé par la génération PDF et Word.</p>
                </FeatureCard>
                <FeatureCard title="4. Bibliothèque de documents" icon="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v4a2 2 0 0 0 2 2h4" color="cyan">
                  <p className="text-xs">Vue transversale de tous les modèles de documents (contenus des <code>TacheTemplate</code>), groupés par spécialité avec nombre de variables.</p>
                  <p className="text-xs">Actions par modèle : <strong>PDF</strong> (formulaire de génération pré-rempli), <strong>Word</strong> (édition structurée), <strong>Modifier</strong> et <strong>Désactiver/Activer</strong>.</p>
                  <p className="text-xs">« Pas de modèle » signale une tâche sans contenu documentaire — à compléter via Modifier.</p>
                </FeatureCard>
                <FeatureCard title="5. Rôles" icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" color="purple">
                  <p className="text-xs">Définition des rôles du cabinet (avocat, juriste, assistant, huissier, comptable, RH, client…) avec indicateurs <code>estAdmin</code> et <code>estClient</code>.</p>
                  <p className="text-xs"><strong>Matrice de permissions</strong> par ressource (dossiers, clients, documents, tâches, factures, comptabilité, demarches…) et par action (<code>read</code>, <code>write</code>, <code>validate</code>, <code>delete</code>).</p>
                  <p className="text-xs"><code>niveauConfidentialiteMax</code> : plafond de confidentialité accessible au rôle.</p>
                  <p className="text-xs">Un rôle <code>estAdmin</code> a toutes les permissions, sans exception.</p>
                </FeatureCard>
                <FeatureCard title="6. Utilisateurs" icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" color="cabinet">
                  <p className="text-xs">Comptes utilisateurs : nom, prénom, e-mail, titre, spécialité, rôle associé, statut actif.</p>
                  <p className="text-xs">Association possible à un <strong>client</strong> (accès espace client) ou à un <strong>employé</strong>.</p>
                  <p className="text-xs">Clé de signature électronique par utilisateur, utilisée pour signer les documents.</p>
                </FeatureCard>
                <FeatureCard title="7. Paramètres" icon="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.9 1.9 0 0 0 .5 1.7l.1.1a1.9 1.9 0 0 1-2.7 2.7" color="slate">
                  <p className="text-xs">Listes déroulantes de toute l'application, organisées par <strong>catégories</strong> : types d'affaire, natures de mission, statuts, catégories de documents, règles de congés (<code>conges_*</code>), clauses de contrats (<code>contrats.*</code>)…</p>
                  <p className="text-xs">Chaque paramètre : code, libellé, ordre, actif — ajout/modification libres ; les paramètres se désactivent au lieu d'être supprimés.</p>
                </FeatureCard>
                <FeatureCard title="8. Comptabilité" icon="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" color="indigo">
                  <p className="text-xs"><strong>Catégories de charges</strong> : libellé + compte auxiliaire (6xx) ou d'immobilisation.</p>
                  <p className="text-xs"><strong>Taux de TVA</strong> applicables aux factures et charges.</p>
                  <p className="text-xs"><strong>Rubriques de paie</strong> : gains, déductions, cotisations avec ordre d'affichage.</p>
                  <p className="text-xs"><strong>Mappings de comptes</strong> : correspondance entre les opérations métier et les comptes Syscohada.</p>
                </FeatureCard>
                <FeatureCard title="9. Audit" icon="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" color="red">
                  <p className="text-xs">Journal d'audit chronologique des actions sensibles : qui (utilisateur), quoi (action et entité), quand (horodatage).</p>
                  <p className="text-xs">Recherche multi-mots et export — indispensable pour la traçabilité réglementaire du cabinet.</p>
                </FeatureCard>
              </div>
            </div>
            <Tip>Le thème PDF (en-tête, pied de page, logo, slogan) est configurable séparément du thème de la landing page, via l'onglet Cabinet & présentation.</Tip>
            <Note>
              Le module Démarches administratives possède son <strong>propre paramétrage</strong>
              (Démarches adm. → Paramétrage) : types de démarches et leurs check-lists, autorités compétentes
              (délais, taxes) et modèles de documents — indépendant de ce classeur général.
            </Note>
          </SectionWrapper>

          {/* ===================== ESPACE CLIENT ===================== */}
          <SectionWrapper id="sec-espace-client" color="gold" icon="M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4z" title="Espace client" subtitle="Portail sécurisé dédié aux clients du cabinet">
            <Overview>
              L'espace client est un portail séparé (en-tête doré) accessible aux clients disposant d'un compte. Il
              offre une vue filtrée et sécurisée des dossiers, documents, factures et événements du client, ainsi qu'un
              module de téléversement de documents.
            </Overview>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard title="Accueil client" icon="M3 3h7v7H3z" color="gold">
                <p className="text-xs">Indicateurs : mes dossiers, documents publiés, mes factures et <strong>solde restant dû</strong>.</p>
                <p className="text-xs">Tableaux : dossiers récents, prochains rendez-vous/échéances, documents et factures récentes.</p>
                <p className="text-xs"><strong>Téléversement de documents</strong> directement depuis l'accueil.</p>
              </FeatureCard>
              <FeatureCard title="Modules client" icon="M4 6h16M4 12h16M4 18h7" color="cabinet">
                <div className="space-y-2">
                  <p className="text-xs"><strong>Mes dossiers</strong> : dossiers où <code>clientId</code> correspond à la session.</p>
                  <p className="text-xs"><strong>Mes documents</strong> : uniquement les documents <code>publieClient = true</code>.</p>
                  <p className="text-xs"><strong>Mes factures</strong> : factures du client, avec solde restant dû.</p>
                  <p className="text-xs"><strong>Événements</strong> : événements publics client à venir.</p>
                </div>
              </FeatureCard>
            </div>
            <Note>
              Le <code>middleware.ts</code> redirige les sessions client vers <code>/login</code> pour toute route
              <code>/api/*</code> hors <code>/api/auth</code> et <code>/api/client</code>. Le téléchargement de
              documents passe par <code>/api/documents/[id]/download</code> avec vérification <code>clientId</code> +
              <code>publieClient</code>.
            </Note>
            <Tip>Les clients ne voient que les documents explicitement publiés (<code>publieClient = true</code>) et ne peuvent pas accéder aux API du cabinet. Toute nouvelle API appelée depuis l'espace client doit être ajoutée à la liste d'autorisation du middleware ou placée sous <code>/api/client</code>.</Tip>
          </SectionWrapper>

          {/* ===================== VITRINE WEB ===================== */}
          <SectionWrapper id="sec-vitrine" color="violet" icon="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" title="Vitrine web — landing page du cabinet" subtitle="Site public moderne, immersif et entièrement paramétrable, relié en sécurité à l'application de gestion">
            <Overview>
              La vitrine est la <strong>page publique du cabinet</strong> (page d'accueil du site) : une landing page
              moderne et cinématique qui présente l'identité, les valeurs, les spécialités et les coordonnées du
              cabinet sur la web-sphère. Elle est <strong>entièrement paramétrable</strong> depuis Paramétrage →
              Cabinet &amp; présentation — aucune ligne de code à modifier.
            </Overview>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard title="Contenu & identité" icon="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586M11 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" color="violet">
                <p className="text-xs"><strong>Hero multi-slides animé</strong> : carrousel de slides (titre, détail, couleur, police, bouton d'appel à l'action) avec flèche de défilement.</p>
                <p className="text-xs"><strong>Bandeau défilant des spécialités</strong> (marquee) : les domaines d'expertise du cabinet défilent en continu.</p>
                <p className="text-xs"><strong>Section présentation</strong> : texte institutionnel + image configurable du cabinet.</p>
                <p className="text-xs"><strong>Valeurs en cartes spotlight</strong> : les principes du cabinet mis en lumière au survol.</p>
                <p className="text-xs"><strong>Témoignages clients</strong> et <strong>compteurs animés</strong> (références, années d'expérience…).</p>
                <p className="text-xs"><strong>Bloc contact complet</strong> : téléphone(s), e-mail, adresse, site web, identifiants légaux + CTA.</p>
              </FeatureCard>
              <FeatureCard title="Paramétrage & sécurité" icon="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" color="cabinet">
                <p className="text-xs">Tout se configure dans <strong>Paramétrage → Cabinet &amp; présentation</strong> : raison sociale, slogan, description, logo, coordonnées, slides du hero, images, valeurs, témoignages.</p>
                <p className="text-xs"><strong>Thème visuel propre</strong> : couleurs et polices du cabinet, indépendantes du thème PDF des documents.</p>
                <p className="text-xs"><strong>Responsive</strong> : navigation adaptée mobile avec tiroir, animations de révélation au scroll.</p>
                <p className="text-xs"><strong>Liaison sécurisée</strong> : boutons d'accès vers la connexion cabinet et l'espace client (session + MFA). <strong>Aucune donnée métier</strong> (dossiers, clients, documents, comptabilité) n'est exposée sur la vitrine.</p>
              </FeatureCard>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FeatureCard title="Visibilité" icon="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" color="blue">
                <p className="text-xs">Présence web professionnelle : le cabinet existe en ligne avec une image moderne, à jour de ses coordonnées et de son expertise.</p>
              </FeatureCard>
              <FeatureCard title="Image de marque" icon="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z" color="gold">
                <p className="text-xs">La vitrine incarne la personnalité du cabinet : valeurs, ton, couleurs, spécialités — une identité cohérente qui inspire confiance.</p>
              </FeatureCard>
              <FeatureCard title="Acquisition" icon="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87" color="emerald">
                <p className="text-xs">Les visiteurs trouvent les spécialités, les références et les coordonnées — puis basculent vers le contact ou l'espace client. La vitrine raconte le cabinet, l'application le fait travailler.</p>
              </FeatureCard>
            </div>
            <Tip>
              La vitrine et l'application partagent la même identité visuelle mais sont strictement séparées : la page
              publique ne lit aucune donnée confidentielle, et l'accès au cabinet passe toujours par l'authentification
              MFA. Pensez à renseigner les slides du hero, les valeurs et les témoignages dans Paramétrage pour que la
              vitrine reflète fidèlement votre cabinet.
            </Tip>
          </SectionWrapper>

          {/* ===================== PROFIL ===================== */}
          <SectionWrapper id="sec-profil" color="cyan" icon="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" title="Mon profil" subtitle="Informations personnelles, sécurité du compte et signature">
            <Overview>
              La page <strong>Mon profil</strong> (accessible depuis votre nom dans l'en-tête) permet à chaque
              utilisateur de gérer ses informations personnelles et sa signature électronique, indépendamment du
              paramétrage administrateur.
            </Overview>
            <div className="grid gap-4 md:grid-cols-3">
              <FeatureCard title="Informations" icon="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" color="cyan">
                <p className="text-xs">Prénom, nom, titre et spécialité affichés dans les documents et l'en-tête de l'application.</p>
                <p className="text-xs">Changement de <strong>mot de passe</strong> sécurisé.</p>
              </FeatureCard>
              <FeatureCard title="Signature électronique" icon="M15.5 3.5 20.5 8.5 9 20H4v-5zM13 6l4 4" color="cabinet">
                <p className="text-xs">Téléversement de votre image de signature — utilisée sur les courriers et documents générés.</p>
                <p className="text-xs">Stockage chiffré, aperçu avant enregistrement.</p>
              </FeatureCard>
              <FeatureCard title="Bulletins signés" icon="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2z" color="teal">
                <p className="text-xs">Si votre compte est lié à un employé : accès à vos bulletins de paie signés téléversés par le cabinet.</p>
              </FeatureCard>
            </div>
            <Tip>L'accès à la plateforme exige une session avec MFA vérifié (code envoyé par e-mail). Pensez à garder votre adresse e-mail à jour.</Tip>
          </SectionWrapper>

          {/* ===================== SÉCURITÉ ===================== */}
          <SectionWrapper id="sec-securite" color="red" icon="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" title="Sécurité, rôles & confidentialité" subtitle="RBAC, isolation par rôle, intervenants externes et niveaux de confidentialité">
            <Overview>
              La plateforme applique un contrôle d'accès basé sur les rôles (RBAC). Chaque rôle possède des permissions
              par ressource (<code>read</code>/<code>write</code>) et un niveau de confidentialité maximum. L'accès aux
              données est filtré côté serveur à chaque requête.
            </Overview>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard title="Isolation par rôle" icon="M12 22s8-4 8-10V5l-8-3-8 3v7z" color="red">
                <p className="text-xs"><strong>Avocats / huissiers</strong> : voient leurs dossiers (responsable ou intervenant RACI).</p>
                <p className="text-xs"><strong>Assistants</strong> : accès selon permissions explicites.</p>
                <p className="text-xs"><strong>Clients</strong> : uniquement leurs dossiers et documents publiés.</p>
                <p className="text-xs"><strong>Administrateurs</strong> : accès complet au cabinet et au paramétrage.</p>
              </FeatureCard>
              <FeatureCard title="Intervenants externes" icon="M16 21v-2a4 4 0 0 0-4-4H6z" color="purple">
                <p className="text-xs">Un utilisateur est « externe » si son rôle n'est ni admin ni client et n'a pas la permission <code>documents:read</code> (ex. huissier, architecte).</p>
                <p className="text-xs">Les externes ne voient que les documents <code>partageExterne = true</code>, filtrés dans toutes les listes et vérifiés sur l'API.</p>
              </FeatureCard>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-cabinet-900">Bonnes pratiques</h3>
              <div className="space-y-3">
                <Tip>Cochez « Partage externe » uniquement pour les documents que vous souhaitez réellement partager avec les intervenants externes du dossier.</Tip>
                <Note>Définissez un niveau de confidentialité approprié sur chaque dossier sensible. Les rôles dont le niveau maximum est inférieur n'y auront pas accès.</Note>
                <Tip>Vérifiez régulièrement le journal d'audit (Paramétrage → Audit) pour suivre les actions sensibles effectuées sur la plateforme.</Tip>
              </div>
            </div>
          </SectionWrapper>

          {/* FAQ */}
          <section id="sec-faq" className="help-section overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center gap-4 border-b border-red-200 bg-gradient-to-r from-red-50 to-red-100 px-6 py-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600 text-white">
                <Icon d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-900">Questions fréquentes</h2>
                <p className="text-sm text-red-600">Réponses aux interrogations courantes</p>
              </div>
            </div>
            <div className="space-y-4 p-6">
              {[
                { q: "Comment sont générées les tâches à la création d'un dossier ?", a: "Les tâches sont créées automatiquement depuis les TacheTemplate de la spécialité du dossier. Chaque tâche est affectée à l'intervenant dont les « tâches attendues » incluent le titre du modèle. Sans correspondance, le responsable par défaut reste l'huissier ou l'avocat responsable." },
                { q: "La comptabilité est-elle vraiment automatisée ?", a: "Oui. Chaque opération du cabinet (facture émise, charge enregistrée, immobilisation, bulletin de paie validé) génère automatiquement ses écritures comptables dans les bons comptes Syscohada et les bons journaux. Aucune saisie manuelle n'est nécessaire pour les opérations courantes. Le rapport financier OHADA complet (bilan, résultat, SIG, flux, paie) est produit à partir des écritures validées et exportable en PDF." },
                { q: "Comment créer un bulletin de paie à partir d'un modèle existant ?", a: "Sur la page « Nouvelle fiche de paie », un champ « Modèle : bulletin d'un autre employé (optionnel) » permet de sélectionner un employé. Le formulaire pré-remplit automatiquement toutes les rubriques, taux et régime à partir du dernier bulletin de cet employé. Il suffit d'ajuster les valeurs si besoin et de valider." },
                { q: "Comment passer facilement d'un mois de paie au suivant ?", a: "Utilisez le bouton « Générer bulletins » : il ouvre un formulaire avec mois source et mois cible. Les bulletins du mois cible sont créés automatiquement pour tous les employés actifs en copiant les rubriques du mois source. Les bulletins déjà existants sont ignorés (pas de doublon). Vous pouvez aussi naviguer avec les boutons Précédent / Suivant sur la liste des bulletins." },
                { q: "Un client peut-il télécharger tous les documents de son dossier ?", a: "Non. Le client ne voit que les documents dont l'option « Publié client » est cochée. Le téléchargement est vérifié côté serveur via session.clientId + publieClient." },
                { q: "Puis-je modifier le montant d'une immobilisation après comptabilisation d'une dotation ?", a: "Non. Dès qu'une dotation est comptabilisée, le montant de l'immobilisation devient non modifiable afin de préserver la cohérence du plan d'amortissement." },
                { q: "Comment fonctionne le rapport financier sur une période ?", a: "Le compte de résultat, les SIG et les flux sont calculés sur la période sélectionnée (mois ou debut/fin) à partir des écritures validées. Le bilan reste une photo au dernier jour de la période, avec un résultat net cumulé depuis le 1er janvier." },
                { q: "Les intervenants externes voient-ils tous les documents ?", a: "Non. Les intervenants externes (huissier, architecte…) ne voient que les documents cochés « Partage externe ». Ce filtre s'applique partout : listes, page dossier et API." },
                { q: "Comment synchroniser le calendrier avec mon application ?", a: "Utilisez le bouton d'export iCal sur la page Calendrier. Le fichier généré peut être importé dans Google Calendar, Outlook ou toute application compatible." },
                { q: "Quelle est la différence entre « Demandes clients » et « Démarches administratives » ?", a: "« Demandes clients » (menu Administration) enregistre les demandes que les clients adressent au cabinet. « Démarches administratives » pilote les demandes que le cabinet adresse aux administrations (Cadastre, DGID, Domaines, mairies…). Une demande client peut être convertie en démarche en un clic depuis le registre." },
                { q: "Pourquoi ma démarche reste-t-elle bloquée en « À qualifier » ?", a: "Sept types de démarches sont volontairement ambigus et exigent une qualification complète avant toute préparation : avis favorable, radiation, mainlevée, duplicata, enregistrement d'acte, déclaration après décès et acquiescement fiscal. Renseignez le sous-type, l'autorité compétente, le demandeur et l'objet précis dans la fiche pour débloquer le workflow." },
                { q: "Le cabinet peut-il délivrer un extrait de plan cadastral ou un NICAD ?", a: "Non. L'application distingue strictement ce que le cabinet prépare (courriers, paquets de dépôt, notes) de ce que seule l'administration délivre (actes officiels). La check-list sépare les pièces « document interne cabinet » des « documents administratifs à obtenir »." },
                { q: "Peut-on déposer une démarche avec des pièces manquantes ?", a: "Non par défaut : la transition « Prêt validation » est bloquée si des pièces obligatoires manquent. Une dérogation est possible uniquement avec un motif documenté — elle est journalisée dans l'historique de la démarche." },
                { q: "Comment lier un demandeur à un client du cabinet ?", a: "Dans la fiche demandeur (Démarches adm. → Demandeurs), un sélecteur « Client du cabinet lié » permet l'association. Dans l'assistant de création de démarche, le bouton « Utiliser le client du dossier » crée et lie la fiche en un clic. Inversement, la page « Nouveau client » permet de créer un client depuis un demandeur existant." },
                { q: "Quelles spécialités choisir pour un dossier de démarches administratives ?", a: "Cinq spécialités couvrent le domaine : Urbanisme, Cadastre, Foncier & domaines, Fiscalité & enregistrement, et Démarches administratives diverses. À la création du dossier, elles génèrent automatiquement le workflow, les tâches de démarrage (avec modèles de courrier) et les documents attendus." },
                { q: "Qui peut valider une démarche sensible (succession, acquiescement) ?", a: "Un utilisateur disposant de la permission demarches:validate ou un administrateur. Ces démarches ne peuvent pas passer à « Prêt à déposer » sans cette validation explicite." },
                { q: "Où suivre les relances à faire auprès des administrations ?", a: "Le tableau de bord du module Démarches affiche les relances dues, les démarches en attente d'administration, les documents délivrés non remis et les débours non rapprochés. Chaque fiche démarche indique en tête la prochaine action à effectuer." },
              ].map((item, i) => (
                <details key={i} className="group rounded-xl border border-cabinet-100 bg-cabinet-50/40 p-4">
                  <summary className="flex cursor-pointer items-center justify-between font-semibold text-cabinet-900">
                    {item.q}
                    <span className="ml-4 text-cabinet-400 transition-transform group-open:rotate-180">
                      <Icon d="M6 9l6 6 6-6" className="h-4 w-4" />
                    </span>
                  </summary>
                  <p className="mt-3 text-xs leading-relaxed text-cabinet-600">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        {/* Pied de page */}
        <footer className="mt-12 border-t border-cabinet-100 pt-6 text-center text-xs text-cabinet-500">
          <p>
            Guide de la plateforme de gestion juridique multidisciplinaire · Avocats, Huissiers & Assistants au Sénégal
          </p>
          <p className="mt-1">Cette aide reflète l'état actuel des fonctionnalités. Pour toute question, contactez l'administrateur du cabinet.</p>
        </footer>
      </main>

      {/* Bouton retour en haut */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-8 right-8 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-cabinet-700 text-white shadow-lg transition hover:bg-cabinet-900"
          aria-label="Retour en haut"
        >
          <Icon d="M12 19V5M5 12l7-7 7 7" className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
