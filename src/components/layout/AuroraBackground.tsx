export function AuroraBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div
        className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full opacity-10 blur-[140px] animate-aurora-float"
        style={{ background: "hsl(var(--aurora-violet))" }}
      />
      <div
        className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full opacity-7 blur-[140px] animate-aurora-float"
        style={{ background: "hsl(var(--aurora-teal))", animationDelay: "-5s" }}
      />
      <div className="absolute inset-0 dot-grid-overlay opacity-50" />
    </div>
  );
}
