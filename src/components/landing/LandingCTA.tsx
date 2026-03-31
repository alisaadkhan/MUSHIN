import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SectionSpotlight, RevealLine, RevealText } from '@/components/landing/LandingShared';

export const LandingCTA = () => {
  return (
    <SectionSpotlight aria-label="Call to action" className="py-32 px-6 border-t border-white/[0.06] z-20">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(88,28,135,0.18) 0%, transparent 70%)' }} />
      <div className="max-w-3xl mx-auto text-center relative z-10">
        <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="text-purple-400 text-xs font-medium uppercase tracking-widest mb-4">Get Started</motion.div>
        <RevealLine />
        <h2 className="font-black tracking-tighter leading-[.88] mb-8" style={{ fontSize: 'clamp(3rem,8vw,6rem)' }}>
          <RevealText text="Your Next Campaign" /><br />
          <RevealText text="Starts Here." delay={0.2} />
        </h2>
        <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto">Join Pakistani marketing teams already using Mushin to find, verify, and close creators — faster.</p>
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: .97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }} className="conic-wrap inline-block">
          <Link to="/auth" className="conic-inner flex items-center gap-3 px-12 py-4 text-white font-bold text-sm tracking-[0.18em] uppercase">
            Begin Your Search
            <span className="w-px h-4 bg-white/20" />
            <ArrowRight className="w-4 h-4 opacity-50" />
          </Link>
        </motion.div>
        <p className="text-zinc-600 text-xs mt-6">Free forever plan available. No credit card required.</p>
      </div>
    </SectionSpotlight>
  );
};
