import { motion, type Variants } from "framer-motion";
import { Globe, CreditCard, ShieldCheck, LayoutDashboard } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.1 } } };

const DIFFS = [
  {
    icon: Globe,
    title: "Live Data, Not Stale Databases",
    desc: "Real-time discovery powered by live web indexing. No more working with profiles updated months ago.",
    metric: "< 24h",
    metricLabel: "data freshness",
  },
  {
    icon: CreditCard,
    title: "Pay Per Search, Not Per Year",
    desc: "Credit-based pricing that scales with your usage. No $30K+ annual contracts or seat-based lock-in.",
    metric: "10×",
    metricLabel: "lower entry cost",
  },
  {
    icon: ShieldCheck,
    title: "AI Fraud Detection Built In",
    desc: "Every profile is automatically scored for authenticity. Catch fake followers, engagement pods, and bot activity before you spend.",
    metric: "99%",
    metricLabel: "fraud accuracy",
  },
  {
    icon: LayoutDashboard,
    title: "One Workspace, Not Five Tools",
    desc: "Search, outreach, pipeline management, and analytics in a single platform. Stop stitching together disconnected tools.",
    metric: "80%",
    metricLabel: "time saved",
  },
];

export function Differentiation() {
  return (
    <section className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        variants={stagger}
        className="max-w-6xl mx-auto space-y-16"
      >
        <motion.div variants={fadeUp} className="text-center space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Why Teams Choose MUSHIN Over{" "}
            <span className="aurora-text">Legacy Platforms</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Purpose-built for modern marketing teams who need speed, accuracy, and flexibility.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {DIFFS.map((d) => (
            <motion.div
              key={d.title}
              variants={fadeUp}
              className="glass-card-hover p-8 rounded-xl space-y-4 will-change-transform"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl aurora-gradient">
                  <d.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="text-right">
                  <p className="data-mono text-2xl font-bold text-foreground">{d.metric}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{d.metricLabel}</p>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground">{d.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{d.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
