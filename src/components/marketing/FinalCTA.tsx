import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

interface Props {
  ctaPath: string;
}

export function FinalCTA({ ctaPath }: Props) {
  return (
    <section className="relative py-24 px-6 md:px-12 lg:px-24">
      {/* Radial spotlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-[0.12] blur-[100px] pointer-events-none" style={{ background: "radial-gradient(circle, hsl(var(--aurora-violet)), transparent 70%)" }} />
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
        className="max-w-3xl mx-auto text-center space-y-6 aurora-gradient rounded-3xl p-12 md:p-16 border"
        style={{ borderColor: "hsl(var(--aurora-violet) / 0.3)", boxShadow: "0 0 60px -15px hsl(var(--aurora-violet) / 0.25)" }}
      >
        <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
          Join 2,000+ Teams Finding{" "}
          <span className="aurora-text">Real Creators</span>
        </motion.h2>
        <motion.p variants={fadeUp} className="text-muted-foreground">
          Start free. No credit card required. See results in under 60 seconds.
        </motion.p>
        <motion.div variants={fadeUp}>
          <Link to={ctaPath}>
            <Button size="lg" className="btn-shine btn-glow text-base px-10 py-6">
              Start Your Free Trial <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
