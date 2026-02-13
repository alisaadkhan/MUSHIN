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
      viewBox="0 0 400 400"
      className="w-full max-w-sm mx-auto opacity-60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.6 }}
      transition={{ duration: 1, delay: 0.5 }}
      aria-hidden
    >
      <defs>
        <linearGradient id="node-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--aurora-violet))" />
          <stop offset="100%" stopColor="hsl(var(--aurora-teal))" />
        </linearGradient>
      </defs>
      {[
        [200, 80, 100, 200], [200, 80, 300, 200], [100, 200, 200, 320],
        [300, 200, 200, 320], [100, 200, 300, 200], [200, 80, 200, 320],
        [60, 140, 100, 200], [340, 140, 300, 200], [60, 280, 200, 320], [340, 280, 200, 320],
      ].map(([x1, y1, x2, y2], i) => (
        <motion.line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="url(#node-grad)" strokeWidth="1" strokeOpacity="0.25"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.6 + i * 0.08 }} />
      ))}
      {[[200, 80, 8], [100, 200, 6], [300, 200, 6], [200, 320, 8], [60, 140, 4], [340, 140, 4], [60, 280, 4], [340, 280, 4]].map(([cx, cy, r], i) => (
        <motion.circle key={i} cx={cx} cy={cy} r={r} fill="url(#node-grad)"
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.8 }} transition={{ duration: 0.4, delay: 0.8 + i * 0.1 }} />
      ))}
      <motion.circle cx="200" cy="200" r="12" fill="url(#node-grad)"
        animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />
    </motion.svg>
  );
}

const PROOF_METRICS = [
  { value: "10,000+", label: "searches run" },
  { value: "99%", label: "fraud accuracy" },
  { value: "4.9/5", label: "avg rating" },
];

interface HeroProps {
  ctaPath: string;
  ctaLabel: string;
}

export function Hero({ ctaPath, ctaLabel }: HeroProps) {
  return (
    <section className="relative pt-40 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          <motion.h1 custom={0} variants={fadeUp}
            className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight">
            The Influencer Discovery Platform That{" "}
            <span className="aurora-text">Pays for Itself</span>
          </motion.h1>

          <motion.p custom={1} variants={fadeUp}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl">
            Find verified creators, detect fraud before you spend, and run outreach
            campaigns — all from one workspace. Used by 2,000+ marketing teams.
          </motion.p>

          <motion.div custom={2} variants={fadeUp} className="space-y-3">
            <Link to={ctaPath}>
              <Button size="lg" className="btn-shine text-base px-10 py-6">
                {ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground">
              No credit card required. Cancel anytime.
            </p>
          </motion.div>

          {/* Inline social proof */}
          <motion.div custom={3} variants={fadeUp}
            className="flex flex-wrap items-center gap-6 pt-4">
            {PROOF_METRICS.map((m, i) => (
              <div key={m.label} className="flex items-center gap-2">
                {i > 0 && <span className="hidden sm:block h-4 w-px bg-border" />}
                <span className="data-mono text-sm font-semibold text-foreground">{m.value}</span>
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <div className="hidden md:block">
          <NetworkGraphic />
        </div>
      </div>
    </section>
  );
}
