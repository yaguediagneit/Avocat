"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "light" | "dark";
}

export function SpotlightCard({
  children,
  className,
  variant = "light",
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !ref.current) return;
    ref.current.style.setProperty("--x", `${e.clientX - rect.left}px`);
    ref.current.style.setProperty("--y", `${e.clientY - rect.top}px`);
  }

  const baseClasses =
    variant === "dark"
      ? "border-white/10 bg-white/[0.03] hover:border-white/20"
      : "border-cabinet-200/40 bg-white/60 hover:border-cabinet-500/30";

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={cn(
        "group relative overflow-hidden rounded-2xl p-6 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-cabinet-900/5",
        baseClasses,
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 spotlight-glow" />
      {children}
    </div>
  );
}
