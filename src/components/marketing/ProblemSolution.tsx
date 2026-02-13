import { motion, type Variants } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.1 } } };

const problems = [
  "Stale influencer databases updated monthly",
  "Fake followers slip through without detection",
  "Locked annual contracts with hidden fees",
];
const solutions = [
  "Live Google‑powered discovery — always fresh",
  "Real‑time fraud scoring with AI analysis",
  "Pay‑as‑you‑go credits — cancel anytime",
];

export function ProblemSolution() {
  return (
    <section className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-6xl mx-auto">
        <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-center mb-16 tracking-tight">
          The Old Way vs. <span className="aurora-text">The InfluenceIQ Way</span>
        </motion.h2>
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div variants={stagger} className="space-y-4">
            {problems.map((p) => (
              <motion.div key={p} variants={fadeUp} className="glass-card p-5 rounded-xl flex items-start gap-3" style={{ borderColor: "hsl(var(--destructive) / 0.2)" }}>
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-muted-foreground">{p}</p>
              </motion.div>
            ))}
          </motion.div>
          <motion.div variants={stagger} className="space-y-4">
            {solutions.map((s) => (
              <motion.div key={s} variants={fadeUp} className="glass-card p-5 rounded-xl flex items-start gap-3" style={{ borderColor: "hsl(var(--aurora-teal) / 0.3)" }}>
                <CheckCircle2 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <p className="text-foreground">{s}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
