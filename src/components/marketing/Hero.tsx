import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.12 },
  }),
};

function NetworkGraphic() {
  return (
    <motion.svg
      viewBox="0 0 420 320"
      fill="none"
      width={420}
      height={320}
      className="w-full max-w-md mx-auto"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, delay: 0.4 }}
    >
      <defs>
        <linearGradient id="grad-vi" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(263 70% 58%)" />
          <stop offset="100%" stopColor="hsl(174 83% 46%)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {/* connections */}
      {[
        [110, 80, 210, 160], [210, 160, 310, 90], [210, 160, 160, 250],
        [210, 160, 310, 240], [110, 80, 60, 180], [60, 180, 160, 250],
        [310, 90, 360, 200], [360, 200, 310, 240],
      ].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#grad-vi)" strokeWidth="1" opacity="0.25" />
      ))}
      {/* nodes */}
      {[
        [210, 160, 14], [110, 80, 10], [310, 90, 10], [160, 250, 8],
        [310, 240, 8], [60, 180, 6], [360, 200, 6],
      ].map(([cx, cy, r], i) => (
        <motion.circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="url(#grad-vi)"
          opacity={0.6}
          filter="url(#glow)"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.6 + i * 0.08, type: "spring", stiffness: 200 }}
        />
      ))}
      {/* pulse on center */}
      <motion.circle
        cx={210}
        cy={160}
        r={24}
        fill="none"
        stroke="url(#grad-vi)"
        strokeWidth="1"
        opacity={0.3}
        animate={{ r: [24, 40], opacity: [0.3, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
      />
    </motion.svg>
  );
}

interface HeroProps {
  ctaPath: string;
  ctaLabel: string;
  onScrollToFeatures: () => void;
}

export function Hero({ ctaPath, ctaLabel, onScrollToFeatures }: HeroProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 md:px-12 lg:px-24 pt-24 pb-16">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        {/* Text */}
        <motion.div initial="hidden" animate="visible" className="space-y-8 text-center md:text-left">
          <motion.h1 variants={fadeUp} custom={0} className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight">
            Find <span className="aurora-text">Real Influencers</span>. Instantly.
          </motion.h1>
          <motion.p variants={fadeUp} custom={1} className="text-lg md:text-xl text-muted-foreground max-w-lg">
            Live influencer discovery with fraud detection, real engagement metrics, and agency‑ready workflows. No stale databases. No locked contracts.
          </motion.p>
          <motion.div variants={fadeUp} custom={2} className="flex flex-col sm:flex-row items-center gap-4 md:justify-start justify-center">
            <Link to={ctaPath}>
              <Button size="lg" className="btn-shine text-base px-8 py-6">
                {ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-base px-8 py-6" onClick={onScrollToFeatures}>
              See How It Works
            </Button>
          </motion.div>
        </motion.div>

        {/* Visual */}
        <div className="hidden md:block">
          <div className="glass-card p-8 rounded-2xl">
            <NetworkGraphic />
          </div>
        </div>
      </div>
    </section>
  );
}
