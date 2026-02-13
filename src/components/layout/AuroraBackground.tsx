export function AuroraBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Violet blob */}
      <div
        className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full opacity-20 blur-[120px] animate-aurora-float"
        style={{ background: "hsl(var(--aurora-violet))" }}
      />
      {/* Teal blob */}
      <div
        className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full opacity-15 blur-[120px] animate-aurora-float"
        style={{
          background: "hsl(var(--aurora-teal))",
          animationDelay: "-5s",
        }}
      />
      {/* Subtle noise overlay */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
    </div>
  );
}
