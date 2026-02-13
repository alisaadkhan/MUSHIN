import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.12 } } };

interface FinalCTAProps {
  ctaPath: string;
}

export function FinalCTA({ ctaPath }: FinalCTAProps) {
  return (
    <section className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="max-w-3xl mx-auto text-center space-y-8 aurora-gradient rounded-3xl p-12 md:p-16"
      >
        <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
          Stop Guessing. Start Partnering with <span className="aurora-text">Real Creators</span>.
        </motion.h2>
        <motion.div variants={fadeUp}>
          <Link to={ctaPath}>
            <Button size="lg" className="btn-shine text-base px-10 py-6">
              Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
