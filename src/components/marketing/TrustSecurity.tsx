import { motion, type Variants } from "framer-motion";
import { Building2 } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.08 } } };

// Pakistani brand logos as styled text pills
const BRANDS = [
  "Shan Foods",
  "Khaadi",
  "Sana Safinaz",
  "Daraz.pk",
  "Foodpanda PK",
  "QMobile",
  "Engro Foods",
  "EasyPaisa",
];

export function TrustSecurity() {
  return (
    <section className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        variants={stagger}
        className="max-w-5xl mx-auto space-y-12"
      >
        <div className="text-center space-y-4">
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-widest text-primary">
            Trusted By
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
            Trusted by{" "}
            <span className="aurora-text">Leading Pakistani Brands</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground max-w-xl mx-auto">
            From FMCG giants to fast-growing D2C brands — the teams behind Pakistan's most recognized names run their influencer programs on MUSHIN.
          </motion.p>
        </div>

        {/* Brand pills */}
        <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-4">
          {BRANDS.map((brand) => (
            <div
              key={brand}
              className="glass-card px-5 py-2.5 rounded-full text-sm font-medium text-muted-foreground flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity"
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {brand}
            </div>
          ))}
        </motion.div>

        {/* Security badges */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
          {[
            { label: "SOC 2 Type II", sub: "Data Security" },
            { label: "GDPR Compliant", sub: "Privacy Standard" },
            { label: "256-bit SSL", sub: "Encrypted Transit" },
            { label: "PK Data Residency", sub: "Local Data Storage" },
          ].map((b) => (
            <div key={b.label} className="glass-card rounded-xl p-4 text-center space-y-1">
              <p className="text-xs font-semibold text-foreground">{b.label}</p>
              <p className="text-[10px] text-muted-foreground">{b.sub}</p>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
