import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

const brands = ["Velocity", "Growth Co", "Stellar", "Nova", "Apex", "ScaleUp"];

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.floor(v).toLocaleString());

  useEffect(() => {
    if (isInView) {
      animate(count, value, { duration: 1.5, ease: "easeOut" });
    }
  }, [isInView, value, count]);

  return (
    <span ref={ref} className="data-mono text-3xl font-bold text-foreground">
      <motion.span>{rounded}</motion.span>{suffix}
    </span>
  );
}

export function TrustSignals() {
  return (
    <section className="relative py-20 px-6 md:px-12 lg:px-24">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-5xl mx-auto text-center space-y-12">
        <motion.p variants={fadeUp} className="text-sm uppercase tracking-widest text-muted-foreground">
          Trusted by agencies & brands worldwide
        </motion.p>

        <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-10 opacity-40">
          {brands.map((name) => (
            <span key={name} className="text-lg font-semibold tracking-wide">{name}</span>
          ))}
        </motion.div>

        <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
          {[
            { val: 10000, suffix: "+", label: "Live searches performed" },
            { val: 99, suffix: "%", label: "Fraud detection accuracy" },
            { val: 90, suffix: "%", label: "Lower cost vs. legacy tools" },
          ].map((s) => (
            <div key={s.label} className="glass-card p-6 rounded-xl text-center">
              <AnimatedCounter value={s.val} suffix={s.suffix} />
              <p className="text-sm text-muted-foreground mt-2">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
