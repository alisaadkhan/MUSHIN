import * as React from "react";
import { cn } from "@/lib/utils";
import { motion, type MotionValue } from "framer-motion";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: "low" | "medium" | "high";
  interactive?: boolean;
  mouseX?: MotionValue<number>;
  mouseY?: MotionValue<number>;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, intensity = "medium", interactive = false, mouseX, mouseY, children, ...props }, ref) => {
    
    // Intensity defines the blur mapping and opacity floors
    const bgMap = {
      low: "bg-white/[0.01] backdrop-blur-sm",
      medium: "bg-white/[0.03] backdrop-blur-md",
      high: "bg-white/[0.06] backdrop-blur-xl"
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)]",
          bgMap[intensity],
          interactive && "transition-all duration-300 hover:border-purple-500/30 hover:shadow-[0_8px_32px_-8px_rgba(168,85,247,0.25)] hover:-translate-y-1 cursor-pointer",
          className
        )}
        {...props}
      >
        {/* Spotlight Effect Layer */}
        {mouseX && mouseY && (
          <motion.div
            className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
            style={{
              background: `radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(168,85,247,0.15), transparent 80%)`,
            }}
          />
        )}

        {/* Inner 1px Highlight mimicking macOS/SaaS depth */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl border border-white/[0.05]" style={{ transform: 'scale(0.995)' }} />
        
        {/* Subtle noise texture */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")', mixBlendMode: 'overlay' }} />
        
        {/* Content plane */}
        <div className="relative z-10 w-full h-full">
          {children}
        </div>
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export { GlassCard };
