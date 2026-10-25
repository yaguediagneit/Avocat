import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { isSuperAdmin } from "@/lib/superadmin";
import { LogoutButton } from "@/components/logout-button";
import { MobileNav } from "@/components/mobile-nav";

interface SuperadminLayoutProps {
  children: React.ReactNode;
}

const MENU = [
  { href: "/superadmin", label: "Vue d'ensemble", icon: "dashboard" },
  { href: "/superadmin/tenants/nouveau", label: "Nouveau tenant", icon: "plus" },
  { href: "/superadmin/tenants", label: "gérer les tenants", icon: "list" },
  { href: "/superadmin/plans", label: "Plans & Tarifs", icon: "tag" },
];

function Icon({ name }: { name: string }) {
  if (name === "dashboard") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
    );
  }
  if (name === "plus") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
    );
  }
  if (name === "list") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
  );
}

export default async function SuperadminLayout({ children }: SuperadminLayoutProps) {
  const session = await getSession();

  if (!session.userId || !session.mfaVerified || !(await isSuperAdmin(session.email || ""))) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#1e1b4b] text-white lg:flex-row">
      <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#1e1b4b] p-4 lg:block">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold">Yague Diagne</p>
            <p className="text-xs text-white/60">Super Admin</p>
          </div>
        </div>
        <nav className="space-y-1">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <Icon name={m.icon} />
              {m.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-8">
          <LogoutButton />
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-white/10 bg-[#1e1b4b] px-4 lg:hidden">
          <span className="font-semibold">Super Admin</span>
          <div className="flex items-center gap-2">
            <MobileNav
              links={MENU.map(({ href, label }) => ({ href, label }))}
              panelClassName="bg-[#1e1b4b]"
            />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
