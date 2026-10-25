"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavDropdownItem {
  href: string;
  label: string;
}

interface NavDropdownProps {
  label: string;
  items: NavDropdownItem[];
  baseHref: string;
  className?: string;
}

export function NavDropdown({ label, items, baseHref, className }: NavDropdownProps) {
  const pathname = usePathname();
  const active =
    pathname === baseHref ||
    pathname.startsWith(`${baseHref}/`) ||
    items.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className={cn(
          "rounded-md border px-3 py-1.5 text-sm font-medium transition",
          active
            ? "border-gold-400 bg-gold-400/15 text-white"
            : "border-white/30 bg-white/5 text-cabinet-100 hover:bg-white/10",
          className
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 min-w-[20rem] pt-2">
          <div className="overflow-hidden rounded-md border border-white/10 bg-cabinet-900 shadow-lg">
            <ul className="py-1" role="menu">
              {items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href} role="none">
                    <Link
                      href={item.href}
                      role="menuitem"
                      className={cn(
                        "block px-4 py-2 text-sm transition",
                        isActive
                          ? "bg-gold-400/15 font-semibold text-white"
                          : "text-cabinet-100 hover:bg-gold-400/20 hover:font-semibold hover:text-white"
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
