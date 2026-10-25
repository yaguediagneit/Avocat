import { cn } from "@/lib/utils";

export function HeroVisual() {
  return (
    <div className="relative h-full w-full overflow-visible p-2 perspective-1000 lg:p-4">
      <div className="preserve-3d absolute inset-0 flex items-center justify-center">
        <div className="absolute h-48 w-48 rounded-full bg-gold-500/15 blur-[80px] xl:h-56 xl:w-56" />

        <div
          className="relative z-10 w-56 rounded-2xl border border-white/10 bg-gradient-to-br from-cabinet-800/90 to-cabinet-950/90 p-4 shadow-2xl shadow-cabinet-950/50 backdrop-blur-xl animate-float xl:w-64 xl:p-6"
          style={{ animationDuration: "14s" }}
        >
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-cabinet-200/70 xl:text-xs">
            <span className="h-2 w-2 rounded-full bg-gold-400" />
            Justice
          </div>
          <ScaleIcon className="mx-auto h-20 w-20 text-gold-300 drop-shadow-[0_0_30px_rgba(234,191,115,0.28)] xl:h-24 xl:w-24" />
          <div className="mt-3 text-center font-display text-lg text-white xl:mt-4 xl:text-xl">
            Équilibre & Droit
          </div>
        </div>

        <FloatingCard className="left-0 top-6 w-28 -rotate-6 xl:w-32" delay="1s" duration="15s">
          <Building2Icon className="h-8 w-8 text-cabinet-100 xl:h-10 xl:w-10" />
          <div className="mt-1 text-[10px] text-cabinet-100/80 xl:text-xs">Cabinet</div>
        </FloatingCard>

        <FloatingCard className="right-0 top-6 w-28 rotate-12 xl:w-32" delay="2s" duration="17s">
          <LandmarkIcon className="h-8 w-8 text-cabinet-100 xl:h-10 xl:w-10" />
          <div className="mt-1 text-[10px] text-cabinet-100/80 xl:text-xs">Tribunal</div>
        </FloatingCard>

        <FloatingCard className="bottom-6 right-0 w-32 rotate-3 xl:w-36" delay="3s" duration="16s">
          <FileTextIcon className="h-8 w-8 text-cabinet-100 xl:h-10 xl:w-10" />
          <div className="mt-1 text-[10px] text-cabinet-100/80 xl:text-xs">Dossiers</div>
        </FloatingCard>

        <FloatingCard className="bottom-6 left-0 w-32 -rotate-3 xl:w-36" delay="4s" duration="18s">
          <BookOpenIcon className="h-8 w-8 text-cabinet-100 xl:h-10 xl:w-10" />
          <div className="mt-1 text-[10px] text-cabinet-100/80 xl:text-xs">Jurisprudence</div>
        </FloatingCard>
      </div>
    </div>
  );
}

function FloatingCard({
  children,
  className,
  delay = "0s",
  duration = "12s",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: string;
  duration?: string;
}) {
  return (
    <div
      className={cn(
        "absolute flex flex-col items-center rounded-xl border border-white/10 bg-white/[0.04] p-2 shadow-2xl shadow-cabinet-950/30 backdrop-blur-xl animate-float xl:p-3",
        className
      )}
      style={{ animationDelay: delay, animationDuration: duration }}
    >
      {children}
    </div>
  );
}

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3v18" />
      <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />
      <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />
      <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />
      <path d="M7 21h10" />
    </svg>
  );
}

function Building2Icon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 12h4" />
      <path d="M10 8h4" />
      <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
      <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
      <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}

function LandmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="3" x2="21" y1="22" y2="22" />
      <line x1="6" x2="6" y1="18" y2="11" />
      <line x1="10" x2="10" y1="18" y2="11" />
      <line x1="14" x2="14" y1="18" y2="11" />
      <line x1="18" x2="18" y1="18" y2="11" />
      <polygon points="12 2 20 7 4 7" />
    </svg>
  );
}
