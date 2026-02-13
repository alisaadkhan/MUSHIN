import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";

function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (isInView) {
      animate(motionVal, value, { duration: 1.5, ease: "easeOut" });
    }
  }, [isInView, motionVal, value]);

  useEffect(() => {
    const unsubscribe = rounded.on("change", (v) => {
      if (ref.current) ref.current.textContent = v + suffix;
    });
    return unsubscribe;
  }, [rounded, suffix]);

  return (
    <span ref={ref} className="data-mono text-3xl font-bold text-foreground">
      0{suffix}
    </span>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

const BRANDS = ["Velocity", "Growth Co", "Stellar", "Nova", "Apex", "ScaleUp"];
const STATS = [
  { val: 10000, suffix: "+", label: "Live searches performed" },
  { val: 99, suffix: "%", label: "Fraud detection accuracy" },
  { val: 90, suffix: "%", label: "Lower cost vs. legacy tools" },
];

export function TrustSignals() {
  return (
    <section className="relative py-20 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="max-w-5xl mx-auto text-center space-y-12"
      >
        <motion.p variants={fadeUp} className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by agencies &amp; brands worldwide
        </motion.p>
        <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-x-14 gap-y-4 opacity-40">
          {BRANDS.map((name) => (
            <span key={name} className="text-lg font-semibold tracking-wide select-none">
              {name}
            </span>
          ))}
        </motion.div>
        <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {STATS.map((s) => (
            <div key={s.label} className="glass-card p-8 rounded-xl text-center">
              <AnimatedCounter value={s.val} suffix={s.suffix} />
              <p className="text-sm text-muted-foreground mt-2">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
