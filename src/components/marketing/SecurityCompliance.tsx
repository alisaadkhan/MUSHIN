import { motion, type Variants } from "framer-motion";
import { Lock, CreditCard, ShieldCheck, Eye } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.1 } } };

const items = [
  { icon: Lock, title: "GDPR Ready", desc: "Data export and account deletion built in." },
  { icon: CreditCard, title: "Secure Payments", desc: "Powered by Stripe with PCI compliance." },
  { icon: ShieldCheck, title: "SOC2‑Ready", desc: "Audit logging and access controls." },
  { icon: Eye, title: "Transparent Usage", desc: "Real‑time credit tracking and audit logs." },
];

export function SecurityCompliance() {
  return (
    <section className="relative py-16 px-6 md:px-12 lg:px-24">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {items.map((s) => (
            <motion.div key={s.title} variants={fadeUp} className="glass-card p-6 rounded-xl space-y-3">
              <s.icon className="h-6 w-6 text-accent mx-auto" />
              <h3 className="font-semibold text-sm">{s.title}</h3>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
