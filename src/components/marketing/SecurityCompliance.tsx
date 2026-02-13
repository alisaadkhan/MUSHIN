import { motion, type Variants } from "framer-motion";
import { Lock, CreditCard, Shield, Eye } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.1 } } };

const ITEMS = [
  { icon: Lock, title: "GDPR Ready", desc: "Data export and account deletion built in." },
  { icon: CreditCard, title: "Secure Payments", desc: "Powered by Stripe with PCI compliance." },
  { icon: Shield, title: "SOC2 Ready", desc: "Enterprise‑grade security and audit trails." },
  { icon: Eye, title: "Transparent Usage", desc: "Real‑time credit tracking and audit logs." },
];

export function SecurityCompliance() {
  return (
    <section className="relative py-16 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="max-w-5xl mx-auto"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {ITEMS.map(({ icon: Icon, title, desc }) => (
            <motion.div key={title} variants={fadeUp} className="glass-card p-6 rounded-xl space-y-3">
              <Icon className="h-6 w-6 text-accent mx-auto" />
              <h3 className="font-semibold text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
