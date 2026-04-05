import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const WORDS = ["AUTHENTIC", "VERIFIED", "TOP-TIER", "INFLUENTIAL"];

export const LandingHero = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % WORDS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative h-[100vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#060608]">
        {/* Subtle Grid Background */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none" 
          style={{ 
            backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90(deg), #fff 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse 60% 50% at 50% 40%, #000 30%, transparent 100%)'
          }} 
        />

        {/* Premium Radial Gradients */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(45,10,94,0.4) 0%, rgba(10,1,20,0.2) 50%, transparent 100%)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 40%, rgba(168,85,247,0.1) 0%, transparent 70%)' }} />

        {/* Watermark/Background Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.04 }}
            transition={{ duration: 2 }}
            className="font-black text-center leading-none select-none text-white tracking-[-0.04em]" 
            style={{ fontSize: 'clamp(4rem,20vw,14rem)' }}
          >
            MUSHIN
          </motion.div>
        </div>

        {/* Content Container */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-6 pt-16">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} 
            className="flex flex-col items-center max-w-5xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-xs font-bold tracking-widest uppercase mb-8">
              <Sparkles className="w-3 h-3" /> Pakistan's First AI Search
            </div>

            <h1 className="font-black tracking-tighter leading-[0.95] mb-8 text-white drop-shadow-2xl flex flex-col items-center" 
                style={{ fontSize: 'clamp(3rem,9vw,7rem)' }}>
              <span className="opacity-90">FIND</span>
              <div className="relative h-[1.1em] w-full flex items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={WORDS[index]}
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -50, opacity: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute text-transparent bg-clip-text bg-gradient-to-b from-white to-purple-400"
                  >
                    {WORDS[index]}
                  </motion.span>
                </AnimatePresence>
              </div>
              <span className="opacity-90">PAKISTANI<br />INFLUENCERS.</span>
            </h1>

            <p className="text-lg md:text-xl max-w-xl font-normal mb-12 leading-relaxed text-zinc-400">
              Discover and collaborate with verified creators from Karachi, Lahore, Islamabad and beyond. No guesswork, just data.
            </p>

            {/* Repositioned & Cleaned CTA */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                <Button asChild size="lg" className="relative group overflow-hidden h-16 px-12 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-base tracking-widest shadow-[0_0_40px_rgba(168,85,247,0.3)] transition-all">
                  <Link to="/auth" className="flex items-center gap-3">
                    BEGIN YOUR SEARCH 
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </motion.div>
              
              <button 
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-zinc-500 hover:text-white font-bold text-sm tracking-widest uppercase transition-colors"
              >
                See how it works
              </button>
            </div>

            <div className="mt-10 flex items-center gap-6 opacity-40">
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase">No Credit Card Needed</span>
              <div className="w-1 h-1 rounded-full bg-zinc-500" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Free Plan Forever</span>
            </div>
          </motion.div>
        </div>

        {/* Bottom smooth fade to black - deeper for box transition */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#060608] via-[#060608]/80 to-transparent pointer-events-none" />
      </div>
    </div>
  );
};
