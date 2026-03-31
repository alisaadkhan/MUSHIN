export function AuroraBackground() {
  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      style={{ contain: "layout style" }}
    >
      {/* Primary violet — top-right */}
      <div
        className="absolute -top-48 -right-48 h-[700px] w-[700px] rounded-full opacity-[0.14] blur-[160px] animate-aurora-float"
        style={{
          background: "hsl(var(--aurora-violet))",
          willChange: "transform",
        }}
      />
      {/* Secondary deep violet — bottom-left */}
      <div
        className="absolute -bottom-48 -left-48 h-[600px] w-[600px] rounded-full opacity-[0.10] blur-[160px] animate-aurora-float"
        style={{
          background: "hsl(var(--aurora-teal))",
          animationDelay: "-5s",
          willChange: "transform",
        }}
      />
      {/* Tertiary centered glow — depth layer */}
      <div
        className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full opacity-[0.05] blur-[120px] animate-aurora-float"
        style={{
          background: "hsl(270 91% 72%)",
          animationDelay: "-9s",
          willChange: "transform",
        }}
      />
      {/* Dot grid */}
      <div className="absolute inset-0 dot-grid-overlay opacity-40" />
    </div>
  );
}
