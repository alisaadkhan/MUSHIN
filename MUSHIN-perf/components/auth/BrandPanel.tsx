import { Shield, TrendingUp, Lock } from "lucide-react";

export default function BrandPanel() {
  return (
    <div
      className="hidden lg:flex flex-1 flex-col justify-center p-12 border-l border-border relative overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 30% 40%, rgba(88,28,135,0.12) 0%, transparent 65%), radial-gradient(ellipse 50% 50% at 80% 80%, rgba(109,40,217,0.08) 0%, transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(168,85,247,0.12) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 80% 80% at 30% 40%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 30% 40%, black 40%, transparent 100%)",
        }}
      />

      <div className="relative z-10 max-w-md">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/8 mb-8">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Pakistan's Creator Intelligence Platform
          </span>
        </div>

        <h1
          className="text-4xl font-extrabold text-foreground leading-tight mb-4"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          無心 — Pure clarity.
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #a855f7 0%, #c084fc 50%, #7c3aed 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Real creators.
          </span>
        </h1>

        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          MUSHIN means "no mind" — the samurai state of total clarity. We bring that clarity to
          creator discovery. Cut through fake followers. See what's real.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {[
            ["10K+", "Creators Indexed"],
            ["98.2%", "Fraud Accuracy"],
            ["12+", "Cities Covered"],
            ["4.2×", "Avg ROAS Lift"],
          ].map(([v, l]) => (
            <div
              key={l}
              className="rounded-xl border border-border bg-card/60 p-4"
            >
              <div
                className="text-xl font-extrabold text-primary"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                {v}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{l}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-5">
          {(
            [
              [Shield, "Fraud scored"],
              [TrendingUp, "AI powered"],
              [Lock, "GDPR safe"],
            ] as const
          ).map(([Icon, label]) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon size={12} className="text-primary" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
