"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface ShellNavItem {
  href: string;
  label: string;
  exact?: boolean;
}

export interface ShellNavGroup {
  id: string;
  label: string;
  icon: string;
  items: ShellNavItem[];
}

interface CabinetShellProps {
  tenantName: string;
  tenantLogoUrl: string | null;
  tenantSlogan: string;
  userName: string;
  userRole: string;
  userInitials: string;
  topItems: ShellNavItem[];
  groups: ShellNavGroup[];
  showParametrage: boolean;
  estSuperAdmin: boolean;
  children: React.ReactNode;
}

const ICONS: Record<string, React.ReactNode> = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 10 9-7 9 7" />
      <path d="M5 8.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V8.5" />
    </svg>
  ),
  pilotage: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a3 3 0 0 1 3-3h1l2 4H6a3 3 0 0 1-3-3z" />
      <path d="M21 7a3 3 0 0 0-3-3h-1l-2 4h3a3 3 0 0 0 3-3z" />
      <path d="M9 8h6" />
      <circle cx="7" cy="16" r="4" />
      <circle cx="17" cy="16" r="4" />
      <path d="M11 16h2" />
      <path d="M7 12V8" />
      <path d="M17 12V8" />
    </svg>
  ),
  parametre: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  personnel: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

const SEGMENT_LABELS: Record<string, string> = {
  dossiers: "Dossiers",
  clients: "Clients",
  calendrier: "Calendrier",
  personnel: "Personnel",
  comptabilite: "Comptabilité",
  administration: "Administration",
  alertes: "Alertes",
  taches: "Tâches",
  documents: "Documents",
  missions: "Missions",
  factures: "Factures",
  charges: "Charges",
  "paiements-intervenants": "Paiements intervenants",
  parametrage: "Paramétrage",
  profil: "Mon profil",
  conges: "Congés",
  contrats: "Contrats",
  assurances: "Assurances",
  paie: "Validation de la paie",
  nouvelle_paie: "Nouvelle fiche de paie",
  ecritures: "Écritures",
  journaux: "Journaux",
  plan: "Plan comptable",
  tiers: "Tiers",
  "grand-livre": "Grand livre",
  bilan: "Bilan",
  resultat: "Compte de résultat",
  rapport: "Rapport financier",
  versements: "Versements sociaux et fiscaux",
  demarches: "Démarches administratives",
  demandeurs: "Demandeurs",
  parcelles: "Parcelles",
  demandes: "Demandes clients",
  "pieces-manquantes": "Pièces manquantes",
  audiences: "Audiences & réunions",
  formalites: "Formalités tribunaux",
  courrier: "Courrier",
  nouveau: "Nouveau",
  nouvelle: "Nouvelle",
  profession: "Par profession",
  imprimer: "Impression",
  edit: "Modifier",
  pdf: "PDF",
};

function segmentLabel(seg: string): string {
  const decoded = decodeURIComponent(seg);
  const known = SEGMENT_LABELS[decoded.toLowerCase()];
  if (known) return known;
  if (/^[a-z0-9_-]{12,}$/i.test(decoded)) return "Détail";
  return decoded.charAt(0).toUpperCase() + decoded.slice(1);
}

export function CabinetShell({
  tenantName,
  tenantLogoUrl,
  tenantSlogan,
  userName,
  userRole,
  userInitials,
  topItems,
  groups,
  showParametrage,
  estSuperAdmin,
  children,
}: CabinetShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<{
    group: ShellNavGroup;
    left: number;
    top: number;
  } | null>(null);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const navRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isItemActive = (item: ShellNavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const isGroupActive = (g: ShellNavGroup) => g.items.some(isItemActive);
  const isGroupOpen = (g: ShellNavGroup) => toggled[g.id] ?? isGroupActive(g);

  // Ferme les menus au changement de page.
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  // Ferme le dropdown au clic extérieur / Échap.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (navRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Navigation hard : invalide le Router Cache pour éviter qu'un nouvel
    // utilisateur voie les données du précédent (layout mis en cache).
    window.location.href = "/login";
  }

  const crumbs = (() => {
    const segs = pathname.split("/").filter(Boolean).slice(1); // sans "cabinet"
    if (segs.length === 0) return [{ label: "Tableau de bord", href: "/cabinet" }];
    return segs.map((s, i) => ({
      label: segmentLabel(s),
      href: `/cabinet/${segs.slice(0, i + 1).join("/")}`,
    }));
  })();

  const chevron = (open: boolean) => (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="currentColor"
      className={cn("opacity-60 transition-transform", open && "rotate-180")}
    >
      <path d="M5 7L1 3h8z" />
    </svg>
  );

  // Navigation verticale utilisée dans le drawer mobile.
  const mobileNavContent = (
    <>
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
        {tenantLogoUrl ? (
          <img
            src={tenantLogoUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-lg bg-white/10 object-contain"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cabinet-600 font-display text-lg font-semibold text-white">
            {tenantName.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate font-display text-sm font-semibold text-white">
            {tenantName}
          </div>
          <div className="truncate text-[10px] uppercase tracking-wider text-gold-300/80">
            {tenantSlogan || "Gestion de cabinet"}
          </div>
        </div>
      </div>

      <div className="px-3 pb-1 pt-3">
        {topItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isItemActive(item)
                ? "bg-cabinet-600 text-white"
                : "text-cabinet-300/80 hover:bg-white/5 hover:text-white"
            )}
          >
            <span>{ICONS.home}</span>
            {item.label}
          </Link>
        ))}
      </div>

      <nav className="shell-scroll flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {groups.map((group) => {
          const active = isGroupActive(group);
          const open = isGroupOpen(group);
          return (
            <div key={group.id} className="mt-2">
              <button
                type="button"
                onClick={() =>
                  setToggled((t) => ({ ...t, [group.id]: !open }))
                }
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest transition-colors",
                  active
                    ? "text-gold-300"
                    : "text-cabinet-400/70 hover:text-cabinet-300"
                )}
              >
                <span>{ICONS[group.icon] || group.icon}</span>
                <span className="flex-1 text-left">{group.label}</span>
                {chevron(open)}
              </button>
              {open && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/5 pl-3">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors",
                        isItemActive(item)
                          ? "bg-cabinet-600 font-medium text-white"
                          : "text-cabinet-300/80 hover:bg-white/5 hover:text-cabinet-100"
                      )}
                    >
                      <span className="h-1 w-1 shrink-0 rounded-full bg-current opacity-40" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-white/10 px-3 py-3">
        {showParametrage && (
          <Link
            href="/cabinet/parametrage"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              pathname.startsWith("/cabinet/parametrage")
                ? "bg-cabinet-600 font-medium text-white"
                : "text-cabinet-300/80 hover:bg-white/5 hover:text-cabinet-100"
            )}
          >
            <span>{ICONS.parametre}</span> Paramétrage
          </Link>
        )}
        {estSuperAdmin && (
          <Link
            href="/superadmin/tenants"
            onClick={() => setMobileOpen(false)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gold-300 transition-colors hover:bg-gold-500/15"
          >
            <span>🛡️</span> Gestion des tenants
          </Link>
        )}
        <Link
          href="/aide"
          onClick={() => setMobileOpen(false)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-cabinet-300/80 transition-colors hover:bg-white/5 hover:text-cabinet-100"
        >
          <span>❓</span> Aide
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-cabinet-300/80 transition-colors hover:bg-white/5 hover:text-red-400"
        >
          <span>🚪</span> Déconnexion
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-cabinet-50">
      {/* Barre de navigation horizontale */}
      <header className="sticky top-0 z-40 bg-cabinet-950 shadow-md print:hidden">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
          {/* Hamburger mobile */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-cabinet-300 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
            </svg>
          </button>

          {/* Logo / identité */}
          <Link href="/cabinet" className="flex shrink-0 items-center gap-2.5">
            {tenantLogoUrl ? (
              <img
                src={tenantLogoUrl}
                alt=""
                className="h-8 w-8 rounded-lg bg-white/10 object-contain"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cabinet-600 font-display text-base font-semibold text-white">
                {tenantName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="hidden min-w-0 xl:block">
              <div className="max-w-44 truncate font-display text-sm font-semibold leading-tight text-white">
                {tenantName}
              </div>
              <div className="truncate text-[9px] uppercase tracking-wider text-gold-300/80">
                {tenantSlogan || "Gestion de cabinet"}
              </div>
            </div>
          </Link>

          {/* Navigation horizontale avec menus déroulants */}
          <nav
            ref={navRef}
            onScroll={() => setOpenMenu(null)}
            className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-2 lg:flex"
          >
            {topItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={cn(
                  "flex items-center whitespace-nowrap rounded-lg p-2 transition-colors",
                  isItemActive(item)
                    ? "bg-cabinet-700/70 text-white"
                    : "text-cabinet-200/90 hover:bg-white/10 hover:text-white"
                )}
              >
                {ICONS.home}
              </Link>
            ))}

            {groups.map((group) => {
              const active = isGroupActive(group);
              const open = openMenu?.group.id === group.id;
              return (
                <div key={group.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      if (open) return setOpenMenu(null);
                      const r = e.currentTarget.getBoundingClientRect();
                      setOpenMenu({
                        group,
                        left: r.left,
                        top: r.bottom + 4,
                      });
                    }}
                    aria-expanded={open}
                    aria-haspopup="true"
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                      active || open
                        ? "bg-cabinet-700/70 text-white"
                        : "text-cabinet-200/90 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <span className="text-base leading-none">{ICONS[group.icon] || group.icon}</span>
                    {group.label}
                    {chevron(open)}
                  </button>
                </div>
              );
            })}

            {showParametrage && (
              <Link
                href="/cabinet/parametrage"
                title="Paramétrage"
                aria-label="Paramétrage"
                className={cn(
                  "flex shrink-0 items-center whitespace-nowrap rounded-lg p-2 transition-colors",
                  pathname.startsWith("/cabinet/parametrage")
                    ? "bg-cabinet-700/70 text-white"
                    : "text-cabinet-200/90 hover:bg-white/10 hover:text-white"
                )}
              >
                {ICONS.parametre}
              </Link>
            )}
            {estSuperAdmin && (
              <Link
                href="/superadmin/tenants"
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-gold-300 transition-colors hover:bg-gold-500/15"
              >
                <span className="text-base leading-none">🛡️</span> Tenants
              </Link>
            )}
          </nav>

          {/* Actions à droite */}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Link
              href="/aide"
              className="hidden rounded-lg p-2 text-cabinet-300 transition-colors hover:bg-white/10 hover:text-white sm:block"
              title="Aide"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.34c-.75.3-1.15.9-1.15 1.66v.5" strokeLinecap="round" />
                <circle cx="12" cy="17" r="0.5" fill="currentColor" />
              </svg>
            </Link>

            <Link
              href="/cabinet/profil"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-white/10"
              title="Mon profil"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cabinet-600 text-xs font-semibold text-white">
                {userInitials}
              </span>
              <span className="hidden text-left 2xl:block">
                <span className="block text-xs font-semibold leading-tight text-white">{userName}</span>
                <span className="block text-[10px] leading-tight text-cabinet-300">{userRole}</span>
              </span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg p-2 text-cabinet-300 transition-colors hover:bg-white/10 hover:text-red-400"
              title="Déconnexion"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" />
                <path d="m16 17 5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Menu déroulant (fixed : la nav est en overflow-x, un absolu serait clippé) */}
      {openMenu && (
        <div
          ref={dropdownRef}
          className="fixed z-50 w-60 overflow-hidden rounded-xl border border-cabinet-200 bg-white py-1.5 shadow-xl print:hidden"
          style={{ left: openMenu.left, top: openMenu.top }}
        >
          {openMenu.group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3.5 py-2 text-[13px] transition-colors",
                isItemActive(item)
                  ? "bg-cabinet-50 font-semibold text-cabinet-900"
                  : "text-cabinet-600 hover:bg-gold-100 hover:font-semibold hover:text-cabinet-900"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  isItemActive(item) ? "bg-gold-500" : "bg-cabinet-300"
                )}
              />
              {item.label}
            </Link>
          ))}
        </div>
      )}

      {/* Fil d'ariane */}
      <div className="sticky top-14 z-30 border-b border-cabinet-200/70 bg-white/95 backdrop-blur print:hidden">
        <nav className="flex h-9 items-center px-4 sm:px-6" aria-label="Fil d'ariane">
          <ol className="flex items-center gap-1.5 truncate font-display text-[13px] font-medium text-cabinet-800">
            {crumbs.map((c, i) => (
              <li key={c.href} className="flex items-center gap-1.5 truncate">
                {i > 0 && <span className="text-cabinet-300">›</span>}
                {i === crumbs.length - 1 ? (
                  <span className="truncate text-cabinet-900">{c.label}</span>
                ) : (
                  <Link href={c.href} className="truncate text-cabinet-500 hover:text-cabinet-800 hover:underline">
                    {c.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-cabinet-950 shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 z-10 rounded-md p-1.5 text-cabinet-300 hover:bg-white/10 hover:text-white"
              aria-label="Fermer le menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {mobileNavContent}
          </aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1500px] flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
