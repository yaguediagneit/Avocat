"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { HeroSlide } from "@/components/landing/landing-defaults";

interface HeroSlidesProps {
  slides: HeroSlide[];
  ctaHref: string;
  interval?: number;
}

/** Rotation et navigation interactive des accroches du hero */
export function HeroSlides({ slides, ctaHref, interval = 9000 }: HeroSlidesProps) {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setActive((i) => (i + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setActive((i) => (i - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timer = setInterval(nextSlide, interval);
    return () => clearInterval(timer);
  }, [slides.length, interval, isPaused, nextSlide]);

  if (slides.length === 0) return null;
  const displayIndex = active % slides.length;

  return (
    <div
      className="relative mx-auto flex w-full max-w-4xl flex-col items-center"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Accroches du cabinet"
    >
      {/* Zone des slides */}
      <div className="relative min-h-[240px] w-full sm:min-h-[210px] md:min-h-[190px]">
        {slides.map((slide, i) => {
          const isCurrent = i === displayIndex;
          const ctaText = slide.cta?.trim() || "Contactez-nous";
          return (
            <div
              key={i}
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-6 px-4 text-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform]",
                isCurrent
                  ? "pointer-events-auto opacity-100 translate-y-0 scale-100"
                  : "pointer-events-none opacity-0 translate-y-8 scale-[0.97]"
              )}
              aria-hidden={!isCurrent}
            >
              {slide.titre?.trim() && (
                <h1
                  className="font-display text-4xl font-medium leading-[1.1] tracking-tight text-balance text-white drop-shadow-lg sm:text-5xl md:text-6xl lg:text-7xl"
                  style={{
                    color: slide.couleur || undefined,
                    fontFamily: slide.police || undefined,
                    fontSize: slide.tailleTitre || undefined,
                  }}
                >
                  {slide.titre}
                </h1>
              )}

              {slide.detail?.trim() && (
                <p
                  className="max-w-2xl text-base leading-relaxed text-cabinet-100/90 drop-shadow sm:text-lg md:text-xl"
                  style={{
                    color: slide.couleur || undefined,
                    fontFamily: slide.police || undefined,
                    fontSize: slide.tailleDetail || undefined,
                  }}
                >
                  {slide.detail}
                </p>
              )}

              {ctaText && (
                <div className="pt-2">
                  <a
                    href={ctaHref}
                    className="inline-flex items-center gap-2.5 rounded-xl border border-gold-400/40 bg-gradient-to-r from-gold-500/20 to-cabinet-600/30 px-7 py-3.5 text-base font-medium text-white shadow-xl shadow-black/20 backdrop-blur-md transition-all duration-300 hover:border-gold-400 hover:bg-gold-500 hover:text-cabinet-950 active:scale-[0.98]"
                  >
                    <span>{ctaText}</span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Contrôles de navigation : puces et flèches */}
      {slides.length > 1 && (
        <div className="relative z-30 mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Diapositive précédente"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/80 backdrop-blur-sm transition-colors hover:border-gold-400/60 hover:bg-white/15 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            {slides.map((_, idx) => {
              const activeDot = idx === displayIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActive(idx)}
                  aria-label={`Aller à la diapositive ${idx + 1}`}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    activeDot
                      ? "w-8 bg-gold-400 shadow-sm shadow-gold-400/50"
                      : "w-2 bg-white/40 hover:bg-white/70"
                  )}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={nextSlide}
            aria-label="Diapositive suivante"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/80 backdrop-blur-sm transition-colors hover:border-gold-400/60 hover:bg-white/15 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
