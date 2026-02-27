import { motion, type Variants } from "framer-motion";
import { Quote } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.12 } } };

const TESTIMONIALS = [
  {
    quote: "InfluenceIQ helped us find the perfect Karachi-based food bloggers for our Ramadan campaign. The local city-level insights are unmatched — no other tool does this for Pakistan.",
    name: "Fahad Khan",
    role: "Brand Manager",
    company: "Clearfield Brands PK",
    city: "Karachi",
    initials: "FK",
  },
  {
    quote: "We ran three campaigns through InfluenceIQ and the fraud detection literally saved us from paying an influencer with 80% fake followers. Paid for itself in the first week.",
    name: "Sana Mirza",
    role: "Marketing Director",
    company: "Khaadi Digital",
    city: "Lahore",
    initials: "SM",
  },
  {
    quote: "As an agency handling 15+ brands in Pakistan, the ability to manage campaigns in PKR and reach out via WhatsApp directly from the platform has completely changed our workflow.",
    name: "Ali Raza",
    role: "CEO",
    company: "Nova Influence Agency",
    city: "Islamabad",
    initials: "AR",
  },
];

export function Testimonials() {
  return (
    <section className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        variants={stagger}
        className="max-w-5xl mx-auto space-y-16"
      >
        <div className="text-center space-y-4">
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-widest text-primary">
            Pakistani Brand Stories
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
            What Pakistani Marketers Are <span className="aurora-text">Saying</span>
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(({ quote, name, role, company, city, initials }) => (
            <motion.div
              key={name}
              variants={fadeUp}
              className="glass-card p-6 rounded-xl space-y-4 border-l-2 flex flex-col"
              style={{ borderLeftColor: "hsl(var(--aurora-violet) / 0.5)" }}
            >
              <Quote className="h-5 w-5 text-primary/40" />
              <p className="text-sm text-muted-foreground italic leading-relaxed flex-1">"{quote}"</p>
              <div className="flex items-center gap-3 pt-2 border-t" style={{ borderColor: "hsl(var(--glass-border))" }}>
                <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">{role}, {company} · {city}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
