import { motion, type Variants } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.1 } } };

const WITHOUT = [
  "Wasting budget on Pakistani influences with fake, bot-inflated followers",
  "Manually browsing hundreds of profiles on Instagram and TikTok for hours",
  "No way to compare creator ROI in Pakistani Rupees across campaigns",
];

const WITH = [
  "AI fraud scoring catches bots targeting Pakistani audiences before you spend a single rupee",
  "Live discovery across Instagram, TikTok, and YouTube — filtered by Karachi, Lahore, Islamabad, and more",
  "Campaign ROI tracking and attribution in PKR with one-click reporting",
];

export function ProblemSolution() {
  return (
    <section className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        variants={stagger}
        className="max-w-6xl mx-auto"
      >
        <motion.h2 variants={fadeUp}
          className="text-3xl md:text-4xl font-bold text-center mb-16 tracking-tight">
          Why Pakistani Brands Switch to <span className="aurora-text">MUSHIN</span>
        </motion.h2>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div variants={fadeUp} className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">Without MUSHIN</p>
            {WITHOUT.map((t) => (
              <div key={t} className="glass-card p-5 rounded-xl flex items-start gap-3"
                style={{ borderColor: "hsl(var(--destructive) / 0.2)" }}>
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-muted-foreground">{t}</p>
              </div>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">With MUSHIN Pakistan</p>
            {WITH.map((t) => (
              <div key={t} className="glass-card p-5 rounded-xl flex items-start gap-3"
                style={{ borderColor: "hsl(var(--aurora-violet) / 0.3)" }}>
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-foreground">{t}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
