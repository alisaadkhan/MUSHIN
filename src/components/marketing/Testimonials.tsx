import { motion, type Variants } from "framer-motion";
import { Star } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.12 } } };

const TESTIMONIALS = [
  {
    quote: "InfluenceIQ cut our influencer vetting time by 80%. The fraud detection alone saved us from a $50K mistake.",
    name: "Sarah Chen",
    title: "VP Marketing",
    company: "Elevate Agency",
  },
  {
    quote: "We switched from CreatorIQ and haven't looked back. The live search is a game-changer for fast-moving campaigns.",
    name: "Marcus Johnson",
    title: "Head of Partnerships",
    company: "Velocity Growth",
  },
  {
    quote: "Finally, a tool that doesn't lock you into an annual contract. The pay-as-you-go model is exactly what growing agencies need.",
    name: "Elena Rodriguez",
    title: "Founder",
    company: "Bright Spark Media",
  },
];

function Stars() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        variants={stagger}
        className="max-w-5xl mx-auto space-y-16"
      >
        <motion.h2 variants={fadeUp}
          className="text-3xl md:text-4xl font-bold tracking-tight text-center">
          What Marketing Leaders Say
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <motion.div key={t.name} variants={fadeUp}
              className="glass-card rounded-xl p-8 space-y-5">
              <Stars />
              <p className="text-base italic text-foreground leading-relaxed">"{t.quote}"</p>
              <div>
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.title}, {t.company}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
