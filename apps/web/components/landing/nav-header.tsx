"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function NavHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fermer le menu mobile lors du redimensionnement vers desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const navLinks = [
    { href: "#fonctionnalites", label: "Fonctionnalités" },
    { href: "#securite", label: "Sécurité" },
    { href: "#faq", label: "FAQ" },
    { href: "#offre", label: "Offre & Tarifs" },
  ];

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        scrolled || mobileMenuOpen
          ? "border-b border-white/10 bg-cabinet-950/90 backdrop-blur-lg shadow-lg shadow-black/20"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
          <span>cabinet-avocat<span className="text-gold-400">.</span>sn</span>
        </Link>

        {/* Navigation Desktop */}
        <nav className="hidden items-center gap-8 text-sm font-medium text-cabinet-100 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-cabinet-200/80 transition-colors hover:text-white hover:underline underline-offset-8 decoration-gold-400"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action Desktop */}
        <div className="hidden items-center gap-4 md:flex">
          <Link href="/login" className="btn-primary text-sm px-6 py-2.5">
            Se connecter
          </Link>
        </div>

        {/* Bouton Hamburger Mobile */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu de navigation"}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white transition hover:bg-white/10 md:hidden"
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

      {/* Menu Déroulant Mobile */}
      {mobileMenuOpen && (
        <div className="border-t border-white/10 bg-cabinet-950/95 px-6 py-6 backdrop-blur-xl md:hidden animate-fade-in">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-base font-medium text-cabinet-100 transition hover:bg-white/10 hover:text-white"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-4 pt-4 border-t border-white/10">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="btn-primary w-full text-center py-3 text-base"
              >
                Se connecter
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
