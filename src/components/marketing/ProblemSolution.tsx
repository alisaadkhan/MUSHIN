import { motion, type Variants } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.1 } } };

const PROBLEMS = [
  "Stale influencer databases updated monthly",
  "Fake followers slip through without detection",
  "Locked annual contracts with hidden fees",
];
const SOLUTIONS = [
  "Live Google‑powered discovery — always fresh",
  "Real‑time fraud scoring with AI analysis",
  "Pay‑as‑you‑go credits — cancel anytime",
];

export function ProblemSolution() {
  return (
    <section className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="max-w-6xl mx-auto"
      >
        <motion.h2
          variants={fadeUp}
          className="text-3xl md:text-4xl font-bold text-center mb-16 tracking-tight"
        >
          The Old Way vs. <span className="aurora-text">The InfluenceIQ Way</span>
        </motion.h2>
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div variants={fadeUp} className="space-y-4">
            {PROBLEMS.map((p) => (
              <div
                key={p}
                className="glass-card p-5 rounded-xl flex items-start gap-3"
                style={{ borderColor: "hsl(var(--destructive) / 0.2)" }}
              >
                <span className="text-destructive mt-0.5 shrink-0">✕</span>
                <p className="text-muted-foreground">{p}</p>
              </div>
            ))}
          </motion.div>
          <motion.div variants={fadeUp} className="space-y-4">
            {SOLUTIONS.map((s) => (
              <div
                key={s}
                className="glass-card p-5 rounded-xl flex items-start gap-3"
                style={{ borderColor: "hsl(var(--aurora-teal) / 0.3)" }}
              >
                <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <p className="text-foreground">{s}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
