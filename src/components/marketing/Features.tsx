import { motion, type Variants } from "framer-motion";
import { Search, Shield, Smartphone, BarChart3, MessageSquare, DollarSign } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.08 } } };

const CAPABILITIES = [
  {
    Icon: Search,
    title: "AI-Powered City & Niche Search",
    desc: "Find creators by city (Karachi, Lahore, Islamabad, Faisalabad, Peshawar), niche (food, fashion, cricket, drama, Islamic), and language (Urdu/English) — all in real time.",
  },
  {
    Icon: Shield,
    title: "Pakistani Audience Authenticity",
    desc: "Our AI detects bot followers and fake engagement specifically calibrated for Pakistani social media patterns. Score every creator before committing.",
  },
  {
    Icon: Smartphone,
    title: "WhatsApp & Email Outreach",
    desc: "Reach creators the way Pakistanis prefer — via WhatsApp. Send templated messages, track opens, and manage conversations in one inbox.",
  },
  {
    Icon: BarChart3,
    title: "Deep Audience Demographics",
    desc: "Break down any creator's audience by age, gender, and Pakistani city — Karachi, Lahore, Islamabad, Rawalpindi, and 12+ more cities.",
  },
  {
    Icon: DollarSign,
    title: "PKR Campaign Budget Tracking",
    desc: "Plan, track, and report campaign spend entirely in Pakistani Rupees. Native PKR support across all budget fields, invoices, and reports.",
  },
  {
    Icon: MessageSquare,
    title: "ROI Attribution in Rupees",
    desc: "Connect your storefront or revenue data and measure real return in PKR. Generate board-ready reports your CFO and leadership will trust.",
  },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        variants={stagger}
        className="max-w-6xl mx-auto text-center space-y-16"
      >
        <div className="space-y-4">
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-widest text-primary">
            Platform Capabilities
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
            Everything You Need to Win{" "}
            <span className="aurora-text">in Pakistan's Creator Economy</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground max-w-2xl mx-auto">
            Built specifically for brand teams and agencies operating in the Pakistani market — not a generic global tool with a flag added on.
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CAPABILITIES.map(({ Icon, title, desc }) => (
            <motion.div key={title} variants={fadeUp}
              className="glass-card-hover p-6 rounded-xl text-left space-y-3 will-change-transform">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg aurora-gradient text-primary"
                style={{ boxShadow: "0 0 20px -5px hsl(var(--aurora-violet) / 0.3)" }}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
