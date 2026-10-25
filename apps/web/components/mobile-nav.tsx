"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkDef {
  href: string;
  label: string;
  className?: string;
}

interface MobileNavProps {
  links: NavLinkDef[];
  adminLinks?: NavLinkDef[];
  estSuperAdmin?: boolean;
  panelClassName?: string;
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MobileNav({ links, adminLinks, estSuperAdmin, panelClassName }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-white/30 bg-white/5 p-2 text-white transition hover:bg-white/10 md:hidden"
        aria-label="Ouvrir le menu"
      >
        <MenuIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className={cn("absolute right-0 top-0 h-full w-72 p-4 shadow-xl", panelClassName || "bg-cabinet-900")}>
            <div className="mb-6 flex items-center justify-between">
              <span className="font-semibold text-white">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-cabinet-200 transition hover:text-white"
                aria-label="Fermer"
              >
                <CloseIcon />
              </button>
            </div>
            <nav className="space-y-2">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-md border px-3 py-2 text-sm font-medium transition",
                    isActive(l.href)
                      ? "border-gold-400 bg-gold-400/15 text-white"
                      : "border-white/30 bg-white/5 text-cabinet-100 hover:bg-white/10 hover:text-white",
                    l.className
                  )}
                >
                  {l.label}
                </Link>
              ))}
              {adminLinks?.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-md border px-3 py-2 text-sm font-medium transition",
                    isActive(l.href)
                      ? "border-gold-400 bg-gold-400/15 text-white"
                      : "border-white/30 bg-white/5 text-cabinet-100 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {l.label}
                </Link>
              ))}
              {estSuperAdmin && (
                <Link
                  href="/superadmin/tenants"
                  onClick={() => setOpen(false)}
                  className="block rounded-md border border-gold-400 bg-gold-500/15 px-3 py-2 text-sm font-medium text-white transition hover:bg-gold-500/25"
                >
                  Gestion des tenants
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
