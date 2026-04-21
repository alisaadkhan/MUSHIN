import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";

export const LandingHero = () => {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const heroRef  = useRef<HTMLDivElement>(null);

  // ── Lazy-load video with IntersectionObserver ─────────────────────────────
  // The video starts as preload="none" — no bytes are fetched on page load.
  // Once the hero enters the viewport (it's at the top, so immediately),
  // we call video.load() to begin buffering. This defers the 23 MB network
  // request until after the browser has finished the critical render path.
  useEffect(() => {
    const video = videoRef.current;
    const hero  = heroRef.current;
    if (!video || !hero) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Trigger lazy load with a 2.5s delay to allow LCP text and JS critical path to complete first
          setTimeout(() => {
            if (video) video.load();
          }, 2500);
          observer.disconnect();
        }
      },
      { threshold: 0 }  // Fire as soon as 1px enters viewport
    );

    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={heroRef} className="relative h-[100vh]">
      <style>{`
        @keyframes border-glow {
          0%, 100% { box-shadow: 0 0 10px rgba(168,85,247,0.3); }
          50%       { box-shadow: 0 0 20px rgba(168,85,247,0.6), 0 0 30px rgba(168,85,247,0.4); }
        }
        .border-glow { animation: border-glow 2s ease-in-out infinite; }
      `}</style>

      <div
        className="sticky top-0 h-screen overflow-hidden bg-black"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 30%, #2d0a5e 0%, #0a0114 50%, #060608 100%)' }}
      >
        {/*
          preload="none"  — browser fetches 0 bytes until video.load() is called.
          autoPlay        — plays as soon as first bytes arrive (after lazy load triggers).
          muted + playsInline — required for autoplay on mobile.
        */}
        <video
          ref={videoRef}
          aria-hidden="true"
          src="/Flow_202604160852.mp4"
          autoPlay
          playsInline
          muted
          preload="none"
          loop
          onLoadedData={() => setIsVideoLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover mix-blend-screen transition-opacity duration-1000 ${
            isVideoLoaded ? "opacity-40" : "opacity-0"
          }`}
          style={{ willChange: "transform", transform: "translateZ(0)" }}
        />

        {/* Purple ambient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% 40%, rgba(109,40,217,0.35) 0%, rgba(88,28,135,0.15) 45%, transparent 75%)",
          }}
        />

        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div
            className="font-black text-center leading-none select-none text-white/[0.04]"
            style={{ fontSize: "clamp(4rem,15vw,12rem)", letterSpacing: "-0.04em" }}
          >
            MUSHIN
          </div>
        </div>

        {/* Content */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-6 pt-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center"
          >
            <h1
              className="font-black tracking-tighter leading-[.9] mb-7 pointer-events-none text-white drop-shadow-2xl"
              style={{
                fontSize: "clamp(3.5rem,8vw,7.5rem)",
                textShadow: "0 8px 60px rgba(0,0,0,0.8), 0 0 120px rgba(168,85,247,0.4)",
              }}
            >
              FIND AUTHENTIC<br />PAKISTANI<br />INFLUENCERS.
            </h1>
            <p className="text-lg md:text-xl max-w-lg font-normal mb-10 leading-relaxed pointer-events-none text-zinc-300">
              Discover and collaborate with verified creators from Karachi, Lahore, Islamabad and beyond.
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="conic-wrap inline-block mr-0 sm:mr-4 w-full sm:w-auto">
                <Link to="/auth" className="conic-inner flex items-center justify-center gap-3 px-10 h-14 text-white font-bold text-sm tracking-[0.18em] uppercase whitespace-nowrap">
                  BEGIN YOUR SEARCH
                  <span className="w-px h-4 bg-white/20 ml-1" />
                  <ArrowRight className="w-4 h-4 opacity-70 ml-1" />
                </Link>
              </div>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="w-full sm:w-auto h-14 px-8 rounded-full tracking-wide opacity-80 hover:opacity-100"
              >
                <button
                  onClick={() =>
                    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  See how it works
                </button>
              </Button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-5 tracking-wide font-medium">
              Pro · Business · Enterprise · Cancel anytime
            </p>
          </motion.div>
        </div>

        {/* Bottom fade to black */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#060608] to-transparent pointer-events-none" />
      </div>
    </div>
  );
};
