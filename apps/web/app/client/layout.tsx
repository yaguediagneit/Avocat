import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { NavLink } from "@/components/nav-link";
import { LogoutButton } from "@/components/logout-button";
import { SearchCommand } from "@/components/search-command";
import { MobileNav } from "@/components/mobile-nav";

const LINKS = [
  { href: "/client", label: "Accueil", exact: true },
  { href: "/client/dossiers", label: "Mes dossiers" },
  { href: "/client/documents", label: "Mes documents" },
  { href: "/client/factures", label: "Mes factures" },
];

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const [client, user] = await Promise.all([
    session.clientId
      ? prisma.client.findUnique({
          where: { id: session.clientId },
          select: { raisonSociale: true },
        })
      : null,
    session.userId
      ? prisma.user.findUnique({
          where: { id: session.userId },
          select: { prenom: true, nom: true },
        })
      : null,
  ]);
  const fullName = user ? `${user.prenom} ${user.nom}`.trim() : "";
  const initials = user
    ? `${user.prenom.charAt(0)}${user.nom.charAt(0)}`.toUpperCase()
    : client?.raisonSociale.charAt(0) || "";

  return (
    <div className="min-h-screen bg-cabinet-50">
      <header className="bg-cabinet-700 text-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
          <Link href="/client" className="mr-6 text-lg font-bold tracking-tight">
            <span className="text-gold-300">Espace</span> client
          </Link>
          <nav className="hidden gap-6 md:flex">
            {LINKS.map((l) => (
              <NavLink key={l.href} href={l.href} exact={l.exact}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/aide"
              className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-sm text-cabinet-100 transition hover:bg-white/10 hover:text-white sm:flex"
              title="Aide & Guide complet"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
              Aide
            </Link>
            <SearchCommand apiUrl="/api/client/search" label="Recherche" />
            {(client || user) && (
              <Link
                href="/client/profil"
                className="flex items-center gap-3 rounded-md px-2 py-1 transition hover:bg-white/10"
                title="Mon profil"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-400 text-xs font-semibold text-cabinet-900">
                  {initials}
                </span>
                <div className="hidden leading-tight sm:block">
                  <p className="text-sm font-medium">{fullName || client?.raisonSociale}</p>
                  {fullName && client && (
                    <p className="text-xs text-cabinet-100/80">{client.raisonSociale}</p>
                  )}
                </div>
              </Link>
            )}
            <MobileNav
              links={LINKS.map(({ href, label }) => ({ href, label }))}
              panelClassName="bg-cabinet-700"
            />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
