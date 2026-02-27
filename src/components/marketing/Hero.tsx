import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, ShieldCheck, TrendingUp, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.12 },
  }),
};

const MOCK_ROWS = [
  { name: "Zara Khalid", platform: "Instagram", city: "Karachi", followers: "1.2M", engagement: "4.8%", score: 97 },
  { name: "Hassan Ali", platform: "YouTube", city: "Lahore", followers: "890K", engagement: "6.1%", score: 94 },
  { name: "Ayesha Noor", platform: "TikTok", city: "Islamabad", followers: "2.1M", engagement: "3.9%", score: 91 },
  { name: "Bilal Khan", platform: "Instagram", city: "Faisalabad", followers: "540K", engagement: "5.3%", score: 88 },
];

const FLOATING_BADGES = [
  { label: "Fraud Score", value: "97", x: "-10%", y: "15%", delay: 0 },
  { label: "Live Data", value: "●", x: "95%", y: "5%", delay: 1.5 },
  { label: "PKR Campaigns", value: "247", x: "90%", y: "80%", delay: 3 },
];

function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.4 }}
      className="relative"
    >
      {FLOATING_BADGES.map((badge) => (
        <motion.div
          key={badge.label}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity, repeatType: "reverse", delay: badge.delay }}
          className="absolute z-10 glass-card px-3 py-1.5 rounded-lg"
          style={{ left: badge.x, top: badge.y, boxShadow: "0 4px 20px -5px hsl(var(--aurora-violet) / 0.3)" }}
        >
          <span className="text-[9px] text-muted-foreground block">{badge.label}</span>
          <span className="data-mono text-xs font-bold text-primary">{badge.value}</span>
        </motion.div>
      ))}

      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 6, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        className="glass-card rounded-xl overflow-hidden shadow-2xl"
        style={{ boxShadow: "0 25px 60px -15px hsl(var(--aurora-violet) / 0.3)" }}
      >
        <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "hsl(var(--glass-border))" }}>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(45 93% 47% / 0.6)" }} />
            <div className="w-2.5 h-2.5 rounded-full bg-primary/60" />
          </div>
          <span className="text-[10px] text-muted-foreground ml-2 data-mono">InfluenceIQ · Pakistan Creator Search</span>
        </div>

        <div className="grid grid-cols-3 gap-2 p-3">
          {[
            { icon: MapPin, label: "Cities Covered", value: "12+" },
            { icon: ShieldCheck, label: "Avg Fraud Score", value: "94.2%" },
            { icon: TrendingUp, label: "Avg Engagement", value: "4.7%" },
          ].map((stat) => (
            <div key={stat.label} className="aurora-gradient rounded-lg p-2.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <stat.icon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[9px] text-muted-foreground truncate">{stat.label}</span>
              </div>
              <p className="data-mono text-sm font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="px-3 pb-3">
          <div className="rounded-lg overflow-hidden border" style={{ borderColor: "hsl(var(--glass-border))" }}>
            <div className="grid grid-cols-[1fr_70px_55px_50px_44px] gap-1 px-2.5 py-1.5 text-[9px] text-muted-foreground uppercase tracking-wider border-b" style={{ borderColor: "hsl(var(--glass-border))", background: "hsl(var(--glass-bg))" }}>
              <span>Creator</span><span>Platform</span><span>City</span><span>Eng.</span><span>Score</span>
            </div>
            {MOCK_ROWS.map((row) => (
              <div key={row.name} className="grid grid-cols-[1fr_70px_55px_50px_44px] gap-1 px-2.5 py-1.5 text-[10px] border-b last:border-b-0 items-center" style={{ borderColor: "hsl(var(--glass-border))" }}>
                <span className="text-foreground font-medium truncate">{row.name}</span>
                <span className="text-muted-foreground">{row.platform}</span>
                <span className="text-muted-foreground">{row.city}</span>
                <span className="data-mono text-primary">{row.engagement}</span>
                <span className="data-mono text-xs font-semibold text-primary">{row.score}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

const PROOF_METRICS = [
  { value: "10,000+", label: "Pakistani creators indexed" },
  { value: "94%", label: "fraud detection accuracy" },
  { value: "4.2×", label: "average campaign ROI" },
];

interface HeroProps {
  ctaPath: string;
  ctaLabel: string;
}

export function Hero({ ctaPath, ctaLabel }: HeroProps) {
  return (
    <section className="relative pt-40 pb-24 px-6 md:px-12 lg:px-24">
      <div className="absolute top-20 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.18] blur-[100px] pointer-events-none" style={{ background: "radial-gradient(circle, hsl(var(--aurora-violet)), transparent 70%)" }} />
      <div className="absolute top-40 right-[10%] w-[500px] h-[500px] rounded-full opacity-[0.1] blur-[120px] pointer-events-none" style={{ background: "radial-gradient(circle, hsl(var(--aurora-teal)), transparent 70%)" }} />

      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          {/* Pakistan badge */}
          <motion.div custom={0} variants={fadeUp}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-card text-xs font-medium text-muted-foreground border"
            style={{ borderColor: "hsl(var(--aurora-violet) / 0.3)" }}>
            <span>🇵🇰</span> Pakistan's #1 Influencer Marketing Platform
          </motion.div>

          <motion.h1 custom={1} variants={fadeUp}
            className="text-5xl md:text-7xl font-extrabold leading-[1.05] tracking-tight">
            Find Authentic Pakistani Influencers That Drive{" "}
            <span className="aurora-text">Real ROI</span>
          </motion.h1>

          <motion.p custom={2} variants={fadeUp}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl">
            Discover and collaborate with verified creators from{" "}
            <span className="text-foreground font-medium">Karachi, Lahore, Islamabad</span> and beyond — all in one platform.
          </motion.p>

          <motion.div custom={3} variants={fadeUp} className="space-y-3">
            <Link to={ctaPath}>
              <Button size="lg" className="btn-shine btn-glow text-base px-10 py-6">
                {ctaLabel} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground">
              No credit card required · Pay in PKR via JazzCash or EasyPaisa
            </p>
          </motion.div>

          <motion.div custom={4} variants={fadeUp}
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
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
