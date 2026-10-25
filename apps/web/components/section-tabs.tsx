"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SectionTabItem {
  href: string;
  label: string;
  /// Onglet actif uniquement sur le chemin exact (par défaut : préfixe,
  /// l'onglet au plus long href correspondant gagne).
  exact?: boolean;
}

/// Barre d'onglets de navigation entre sections (liens, état actif déduit de
/// l'URL). `variant="sub"` rend une seconde ligne de liens plus discrète pour
/// la sous-navigation d'une section.
export function SectionTabs({
  items,
  variant = "main",
}: {
  items: SectionTabItem[];
  variant?: "main" | "sub";
}) {
  const pathname = usePathname();
  const matches = (it: SectionTabItem) =>
    it.exact
      ? pathname === it.href
      : pathname === it.href || pathname.startsWith(`${it.href}/`);
  const activeHref = items
    .filter(matches)
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  if (variant === "sub") {
    return (
      <nav className="flex flex-wrap items-center gap-1">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              it.href === activeHref
                ? "bg-cabinet-100 text-cabinet-800"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            )}
          >
            {it.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex overflow-x-auto border-b border-gray-200">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={cn(
            "whitespace-nowrap px-6 py-2.5 text-sm font-medium transition-colors",
            it.href === activeHref
              ? "border-b-2 border-cabinet-700 text-cabinet-800"
              : "text-gray-500 hover:text-cabinet-700"
          )}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
