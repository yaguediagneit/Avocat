"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  exact?: boolean;
  className?: string;
}

export function NavLink({ href, children, exact, className }: NavLinkProps) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm font-medium transition",
        active
          ? "border-gold-400 bg-gold-400/15 text-white"
          : "border-white/30 bg-white/5 text-cabinet-100 hover:bg-white/10",
        className
      )}
    >
      {children}
    </Link>
  );
}
