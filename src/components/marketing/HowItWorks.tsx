import { motion, type Variants } from "framer-motion";
import { Search, ShieldCheck, Mail } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.12 } } };

const STEPS = [
  { icon: Search, num: "01", title: "Discover Verified Creators", desc: "Enter a niche and location. Get real influencer profiles from the live web — not a stale database." },
  { icon: ShieldCheck, num: "02", title: "Analyze Trust Signals", desc: "AI fraud scores, engagement metrics, and verified emails surface in one click. Know who's real before you reach out." },
  { icon: Mail, num: "03", title: "Close the Deal", desc: "Save to lists, manage partnerships on a visual Kanban, and send personalized outreach — all from one workspace." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        variants={stagger}
        className="max-w-5xl mx-auto text-center space-y-16"
      >
        <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
          From Search to Signed Deal in <span className="aurora-text">3 Steps</span>
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting lines (desktop only) */}
          <div className="hidden md:block absolute top-1/2 left-[calc(33.33%+1rem)] right-[calc(33.33%+1rem)] h-px bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 -translate-y-1/2" />

          {STEPS.map((step) => (
            <motion.div key={step.num} variants={fadeUp}
              className="glass-card-hover p-8 rounded-xl space-y-4 text-center will-change-transform relative z-10">
              <p className="data-mono text-3xl font-extrabold text-primary/30">{step.num}</p>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl aurora-gradient">
                <step.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
