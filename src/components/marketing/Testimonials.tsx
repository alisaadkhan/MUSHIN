import { motion, type Variants } from "framer-motion";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.12 } } };

const TESTIMONIALS = [
  {
    quote: "InfluenceIQ cut our influencer vetting time by 80%. The fraud detection alone saved us from three bad partnerships in the first month.",
    name: "Sarah Jennings",
    role: "Head of Partnerships",
    company: "Elevate Agency",
  },
  {
    quote: "We replaced two expensive legacy tools with InfluenceIQ and actually got better results. The live search is a game-changer.",
    name: "Marcus Chen",
    role: "Marketing Director",
    company: "NovaBrand Co.",
  },
  {
    quote: "The Kanban pipeline and email outreach in one platform means my team spends less time context-switching and more time closing deals.",
    name: "Priya Kapoor",
    role: "Campaign Lead",
    company: "Sphere Digital",
  },
];

export function Testimonials() {
  return (
    <section className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="max-w-5xl mx-auto space-y-16"
      >
        <div className="text-center space-y-4">
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-widest text-primary">
            Testimonials
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
            What Teams Are <span className="aurora-text">Saying</span>
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ quote, name, role, company }) => (
            <motion.div
              key={name}
              variants={fadeUp}
              className="glass-card p-6 rounded-xl space-y-4 border-l-2"
              style={{ borderLeftColor: "hsl(var(--aurora-violet) / 0.5)" }}
            >
              <p className="text-sm text-muted-foreground italic leading-relaxed">"{quote}"</p>
              <div>
                <p className="text-sm font-semibold text-foreground">{name}</p>
                <p className="text-xs text-muted-foreground">{role}, {company}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
