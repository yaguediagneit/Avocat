export function AuroraBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-1/4 -top-1/4 h-[55rem] w-[55rem] rounded-full bg-cabinet-600/20 blur-[120px] animate-float" />
      <div className="absolute -right-1/4 bottom-0 h-[48rem] w-[48rem] rounded-full bg-cabinet-500/15 blur-[100px] animate-float" style={{ animationDelay: "3s" }} />
      <div className="absolute left-1/3 top-1/3 h-[28rem] w-[28rem] rounded-full bg-gold-500/8 blur-[80px] animate-float" style={{ animationDelay: "6s" }} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(74,111,165,0.08),transparent_50%)]" />
    </div>
  );
}
