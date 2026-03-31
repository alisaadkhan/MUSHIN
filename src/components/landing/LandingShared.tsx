import React, { useRef, useEffect } from 'react';
import { motion, useInView, animate } from 'framer-motion';
import { Instagram, Youtube, Search, Shield, TrendingUp, Zap, MapPin, Users } from 'lucide-react';

/* --- Border Beam -------------------------------------------------------------- */
export const BorderBeam = ({ color = '#a855f7', size = 1.5, dur = 3 }: { color?: string; size?: number; dur?: number }) => (
  <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
    {/* Static mask/position props live in CSS; only dynamic values stay inline */}
    <div
      className="border-beam"
      style={{
        padding: size,
        background: `conic-gradient(from var(--bangle,0deg),transparent 70%,${color} 80%,${color}99 85%,transparent 90%)`,
        animation: `beamspin ${dur}s linear infinite`,
      }}
    />
    <style>{`
      .border-beam {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
      }
      @keyframes beamspin { to { --bangle: 360deg; } }
      @property --bangle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
    `}</style>
  </div>
);

/* --- Section Spotlight ------------------------------------------------------- */
/**
 * Applies the same mouse-follow radial gradient used inside BentoCard
 * at section level — giving every major section a subtle ambient glow
 * that follows the cursor, reinforcing spatial depth without distraction.
 */
export const SectionSpotlight = ({
  children, id, className = '', 'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  'aria-label'?: string;
}) => {
  const sRef    = useRef<HTMLElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  return (
    <section
      ref={sRef}
      id={id}
      aria-label={ariaLabel}
      className={`relative overflow-hidden ${className}`}
      onMouseMove={e => {
        const r = sRef.current?.getBoundingClientRect();
        if (r && spotRef.current) {
          spotRef.current.style.background =
            `radial-gradient(700px at ${e.clientX - r.left}px ${e.clientY - r.top}px,rgba(168,85,247,0.055),transparent 65%)`;
          spotRef.current.style.opacity = '1';
        }
      }}
      onMouseLeave={() => { if (spotRef.current) spotRef.current.style.opacity = '0'; }}
    >
      <div ref={spotRef} aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ opacity: 0, transition: 'opacity 0.35s ease', zIndex: 1 }}
      />
      <div className="relative" style={{ zIndex: 2 }}>{children}</div>
    </section>
  );
};

/* --- Reveal Text -------------------------------------------------------------- */
const wordContainerVariants = {
  hidden: {},
  visible: (delay: number) => ({ transition: { staggerChildren: 0.075, delayChildren: delay } }),
};
const wordVariant = {
  hidden: { y: '110%', opacity: 0 },
  visible: { y: '0%', opacity: 1, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
};
export const RevealText = ({ text, className = '', delay = 0 }
  : { text: string; className?: string; delay?: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-8% 0px' });
  return (
    <motion.span ref={ref} className={`inline ${className}`}
      variants={wordContainerVariants} custom={delay} initial="hidden" animate={inView ? 'visible' : 'hidden'}>
      {text.split(' ').map((word, i) => (
        <span key={i} className="reveal-word">
          <motion.span style={{ display: 'inline-block' }} variants={wordVariant}>{word}</motion.span>
        </span>
      ))}
    </motion.span>
  );
};

/* --- Reveal Line -------------------------------------------------------------- */
export const RevealLine = ({ delay = 0, color = 'rgba(168,85,247,0.3)' }: { delay?: number; color?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-5% 0px' });
  return (
    <motion.div ref={ref} initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay }}
      style={{ height: 1, background: color, transformOrigin: 'left center', marginBottom: '1.5rem' }} />
  );
};

/* --- Marquee ------------------------------------------------------------------ */
export const MarqueeRow = ({ items, reverse = false, speed = 35 }: { items: React.ReactNode[]; reverse?: boolean; speed?: number }) => (
  <div className="overflow-hidden w-full">
    <div className="flex gap-4" style={{ animation: `${reverse ? 'marquee-x-rev' : 'marquee-x'} ${speed}s linear infinite`, width: 'max-content' }}>
      {[...items, ...items].map((item, i) => <div key={i} className="flex-shrink-0">{item}</div>)}
    </div>
  </div>
);

/* --- Bento Card --------------------------------------------------------------- */
export const BentoCard = ({ children, className = '', glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const spotRef = useRef<HTMLDivElement>(null);
  return (
    <motion.div ref={ref} whileHover={{ scale: 1.02, y: -3 }} transition={{ duration: .18 }}
      onMouseMove={e => {
        const r = ref.current?.getBoundingClientRect();
        if (r && spotRef.current) {
          const x = e.clientX - r.left, y = e.clientY - r.top;
          spotRef.current.style.background = `radial-gradient(280px at ${x}px ${y}px,rgba(168,85,247,0.13),transparent 60%)`;
          spotRef.current.style.opacity = '1';
        }
      }}
      onMouseLeave={() => { if (spotRef.current) spotRef.current.style.opacity = '0'; }}
      className={`relative rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden ${className}`}>
      <div ref={spotRef} className="pointer-events-none absolute inset-0 rounded-2xl" style={{ opacity: 0, zIndex: 0, transition: 'opacity 0.2s' }} />
      {glow && <BorderBeam />}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

/* --- Ticker ------------------------------------------------------------------- */
export const Ticker = ({ v, s = '' }: { v: number; s?: string }) => {
  const r = useRef<HTMLSpanElement>(null);
  const iv = useInView(r, { once: true });
  useEffect(() => {
    if (!iv || !r.current) return;
    const c = animate(0, v, { duration: 1.8, ease: [.16, 1, .3, 1], onUpdate: n => { if (r.current) r.current.textContent = Math.round(n).toLocaleString() + s; } });
    return () => c.stop();
  }, [iv, v, s]);
  return <span ref={r}>0{s}</span>;
};
