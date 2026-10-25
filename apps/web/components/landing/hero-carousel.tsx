"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LandingImage } from "@/components/landing/landing-image";

interface HeroCarouselProps {
  images: string[];
  interval?: number;
  className?: string;
  index?: number;
}

export function HeroCarousel({ images, interval = 10000, className, index }: HeroCarouselProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const isControlled = index !== undefined;
  const displayIndex = isControlled ? index : internalIndex;
  const imageIndex = images.length > 0 ? displayIndex % images.length : 0;

  useEffect(() => {
    if (images.length <= 1 || isControlled) return;
    const timer = setInterval(() => {
      setInternalIndex((i) => (i + 1) % images.length);
    }, interval);
    return () => clearInterval(timer);
  }, [images.length, interval, isControlled]);

  const getOffset = (i: number) => {
    if (i === imageIndex || images.length <= 1) return 0;
    let d = i - imageIndex;
    const half = images.length / 2;
    if (d > half) d -= images.length;
    if (d < -half) d += images.length;
    return d > 0 ? 8 : -8;
  };

  if (images.length === 0) {
    return (
      <div className={cn("absolute inset-0 bg-gradient-to-br from-cabinet-900 to-cabinet-950", className)}>
        <div className="absolute inset-0 bg-grid opacity-30" />
      </div>
    );
  }

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {images.map((src, i) => {
        const isActive = i === imageIndex;
        const offset = getOffset(i);
        return (
          <div
            key={`${src}-${i}`}
            className={cn(
              "absolute inset-0 transition-[transform,opacity] duration-[1800ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[transform,opacity]",
              isActive ? "z-10 opacity-100" : "-z-10 opacity-0"
            )}
            style={{
              transform: isActive ? "translateX(0%) scale(1)" : `translateX(${offset}%) scale(1.05)`,
            }}
          >
            <LandingImage
              src={src}
              alt=""
              fill
              sizes="100vw"
              priority={i === 0}
              className={cn("object-cover", isActive && "animate-ken-burns")}
            />
          </div>
        );
      })}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cabinet-950/75 via-cabinet-950/50 to-cabinet-950/85" />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-15" />
    </div>
  );
}
