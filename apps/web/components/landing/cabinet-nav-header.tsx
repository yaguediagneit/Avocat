"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LandingImage } from "@/components/landing/landing-image";
import { cn } from "@/lib/utils";

interface CabinetNavHeaderProps {
  raisonSociale: string;
  slogan?: string;
  description?: string;
  logoUrl?: string | null;
  telephonePrincipal?: string;
  email?: string;
  hasPresentation?: boolean;
  hasSpecialites?: boolean;
  hasValeurs?: boolean;
  hasTemoignages?: boolean;
  hasContact?: boolean;
}

export function CabinetNavHeader({
  raisonSociale,
  slogan,
  description,
  logoUrl,
  telephonePrincipal,
  email,
  hasPresentation,
  hasSpecialites,
  hasValeurs,
  hasTemoignages,
  hasContact,
}: CabinetNavHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const navLinks = [
    hasPresentation && { href: "#presentation", label: "Présentation" },
    hasSpecialites && { href: "#specialites", label: "Spécialités" },
    hasValeurs && { href: "#valeurs", label: "Nos valeurs" },
    hasTemoignages && { href: "#temoignages", label: "Témoignages" },
    hasContact && { href: "#contact", label: "Contact" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        scrolled || mobileMenuOpen
          ? "border-b border-gold-400/20 bg-cabinet-950/95 backdrop-blur-md shadow-xl shadow-black/25"
          : "border-b border-white/10 bg-cabinet-950/85 backdrop-blur-sm"
      )}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Identité Cabinet */}
        <Link href="/" className="flex min-w-0 items-center gap-3 text-white group">
          {logoUrl ? (
            <LandingImage
              src={logoUrl}
              alt=""
              width={56}
              height={56}
              priority
              className="h-12 w-12 shrink-0 rounded-xl bg-white/10 object-contain p-1 ring-1 ring-white/15 transition-transform duration-300 group-hover:scale-105 sm:h-14 sm:w-14"
            />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cabinet-700 to-cabinet-900 font-display text-2xl font-semibold text-gold-300 ring-1 ring-white/15 transition-transform duration-300 group-hover:scale-105 sm:h-14 sm:w-14 sm:text-3xl">
              {raisonSociale.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex min-w-0 flex-col justify-center">
            <span className="truncate font-display text-base font-semibold tracking-tight text-white sm:text-lg md:text-xl">
              {raisonSociale}
            </span>
            {slogan ? (
              <span className="truncate text-[11px] text-gold-300/90 sm:text-xs">
                {slogan}
              </span>
            ) : description ? (
              <span className="truncate text-[11px] text-cabinet-300/80 sm:text-xs">
                {description}
              </span>
            ) : null}
          </div>
        </Link>

        {/* Navigation Desktop par ancres */}
        {navLinks.length > 0 && (
          <nav className="hidden items-center gap-5 text-xs font-medium xl:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="whitespace-nowrap text-cabinet-200/80 transition hover:text-gold-300 hover:underline underline-offset-8 decoration-gold-400/60"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

        {/* Actions rapides & Liens d'accès */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Raccourcis contact direct desktop */}
          <div className="hidden items-center gap-1.5 md:flex">
            {telephonePrincipal && (
              <a
                href={`tel:${telephonePrincipal.replace(/\s+/g, "")}`}
                aria-label="Appeler le cabinet"
                title={telephonePrincipal}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-cabinet-200 transition hover:border-gold-400/40 hover:bg-gold-500/10 hover:text-gold-300"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                aria-label="Envoyer un email au cabinet"
                title={email}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-cabinet-200 transition hover:border-gold-400/40 hover:bg-gold-500/10 hover:text-gold-300"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </a>
            )}
          </div>

          {/* Bouton Intranet */}
          <div className="hidden items-center gap-2 sm:flex">
            <Link
              href="/cabinet"
              className="btn-primary px-3.5 py-1.5 text-xs md:text-sm"
            >
              Intranet
            </Link>
          </div>

          {/* Bouton Hamburger Mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu de navigation"}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:bg-white/10 xl:hidden"
          >
            {mobileMenuOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Menu mobile dépliable */}
      {mobileMenuOpen && (
        <div className="border-t border-white/10 bg-cabinet-950/98 px-6 py-5 backdrop-blur-2xl xl:hidden animate-fade-in">
          {navLinks.length > 0 && (
            <nav className="mb-5 flex flex-col gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-cabinet-100 transition hover:bg-white/10 hover:text-gold-300"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}

          {/* Raccourcis de contact direct mobile */}
          {(telephonePrincipal || email) && (
            <div className="mb-4 flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
              {telephonePrincipal && (
                <a
                  href={`tel:${telephonePrincipal.replace(/\s+/g, "")}`}
                  className="flex items-center gap-2.5 text-cabinet-200 hover:text-white"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-gold-300">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </span>
                  <span>{telephonePrincipal}</span>
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2.5 text-cabinet-200 hover:text-white"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-gold-300">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </span>
                  <span className="truncate">{email}</span>
                </a>
              )}
            </div>
          )}

          {/* Boutons d'accès mobile */}
          <div className="grid gap-3 pt-2">
            <Link
              href="/cabinet"
              onClick={() => setMobileMenuOpen(false)}
              className="btn-primary py-2.5 text-center text-xs"
            >
              Intranet
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
