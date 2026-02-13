import { useEffect, useRef } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useTransform,
  animate,
  type Variants,
} from "framer-motion";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.12 } } };

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => `${Math.round(v).toLocaleString()}${suffix}`);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (inView) animate(mv, target, { duration: 1.5, ease: "easeOut" });
  }, [inView, mv, target]);

  useEffect(() => {
    const unsub = rounded.on("change", (v) => {
      if (ref.current) ref.current.textContent = v;
    });
    return unsub;
  }, [rounded]);

  return <span ref={ref} className="data-mono text-4xl md:text-5xl font-extrabold text-foreground">0</span>;
}

const METRICS = [
  { target: 10000, suffix: "+", label: "Live influencer searches completed" },
  { target: 99, suffix: "%", label: "Fraud detection accuracy rate" },
  { target: 73, suffix: "%", label: "Average reduction in campaign cost" },
];

export function OutcomeMetrics() {
  return (
    <section className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        variants={stagger}
        className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8"
      >
        {METRICS.map((m) => (
          <motion.div key={m.label} variants={fadeUp}
            className="glass-card rounded-xl p-8 text-center space-y-3">
            <AnimatedCounter target={m.target} suffix={m.suffix} />
            <p className="text-sm text-muted-foreground">{m.label}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
