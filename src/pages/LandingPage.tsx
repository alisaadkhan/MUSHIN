import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent, MotionConfig, AnimatePresence } from 'framer-motion';
import { Sparkles, DollarSign, Info } from 'lucide-react';
import { MushInLogo } from '@/components/ui/MushInLogo';

// Modular Components
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingTestimonials } from '@/components/landing/LandingTestimonials';
import { LandingAbout } from '@/components/landing/LandingAbout';
import { LandingPricing } from '@/components/landing/LandingPricing';
import { LandingFAQ } from '@/components/landing/LandingFAQ';
import { LandingCTA } from '@/components/landing/LandingCTA';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { StarField, GrainOverlay, BgBlobs, ScrollGlow, MouseGlow } from '@/components/landing/LandingBackground';

/* --- Global Styles ------------------------------------------------------------ */
const G = () => <style>{`
@keyframes marquee-x{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes marquee-x-rev{0%{transform:translateX(-50%)}100%{transform:translateX(0)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes aring-cw{from{transform:rotate(0deg) translateZ(0)}to{transform:rotate(360deg) translateZ(0)}}
@keyframes aring-ccw{from{transform:rotate(0deg) translateZ(0)}to{transform:rotate(-360deg) translateZ(0)}}
@keyframes icon-ucw{from{transform:translateZ(0) rotate(0deg)}to{transform:translateZ(0) rotate(-360deg)}}
@keyframes icon-uccw{from{transform:translateZ(0) rotate(0deg)}to{transform:translateZ(0) rotate(360deg)}}
@keyframes hub-pulse{0%,100%{transform:scale(1);opacity:0.85}50%{transform:scale(1.08);opacity:1}}
@media(max-width:640px){.ao-r1{animation-duration:22s!important}.ao-r2{animation-duration:34s!important}}
@keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
@keyframes aurora{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@keyframes border-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}
.conic-wrap{position:relative;border-radius:9999px;padding:1.5px;overflow:hidden}
.conic-wrap::before{content:'';position:absolute;top:50%;left:50%;width:300%;height:300%;transform:translate(-50%,-50%);background:conic-gradient(from 0deg,#a855f7,#ec4899,#f97316,#eab308,#22c55e,#3b82f6,#a855f7);animation:border-spin 3s linear infinite}
.conic-inner{position:relative;z-index:1;background:#000;border-radius:9999px}
@keyframes pulse-ring{0%{transform:scale(.9);opacity:.8}70%{transform:scale(1.5);opacity:0}100%{transform:scale(.9);opacity:0}}
.reveal-word{display:inline-block;overflow:hidden;vertical-align:bottom;margin-right:0.24em}
@keyframes beam-travel{0%{stroke-dashoffset:400}100%{stroke-dashoffset:-400}}
.shiny-text{background:linear-gradient(120deg,#fff 20%,#a855f7 40%,#c084fc 50%,#a855f7 60%,#fff 80%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 3s linear infinite}
.aurora-text{background:linear-gradient(270deg,#a855f7,#c084fc,#7c3aed,#d946ef,#a855f7);background-size:400% 400%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:aurora 5s ease infinite}
@keyframes star-twinkle{0%,100%{opacity:0.1;transform:scale(1)}50%{opacity:1;transform:scale(1.6)}}
`}</style>;

export default function LandingPage() {
  const vwRef = useRef<HTMLDivElement>(null);
  const [activeNav, setActiveNav] = useState<string | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [heroComplete, setHeroComplete] = useState(true);

  const { scrollYProgress } = useScroll({ target: vwRef, offset: ['start start', 'end end'] });

  // Gate sections visibility based on scroll depth
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (v >= 0.98) setHeroComplete(true);
  });

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { id: 'features', icon: <Sparkles  className="w-4 h-4" />, label: 'Features' },
    { id: 'pricing',  icon: <DollarSign className="w-4 h-4" />, label: 'Pricing'  },
    { id: 'about',    icon: <Info       className="w-4 h-4" />, label: 'About'    },
  ];

  const bOp = useTransform(scrollYProgress, [0.7, 1], [0, 1]);

  return (
    <MotionConfig transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
      <div ref={vwRef} className="relative bg-[#060608] text-white selection:bg-purple-500/30 overflow-x-hidden">
        <G />

        <nav className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 ${navScrolled ? 'w-[min(90%,480px)]' : 'w-[min(90%,540px)]'}`}>
          <div className={`relative flex items-center justify-between px-6 h-14 rounded-full border transition-all duration-500 ${navScrolled ? 'bg-black/60 backdrop-blur-xl border-white/10 shadow-2xl' : 'bg-transparent border-transparent'}`}>
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <MushInLogo size={32} className="group-hover:rotate-[15deg] transition-transform duration-500" />
            </div>

            <div className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => (
                <button key={item.id} onClick={() => { setActiveNav(item.id); document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }); }}
                  className={`relative px-4 py-1.5 text-xs font-bold tracking-widest uppercase transition-all duration-300 ${activeNav === item.id ? 'text-white' : 'text-white/40 hover:text-white/70'}`}>
                  {item.label}
                  {activeNav === item.id && <motion.div layoutId="nav-pill" className="absolute inset-0 bg-white/5 rounded-full border border-white/10" transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }} />}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="px-5 py-2 rounded-full bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-colors">
                Join Beta
              </motion.button>
            </div>
          </div>
        </nav>

        <LandingHero />

        <AnimatePresence>
          {heroComplete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }} className="relative z-20">
              <StarField />
              <GrainOverlay />
              <BgBlobs />
              <ScrollGlow />
              <MouseGlow />

              {/* Main Content Sections */}
              <LandingFeatures />
              <LandingTestimonials />
              <LandingAbout />
              <LandingPricing />
              <LandingFAQ />
              <LandingCTA />
              <LandingFooter />

              <motion.div style={{ opacity: bOp }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                <div className="px-4 py-2 rounded-full bg-purple-600/10 border border-purple-500/20 backdrop-blur-md flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-200">Limited Beta Access Open</span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
