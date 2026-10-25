import { cn } from "@/lib/utils";

interface MarqueeProps {
  children: React.ReactNode;
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  repeat?: number;
}

export function Marquee({
  children,
  className,
  reverse = false,
  pauseOnHover = true,
  repeat = 4,
}: MarqueeProps) {
  return (
    <div className={cn("group flex overflow-hidden select-none", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center gap-8 will-change-transform",
          reverse ? "animate-marquee-reverse" : "animate-marquee",
          pauseOnHover && "group-hover:[animation-play-state:paused]"
        )}
      >
        {Array.from({ length: Math.max(2, repeat) }).map((_, idx) => (
          <div key={idx} className="flex shrink-0 items-center gap-8">
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}
