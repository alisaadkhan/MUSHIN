import { motion, type Variants } from "framer-motion";
import { ShieldCheck, Lock, Clock, FileCheck } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.1 } } };

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "GDPR Compliant",
    desc: "Full data processing agreements, right-to-erasure support, and EU data residency options.",
  },
  {
    icon: Lock,
    title: "AES-256 Encryption",
    desc: "All data encrypted at rest and in transit. API keys and credentials stored in isolated vaults.",
  },
  {
    icon: Clock,
    title: "99.9% Uptime SLA",
    desc: "Enterprise-grade infrastructure with automated failover and real-time status monitoring.",
  },
  {
    icon: FileCheck,
    title: "SOC 2 Type II",
    desc: "Independently audited security controls covering availability, confidentiality, and integrity.",
  },
];

export function TrustSecurity() {
  return (
    <section className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="max-w-5xl mx-auto text-center space-y-16"
      >
        <div className="space-y-4">
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-widest text-primary">
            Security & Compliance
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
            Enterprise-Grade <span className="aurora-text">Protection</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground max-w-2xl mx-auto">
            Your data security is non-negotiable. We meet the highest standards so your team can focus on results.
          </motion.p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {TRUST_ITEMS.map(({ icon: Icon, title, desc }) => (
            <motion.div
              key={title}
              variants={fadeUp}
              className="glass-card-hover p-6 rounded-xl text-center space-y-3 will-change-transform"
            >
              <div
                className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl aurora-gradient text-primary"
                style={{ boxShadow: "0 0 20px -5px hsl(var(--aurora-violet) / 0.3)" }}
              >
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
