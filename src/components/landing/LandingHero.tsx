import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const LandingHero = () => {
  return (
    <div className="relative h-[100vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-black" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 30%, #2d0a5e 0%, #0a0114 50%, #060608 100%)' }}>
        <video
          aria-hidden="true"
          src="/A_seamless_cinematic_transition_from_a_dark_obsidian_c.mp4"
          autoPlay playsInline muted preload="none" loop
          poster="/hero-poster.jpg"
          className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen"
          style={{ willChange: 'transform', transform: 'translateZ(0)' }}
        />
        {/* Purple ambient overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 40%, rgba(109,40,217,0.35) 0%, rgba(88,28,135,0.15) 45%, transparent 75%)' }} />

        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="font-black text-center leading-none select-none text-white/[0.04]" style={{ fontSize: 'clamp(4rem,15vw,12rem)', letterSpacing: '-0.04em' }}>MUSHIN</div>
        </div>

        {/* Content */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-6 pt-16">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col items-center">
                <h1
                className="font-black tracking-tighter leading-[.9] mb-7 pointer-events-none text-white drop-shadow-2xl" 
                style={{ fontSize: 'clamp(3.5rem,8vw,7.5rem)', textShadow: '0 8px 60px rgba(0,0,0,0.8), 0 0 120px rgba(168,85,247,0.4)' }}>
                FIND AUTHENTIC<br />PAKISTANI<br />INFLUENCERS.
                </h1>
                <p className="text-lg md:text-xl max-w-lg font-normal mb-10 leading-relaxed pointer-events-none text-zinc-300">
                Discover and collaborate with verified creators from Karachi, Lahore, Islamabad and beyond.
                </p>

                {/* Hero CTAs */}
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <Button asChild size="lg" variant="default" className="w-full sm:w-auto h-14 px-10 rounded-full tracking-wide">
                        <Link to="/auth">Start for Free <ArrowRight className="w-4 h-4 ml-2 opacity-80" /></Link>
                    </Button>
                    <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto h-14 px-8 rounded-full tracking-wide opacity-80 hover:opacity-100">
                        <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                            See how it works
                        </button>
                    </Button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-5 tracking-wide font-medium">No credit card required &middot; Free plan forever</p>
            </motion.div>
        </div>

        {/* Bottom smooth fade to black */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#060608] to-transparent pointer-events-none" />
      </div>
    </div>
  );
};
