import { motion, type Variants } from "framer-motion";
import { Search, ShieldCheck, Mail } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.12 } } };

const STEPS = [
  { icon: Search, title: "Search Live", desc: "Enter a niche, platform, and location. Get real influencer profiles from the web instantly." },
  { icon: ShieldCheck, title: "Analyze Trust", desc: "AI‑powered fraud scores, engagement metrics, and email extraction — all in one click." },
  { icon: Mail, title: "Shortlist & Contact", desc: "Save to lists, manage campaigns on a Kanban board, and send outreach emails directly." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="max-w-5xl mx-auto text-center space-y-16"
      >
        <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
          How It Works
        </motion.h2>
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              variants={fadeUp}
              className="glass-card-hover p-8 rounded-xl space-y-4 text-center will-change-transform"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl aurora-gradient">
                <step.icon className="h-7 w-7 text-primary" />
              </div>
              <p className="data-mono text-xs text-muted-foreground">Step {i + 1}</p>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
