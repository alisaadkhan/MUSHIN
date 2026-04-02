export function AuroraBackground() {
  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[#060608]"
      style={{
        backgroundImage: `
          radial-gradient(circle at 80% 0%, hsl(var(--aurora-violet) / 0.15) 0%, transparent 50%),
          radial-gradient(circle at 20% 100%, hsl(var(--aurora-teal) / 0.10) 0%, transparent 50%)
        `,
        contain: "strict"
      }}
    >
      {/* Dot grid - consistent with branding */}
      <div className="absolute inset-0 dot-grid-overlay opacity-30" />
      
      {/* Subtle bottom-edge depth */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}
