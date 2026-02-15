import { motion, type Variants } from "framer-motion";
import { Search, MapPin, Hash, ShieldCheck, Users, TrendingUp } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.1 } } };

const FILTERS = ["Instagram", "TikTok", "YouTube"];
const NICHES = ["Fitness", "Beauty", "Tech"];

const RESULTS = [
  { name: "Emma Liu", platform: "Instagram", followers: "1.8M", engagement: "5.2%", fraud: 96, niche: "Beauty" },
  { name: "Marco Santos", platform: "TikTok", followers: "3.2M", engagement: "7.1%", fraud: 98, niche: "Fitness" },
  { name: "Aisha Patel", platform: "YouTube", followers: "950K", engagement: "4.8%", fraud: 93, niche: "Tech" },
  { name: "Tyler Brooks", platform: "Instagram", followers: "620K", engagement: "6.3%", fraud: 91, niche: "Fitness" },
  { name: "Yuki Tanaka", platform: "TikTok", followers: "1.4M", engagement: "8.2%", fraud: 97, niche: "Beauty" },
  { name: "Nina Okafor", platform: "YouTube", followers: "2.7M", engagement: "3.6%", fraud: 89, niche: "Tech" },
];

const WORKFLOW = [
  { icon: Search, label: "Search", desc: "Find creators by niche, location, and platform" },
  { icon: ShieldCheck, label: "Analyze", desc: "AI scores every profile for authenticity" },
  { icon: Users, label: "Outreach", desc: "Send personalized emails from one workspace" },
];

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 95 ? "text-primary" : score >= 90 ? "text-primary/70" : "text-muted-foreground";
  return <span className={`data-mono text-xs font-bold ${color}`}>{score}</span>;
}

export function ProductDemo() {
  return (
    <section id="product-demo" className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        variants={stagger}
        className="max-w-6xl mx-auto space-y-16"
      >
        <motion.div variants={fadeUp} className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            See How It Works <span className="aurora-text">in Practice</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            From search to signed deal — everything happens in one intelligent workspace.
          </p>
        </motion.div>

        {/* Dashboard mockup */}
        <motion.div
          variants={fadeUp}
          className="glass-card rounded-2xl overflow-hidden"
          style={{ boxShadow: "0 30px 80px -20px hsl(var(--aurora-violet) / 0.2)" }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "hsl(var(--glass-border))" }}>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive/60" />
              <div className="w-3 h-3 rounded-full" style={{ background: "hsl(45 93% 47% / 0.6)" }} />
              <div className="w-3 h-3 rounded-full bg-primary/60" />
            </div>
            <span className="text-xs text-muted-foreground ml-3 data-mono">InfluenceIQ — Creator Discovery</span>
          </div>

          <div className="grid md:grid-cols-[240px_1fr] divide-x" style={{ borderColor: "hsl(var(--glass-border))" }}>
            {/* Left: Search + Filters */}
            <div className="p-5 space-y-5 hidden md:block">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-muted-foreground" style={{ borderColor: "hsl(var(--glass-border))" }}>
                <Search className="h-3.5 w-3.5" />
                <span>Search creators...</span>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Platform</p>
                <div className="flex flex-wrap gap-1.5">
                  {FILTERS.map((f, i) => (
                    <span key={f} className={`text-[10px] px-2.5 py-1 rounded-full border ${i === 0 ? "bg-primary/20 border-primary/30 text-primary" : "text-muted-foreground"}`} style={i !== 0 ? { borderColor: "hsl(var(--glass-border))" } : undefined}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</p>
                <div className="px-3 py-1.5 rounded-lg border text-[10px] text-muted-foreground" style={{ borderColor: "hsl(var(--glass-border))" }}>
                  United States
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1"><Hash className="h-3 w-3" /> Niche</p>
                <div className="flex flex-wrap gap-1.5">
                  {NICHES.map((n) => (
                    <span key={n} className="text-[10px] px-2.5 py-1 rounded-full border text-muted-foreground" style={{ borderColor: "hsl(var(--glass-border))" }}>
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Results grid */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-xs text-muted-foreground"><span className="data-mono font-semibold text-foreground">247</span> creators found</p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <TrendingUp className="h-3 w-3" /> Sort: Engagement
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {RESULTS.map((r) => (
                  <div key={r.name} className="aurora-gradient rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {r.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground">{r.platform} · {r.niche}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="data-mono text-muted-foreground">{r.followers}</span>
                      <span className="data-mono text-primary">{r.engagement} eng.</span>
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3 text-primary" />
                        <ScoreBadge score={r.fraud} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Workflow steps */}
        <div className="grid md:grid-cols-3 gap-6">
          {WORKFLOW.map((step, i) => (
            <motion.div key={step.label} variants={fadeUp}
              className="flex items-start gap-4 p-5 glass-card rounded-xl">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl aurora-gradient">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  <span className="data-mono text-primary mr-2">0{i + 1}</span>{step.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
