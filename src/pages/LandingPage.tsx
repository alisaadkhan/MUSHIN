import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView, animate, AnimatePresence, MotionConfig, useMotionValueEvent } from 'framer-motion';
import { CheckCircle, DollarSign, Info, Sparkles, ArrowRight, Search, Star, Shield, Zap, Users, Instagram, Youtube, TrendingUp, Globe, MapPin, X, Building2, ShoppingBag } from 'lucide-react';
import { MushInLogo, MushInIcon } from '@/components/ui/MushInLogo';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { LandingHero } from "@/components/landing/LandingHero";
import { GlowCard } from "@/components/ui/spotlight-card";
import OrbitingSkills from "@/components/ui/orbiting-skills";

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
.shiny-text{background:linear-gradient(120deg,#fff 20%,#a855f7 40%,#c084fc 50%,#a855f7 60%,#fff 80%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.aurora-text{background:linear-gradient(270deg,#a855f7,#c084fc,#7c3aed,#d946ef,#a855f7);background-size:400% 400%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
@keyframes star-twinkle{0%,100%{opacity:0.1;transform:scale(1)}50%{opacity:1;transform:scale(1.6)}}
`}</style>;

/* --- Star Field (post-hero background) --------------------------------------- */
/* --- Star Field — canvas-based to avoid 130 DOM nodes ----------------------- */
const StarField = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const COLORS = ['#ffffff', '#a78bfa', '#c084fc', '#f0abfc'];
    const stars = Array.from({ length: 90 }, (_, i) => ({
      x: (i * 137.508 + 11) % 100,
      y: (i * 97.323 + 7) % 100,
      r: i % 3 === 0 ? 1.2 : i % 3 === 1 ? 0.75 : 0.45,
      color: COLORS[i % COLORS.length],
      base: 0.15 + (i % 5) * 0.08,
      phase: (i % 13) * 0.48,
      speed: 2.5 + (i % 7) * 0.65,
    }));

    let raf: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        const opacity = s.base + Math.sin(t / (s.speed * 1000) + s.phase) * s.base * 0.9;
        ctx.beginPath();
        ctx.arc(s.x / 100 * canvas.width, s.y / 100 * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0, opacity);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: 1, opacity: 0.85 }}
    />
  );
};

/* --- Grain Overlay ----------------------------------------------------------- */
const GrainOverlay = () => (
  <svg className="pointer-events-none fixed inset-0 w-full h-full" style={{ zIndex: 2, opacity: 0.04 }} xmlns="http://www.w3.org/2000/svg">
    <filter id="grain-f"><feTurbulence type="fractalNoise" baseFrequency="0.80" numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
    <rect width="100%" height="100%" filter="url(#grain-f)" />
  </svg>
);

/* --- Background Blobs --------------------------------------------------------- */
const BgBlobs = () => (
  <div className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }}>
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full"
      style={{ background: 'radial-gradient(ellipse, rgba(88,28,135,0.09) 0%, transparent 68%)' }} />
    <div className="absolute bottom-0 right-0 w-[700px] h-[500px] rounded-full"
      style={{ background: 'radial-gradient(ellipse, rgba(109,40,217,0.06) 0%, transparent 70%)' }} />
    <div className="absolute top-1/2 left-0 w-[500px] h-[400px] rounded-full"
      style={{ background: 'radial-gradient(ellipse, rgba(168,85,247,0.04) 0%, transparent 70%)' }} />
  </div>
);

/* --- Scroll Glow -------------------------------------------------------------- */
const ScrollGlow = () => {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    const onScroll = () => {
      if (ref.current) ref.current.style.opacity = '1';
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { if (ref.current) ref.current.style.opacity = '0'; }, 700);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer.current); };
  }, []);
  return (
    <div ref={ref} className="pointer-events-none fixed inset-0 z-0" style={{ opacity: 0, transition: 'opacity 0.7s ease' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 35%, rgba(168,85,247,0.14) 0%, rgba(109,40,217,0.06) 45%, transparent 70%)' }} />
    </div>
  );
};

/* --- Mouse Glow -------------------------------------------------------------- */
const MouseGlow = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mv = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.background = `radial-gradient(600px at ${e.clientX}px ${e.clientY}px, rgba(168,85,247,0.10) 0%, rgba(109,40,217,0.04) 40%, transparent 70%)`;
        ref.current.style.opacity = '1';
      }
    };
    const ml = () => { if (ref.current) ref.current.style.opacity = '0'; };
    window.addEventListener('mousemove', mv, { passive: true });
    document.documentElement.addEventListener('mouseleave', ml);
    return () => {
      window.removeEventListener('mousemove', mv);
      document.documentElement.removeEventListener('mouseleave', ml);
    };
  }, []);
  return (
    <div ref={ref} className="pointer-events-none fixed inset-0" style={{ zIndex: 1, opacity: 0, transition: 'opacity 0.4s ease' }} />
  );
};

/* --- Border Beam -------------------------------------------------------------- */
const BorderBeam = ({ color = '#a855f7', size = 1.5, dur = 3 }: { color?: string; size?: number; dur?: number }) => (
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
      
      
    `}</style>
  </div>
);

/* --- Atom Orbit - Mobile Responsive ---------------------------------------- */
const AtomOrbit = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const SZ = isMobile ? 320 : 500;
  const C  = SZ / 2;
  const R1 = isMobile ? 80 : 130;
  const R2 = isMobile ? 140 : 220;
  const iconScale = isMobile ? 0.7 : 1;

  const inner: { deg: number; color: string; icon: React.ReactNode; label: string }[] = [
    { deg: -90, color: '#E1306C', label: 'Instagram', icon: <Instagram style={{ width: 18 * iconScale, height: 18 * iconScale, color: '#E1306C' }} /> },
    { deg:  30, color: '#69C9D0', label: 'TikTok',    icon: <span style={{ fontWeight: 900, color: '#69C9D0', fontSize: 12 * iconScale, lineHeight: '1', letterSpacing: '-0.04em' }}>TT</span> },
    { deg: 150, color: '#FF0000', label: 'YouTube',   icon: <Youtube style={{ width: 16 * iconScale, height: 16 * iconScale, color: '#FF4444' }} /> },
  ];

  const outer: { deg: number; color: string; icon: React.ReactNode; label: string }[] = [
    { deg: -90, color: '#a855f7', label: 'AI Search',    icon: <Search    style={{ width: 14 * iconScale, height: 14 * iconScale, color: '#c084fc' }} /> },
    { deg: -18, color: '#60a5fa', label: 'Fraud Check',  icon: <Shield    style={{ width: 14 * iconScale, height: 14 * iconScale, color: '#60a5fa' }} /> },
    { deg:  54, color: '#4ade80', label: 'ROAS Engine',  icon: <TrendingUp style={{ width: 14 * iconScale, height: 14 * iconScale, color: '#4ade80' }} /> },
    { deg: 126, color: '#facc15', label: 'Live Data',    icon: <Zap       style={{ width: 14 * iconScale, height: 14 * iconScale, color: '#facc15' }} /> },
    { deg: 198, color: '#fb923c', label: 'Multi-City',   icon: <MapPin    style={{ width: 14 * iconScale, height: 14 * iconScale, color: '#fb923c' }} /> },
    { deg: 270, color: '#f472b6', label: 'Team Board',   icon: <Users     style={{ width: 14 * iconScale, height: 14 * iconScale, color: '#f472b6' }} /> },
  ];

  const pos = (r: number, deg: number) => ({
    x: C + Math.cos((deg * Math.PI) / 180) * r,
    y: C + Math.sin((deg * Math.PI) / 180) * r,
  });

  const ring = (W: number, dur: string, cls: string, dir: 'cw' | 'ccw', nodes: typeof inner | typeof outer, iconSz: number) => (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      width: W, height: W, marginTop: -W / 2, marginLeft: -W / 2,
      borderRadius: '50%',
      border: `1px solid rgba(168,85,247,${dir === 'cw' ? '0.15' : '0.09'})`,
      animation: `aring-${dir} ${dur} linear infinite`,
      transform: 'translateZ(0)',
    }} className={cls}>
      {nodes.map(({ deg, color, icon }, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0, transform: `rotate(${deg}deg)` }}>
          <div style={{
            position: 'absolute', top: -(iconSz / 2), left: '50%', marginLeft: -(iconSz / 2),
            width: iconSz, height: iconSz,
            animation: `icon-u${dir === 'cw' ? 'cw' : 'ccw'} ${dur} linear infinite`,
            transform: 'translateZ(0)',
          }}>
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: `radial-gradient(circle, ${color}18 0%, rgba(4,4,8,0.9) 60%)`,
              border: `1px solid ${color}45`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 12px ${color}22`,
              transform: `rotate(${-deg}deg)`,
            }}>{icon}</div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ position: 'relative', width: SZ, height: SZ, maxWidth: '100%', maxHeight: SZ, margin: '0 auto', overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', opacity: 0.35 }}
        viewBox={`0 0 ${SZ} ${SZ}`}>
        {outer.map(({ deg, color }, i) => {
          const p = pos(R2, deg);
          return (
            <g key={i}>
              <line x1={C} y1={C} x2={p.x} y2={p.y} stroke={color} strokeWidth={1}
                strokeDasharray="3 6"
                style={{ animation: `beam-travel ${1.4 + i * 0.18}s linear infinite` }} />
            </g>
          );
        })}
      </svg>
      {ring(R1 * 2, '16s', 'ao-r1', 'cw',  inner, 44 * iconScale)}
      {ring(R2 * 2, '26s', 'ao-r2', 'ccw', outer, 36 * iconScale)}
      <div style={{
        position: 'absolute', top: C - (44 * iconScale), left: C - (44 * iconScale), 
        width: 88 * iconScale, height: 88 * iconScale,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(88,28,135,0.5) 0%, rgba(4,4,8,0.9) 70%)',
        border: '2px solid rgba(168,85,247,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'hub-pulse 3s ease-in-out infinite', zIndex: 10,
      }}>
        <MushInIcon size={58 * iconScale} className="drop-shadow-[0_0_10px_rgba(168,85,247,0.7)]" />
      </div>
    </div>
  );
};

/* --- Marquee ------------------------------------------------------------------ */
const MarqueeRow = ({ items, reverse = false, speed = 35 }: { items: React.ReactNode[]; reverse?: boolean; speed?: number }) => (
  <div className="overflow-hidden w-full">
    <div className="flex gap-4" style={{ animation: `${reverse ? 'marquee-x-rev' : 'marquee-x'} ${speed}s linear infinite`, width: 'max-content' }}>
      {[...items, ...items].map((item, i) => <div key={i} className="flex-shrink-0">{item}</div>)}
    </div>
  </div>
);

/* --- Bento Card --------------------------------------------------------------- */
const BentoCard = ({ children, className = '', glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  // Use ref + direct DOM update to avoid React re-renders on every mousemove
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

/* --- Section Spotlight ------------------------------------------------------- */
/**
 * Applies the same mouse-follow radial gradient used inside BentoCard
 * at section level — giving every major section a subtle ambient glow
 * that follows the cursor, reinforcing spatial depth without distraction.
 */
const SectionSpotlight = ({
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

/* --- Mock UIs ---------------------------------------------------------------- */
const MockSearch = () => (
  <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#0d0d14] shadow-2xl select-none text-xs">
    <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.08] bg-black/25">
      <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" /><div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
      <span className="ml-2 text-white/30">Creator Search</span>
    </div>
    <div className="p-4 space-y-3">
      <div className="flex gap-2 items-center bg-white/[0.04] rounded-lg px-3 py-2.5 border border-white/[0.08]">
        <Search className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
        <span className="text-white/25 flex-1">Find Pakistani creators...</span>
        <span className="px-2.5 py-1 rounded-md bg-purple-600 text-white font-bold">Search</span>
      </div>
      <div className="flex gap-2">
        {['Travel', 'Karachi', 'Instagram'].map(f => <span key={f} className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60">{f}</span>)}
      </div>
      <div className="text-white/20 text-[10px]">3 verified creators — sorted by Relevance</div>
      <div className="text-white/15 text-[9px] text-right pb-1 italic">Illustrative — not real data</div>
      <div className="space-y-1">
        {[
          { n: 'Sana Malik',   av: 'SM', bg: '7c3aed', s: 'Lifestyle — Lahore',  f: '421K', e: '7.3%', hi: true },
          { n: 'Usman Tariq',  av: 'UT', bg: '0891b2', s: 'Travel — Karachi',    f: '892K', e: '5.8%' },
          { n: 'Mehreen Raza', av: 'MR', bg: '059669', s: 'Fashion — Islamabad', f: '1.1M', e: '6.4%' },
        ].map(c => (
          <div key={c.n} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border ${c.hi ? 'bg-purple-600/10 border-purple-500/20' : 'border-transparent'}`}>
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black text-white" style={{ background: `#${c.bg}` }}>{c.av}</div>
            <div className="flex-1 min-w-0"><div className="text-white/70 font-medium truncate">{c.n}</div><div className="text-white/30 text-[10px]">{c.s}</div></div>
            <div className="text-right flex-shrink-0"><div className="text-white/60">{c.f}</div><div className="text-green-400/80 text-[10px]">{c.e} eng</div></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const MockProfile = () => (
  <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#0d0d14] shadow-2xl select-none text-xs">
    <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.08] bg-black/25">
      <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" /><div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
      <span className="ml-2 text-white/30">Creator Trust Score — Sana Malik</span>
    </div>
    <div className="p-4">
      <div className="text-white/15 text-[9px] text-right pb-1 italic">Illustrative — not real data</div>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-black text-white border border-purple-500/30" style={{ background: '#7c3aed' }}>SM</div>
        <div className="flex-1">
          <div className="text-white/80 font-semibold text-sm">Sana Malik</div>
          <div className="text-white/30 text-[10px] mb-1.5">@sana_pk — Lifestyle — Lahore</div>
          <div className="flex gap-1">
            {['Verified', 'Real Eng', 'PK'].map(t => <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc' }}>{t}</span>)}
          </div>
        </div>
        <div className="text-right"><div className="text-4xl font-black text-white leading-none">94</div><div className="text-[10px] text-white/30 mt-0.5">Relevance</div></div>
      </div>
      <div className="space-y-0">
        {[{ l: 'Followers', v: '421K' }, { l: 'Engagement', v: '7.3%' }, { l: 'Fake Followers', v: '< 1.2%' }, { l: 'Total Views', v: '48M' }, { l: 'Avg Views', v: '114K' }].map((r, i, a) => (
          <div key={r.l} className={`flex justify-between py-2 ${i < a.length - 1 ? 'border-b border-white/[0.05]' : ''}`}>
            <span className="text-white/60">{r.l}</span><span className="text-white/70 font-semibold">{r.v}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-green-400">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /><span>Verified audience — Lowest fake-follower ratio</span>
      </div>
    </div>
  </div>
);

const MockKanban = () => (
  <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#0d0d14] shadow-2xl select-none text-xs">
    <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.08] bg-black/25">
      <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" /><div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
      <span className="ml-2 text-white/30">Campaign Kanban — Summer 2025</span>
    </div>
    <div className="p-3 grid grid-cols-3 gap-2">
      {[
        { col: 'Shortlisted', color: 'rgba(168,85,247,0.9)', bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)',
          items: [{ n: 'Sana M.',   av: 'SM', bg2: '7c3aed' }, { n: 'Usman T.', av: 'UT', bg2: '0891b2' }] },
        { col: 'Contacted', color: 'rgba(59,130,246,0.9)',  bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',
          items: [{ n: 'Mehreen R.', av: 'MR', bg2: '059669' }] },
        { col: 'Signed',    color: 'rgba(34,197,94,0.9)',   bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.2)',
          items: [{ n: 'Farah S.',  av: 'FS', bg2: 'd97706' }, { n: 'Ali H.',   av: 'AH', bg2: 'dc2626' }] },
      ].map(({ col, color, bg, border, items }) => (
        <div key={col} className="space-y-1.5">
          <div className="text-[10px] font-bold mb-2" style={{ color }}>{col}</div>
          {items.map(({ n, av, bg2 }) => (
            <div key={n} className="flex items-center gap-1.5 rounded-lg p-2" style={{ background: bg, border: `1px solid ${border}` }}>
              <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-black text-white" style={{ background: `#${bg2}` }}>{av}</div>
              <span className="text-white/60 text-[10px]">{n}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

/* --- Reveal Text -------------------------------------------------------------- */
const wordContainerVariants = {
  hidden: {},
  visible: (delay: number) => ({ transition: { staggerChildren: 0.075, delayChildren: delay } }),
};
const wordVariant = {
  hidden: { y: '110%', opacity: 0 },
  visible: { y: '0%', opacity: 1, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
};
const RevealText = ({ text, className = '', delay = 0 }
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
const RevealLine = ({ delay = 0, color = 'rgba(168,85,247,0.3)' }: { delay?: number; color?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-5% 0px' });
  return (
    <motion.div ref={ref} initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay }}
      style={{ height: 1, background: color, transformOrigin: 'left center', marginBottom: '1.5rem' }} />
  );
};

/* --- Ticker ------------------------------------------------------------------- */
const Ticker = ({ v, s = '' }: { v: number; s?: string }) => {
  const r = useRef<HTMLSpanElement>(null);
  const iv = useInView(r, { once: true });
  useEffect(() => {
    if (!iv || !r.current) return;
    const c = animate(0, v, { duration: 1.8, ease: [.16, 1, .3, 1], onUpdate: n => { if (r.current) r.current.textContent = Math.round(n).toLocaleString() + s; } });
    return () => c.stop();
  }, [iv, v, s]);
  return <span ref={r}>0{s}</span>;
};

/* --- Main --------------------------------------------------------------------- */
export default function LandingPage() {
  const vwRef = useRef<HTMLDivElement>(null);
  const vRef  = useRef<HTMLVideoElement>(null);
  const [activeNav, setActiveNav]   = useState<string | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [pricePeriod, setPricePeriod] = useState<'m' | 'a'>('m');
  // heroComplete starts true — sections are in DOM immediately but naturally
  // hidden below the 300vh hero. The scroll event updates it for the fade-in.
  const [heroComplete, setHeroComplete] = useState(true);

  // -- VIDEO SCRUB REFS ------------------------------------------------------
  const targetRef      = useRef(0);
  const currentRef     = useRef(0);
  const rafRef         = useRef<number>(0);
  const isScrollingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const { scrollYProgress } = useScroll({ target: vwRef, offset: ['start start', 'end end'] });

  // Gate sections: appear only once hero scrub is fully scrolled through
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (v >= 0.98) setHeroComplete(true);
  });

  // -- Scroll transforms — identical to Version 2 ----------------------------
  const hOp       = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const hY        = useTransform(scrollYProgress, [0, 0.12], [0, -50]);
  const textScale = useTransform(scrollYProgress, [0, 0.5],  [1, 1.4]);
  const textOp    = useTransform(scrollYProgress, [0.1, 0.4, 0.8, 1], [0, 1, 1, 0]);
  const bOp       = useTransform(scrollYProgress, [0.7, 1],  [0, 1]);

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

  const platforms = [
    { name: 'Instagram', color: '#E1306C', bg: '#E1306C15', border: '#E1306C30', niches: ['Fashion','Beauty','Lifestyle','Food','Travel'] },
    { name: 'TikTok',    color: '#69C9D0', bg: '#69C9D015', border: '#69C9D030', niches: ['Comedy','Entertainment','Dance','Trends','DIY'] },
    { name: 'YouTube',   color: '#FF0000', bg: '#FF000015', border: '#FF000030', niches: ['Tech','Education','Vlogs','Reviews','Gaming'] },
  ];

  const faqs = [
    { q: 'Which Pakistani cities do you cover?',    a: 'We index creators from Karachi, Lahore, Islamabad, Faisalabad, Peshawar, Multan, Quetta, and 12+ more cities across Pakistan.' },
            { q: 'How accurate is the fraud detection?',    a: 'Our AI fraud scoring delivers high accuracy using engagement velocity analysis, follower growth patterns, and audience overlap detection — calibrated for Pakistani social media behaviour.' },
    { q: 'Can I search for Urdu content creators?', a: 'Yes. You can filter by content language (Urdu/English/Mixed) and niche categories specific to Pakistani culture — cricket, drama, Islamic content, food, and more.' },
        { q: 'Do I need a credit card to start?',       a: 'MUSHIN is subscription-based. Choose Pro, Business, or Enterprise to activate credits and real-time scoring.' },
    { q: 'How fresh is the data?',                  a: "Creator profiles refresh every 24 hours. You're never working with data that's weeks old." },
    { q: 'Can my team collaborate on campaigns?',   a: 'Business plan includes multi-seat access, shared campaign boards, and team analytics dashboards.' },
  ];

  return (
    <MotionConfig transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
    <div className="bg-[#060608] text-white">
      <G />
      {/* <GrainOverlay /> */}
      <BgBlobs />
      <ScrollGlow />
      <MouseGlow />

      {/* -- NAV -- */}
      <nav aria-label="Main navigation" className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300">
        <motion.div 
          role="menubar" 
          className="flex items-center gap-3 border rounded-full bg-[#0a0314] border-white/15 shadow-[0_8px_48px_rgba(0,0,0,0.7)]"
          animate={{ 
            padding: navScrolled ? '8px 24px' : '6px 16px',
            borderRadius: navScrolled ? 9999 : 9999,
            backdropFilter: navScrolled ? 'blur(20px)' : 'blur(0px)',
            boxShadow: navScrolled
              ? '0 8px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(168,85,247,0.15)'
              : '0 8px 48px rgba(0,0,0,0.7)',
            width: navScrolled ? '520px' : 'auto',
          }}
          transition={{ duration: 0.3 }}
          style={{ padding: '6px 16px' }}
        >
          <Link to="/" aria-label="MUSHIN Home" className="flex items-center gap-2 mr-2">
            <MushInIcon size={28} className="text-primary" />
            <span className="text-sm font-bold tracking-[0.15em] text-white" style={{ fontFamily: "'Syne',sans-serif" }}>MUSHIN</span>
          </Link>
          {navItems.map(item => {
            const active = activeNav === item.id;
            return (
              <motion.button key={item.id} role="menuitem" layout whileHover={{ scale: 1.05 }} whileTap={{ scale: .95 }}
                aria-label={`Scroll to ${item.label} section`}
                aria-current={active ? 'true' : undefined}
                onClick={() => { setActiveNav(item.id); document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }); }}
                className={`flex items-center gap-1.5 rounded-full transition-all duration-200 ${active ? 'bg-white text-black px-5 py-2' : 'w-10 h-10 justify-center text-white/60 hover:text-white/70'}`}>
                {item.icon}
                <AnimatePresence>{active && <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="text-sm font-bold overflow-hidden whitespace-nowrap">{item.label}</motion.span>}</AnimatePresence>
              </motion.button>
            );
          })}
          <div className="w-px h-6 bg-white/10 mx-1" aria-hidden="true" />
          <Link to="/auth" aria-label="Log in" className="text-xs font-medium text-white/45 hover:text-white/75 transition-colors px-3 py-2 hidden sm:block">Log in</Link>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: .95 }} style={{ borderRadius: 999 }}>
            <Link to="/auth" aria-label="Start subscription" className="bg-purple-600 hover:bg-purple-500 transition-colors text-white text-sm font-bold px-5 py-2 rounded-full whitespace-nowrap block">Start Subscription</Link>
          </motion.div>
        </motion.div>
      </nav>

      {/* -- VIDEO HERO (Modularized) -- */}
      <LandingHero />

      {/* -- Sections — revealed after hero scroll is complete -- */}
      {/* heroComplete && <StarField /> */}
      {heroComplete && (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
      >

      {/* BUILT FOR */}
      <SectionSpotlight aria-label="Built For section" className="py-16 px-6 border-b border-white/[0.06] z-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="text-purple-400 text-xs font-medium uppercase tracking-widest mb-4">Built For</motion.div>
            <RevealLine />
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter leading-tight">
              <RevealText text="Every Team That Needs" />{' '}
              <RevealText text="Real Results." className="shiny-text" delay={0.18} />
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Building2 className="w-5 h-5 text-purple-400" />, title: 'Agencies',          desc: 'Manage multiple brand campaigns, deliver verified creator lists, and produce client-ready reports — all from one workspace.' },
              { icon: <ShoppingBag className="w-5 h-5 text-pink-400" />,  title: 'E-commerce Brands', desc: 'Find product creators in your exact niche and city who drive real sales — not just impressions and likes.' },
              { icon: <TrendingUp className="w-5 h-5 text-green-400" />, title: 'Performance Teams', desc: 'Measure estimated ROAS before first rupee is spent. Eliminate zero-return placements with data-first selection.' },
              { icon: <Users className="w-5 h-5 text-blue-400" />,       title: 'Corporate Brands',  desc: 'Multi-seat dashboards, approval workflows, and compliance-grade audit trails for enterprise brand safety.' },
            ].map(({ icon, title, desc }, i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 hover:border-purple-500/20 hover:bg-white/[0.04] transition-all duration-200">
                <div className="mb-4 w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:border-purple-500/30 transition-colors">{icon}</div>
                <div className="font-bold text-white mb-2">{title}</div>
                <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </SectionSpotlight>

      {/* BENTO STATS */}
      <SectionSpotlight aria-label="Statistics section" className="py-20 px-6 border-b border-white/[0.06] z-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="text-purple-400 text-xs font-medium uppercase tracking-widest mb-4">By The Numbers</motion.div>
            <RevealLine />
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter leading-tight">
              <RevealText text="Intelligence That" />{' '}
              <RevealText text="Moves the Needle." className="shiny-text" delay={0.15} />
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="col-span-2 row-span-2">
              <BentoCard className="p-8 h-full min-h-[200px]" glow>
                <div className="flex flex-col justify-between h-full">
                  <div>
                    <div className="text-purple-400 text-xs uppercase tracking-widest mb-2 font-medium">Fraud Accuracy</div>
                    <div className="text-7xl md:text-8xl font-black text-white tracking-tight"><Ticker v={95} s="%" /></div>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm leading-relaxed mt-4">AI fraud analysis using engagement velocity, follower growth patterns, and audience anomalies — estimated on benchmark datasets.</p>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-green-400 text-xs font-medium">Live monitoring active</span>
                    </div>
                  </div>
                </div>
              </BentoCard>
            </motion.div>
            {[{ v: 10, s: 'K+', l: 'Pakistani Creators', delay: .08 },             { v: 4, s: '.2—', l: 'ROAS Improvement', delay: .12 }, { v: 12, s: '+', l: 'Cities Covered', delay: .16 },             { v: 2800, s: '+', l: 'Indexed Creators', delay: .20 }].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: item.delay }}>
                <BentoCard className="p-6 h-full">
                  <div className="text-purple-400 text-[10px] uppercase tracking-widest mb-1 font-medium">{item.l}</div>
                  <div className="text-4xl font-black text-white"><Ticker v={item.v} s={item.s} /></div>
                </BentoCard>
              </motion.div>
            ))}
          </div>
        </div>
      </SectionSpotlight>

      {/* PROBLEM AGITATION */}
      <SectionSpotlight aria-label="Problem section" className="py-24 px-6 border-t border-white/[0.06] z-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/20 bg-red-500/[0.06] text-red-400 text-xs font-medium mb-6 uppercase tracking-widest">
              <X className="w-3 h-3" /> The Real Problem
            </motion.div>
            <RevealLine color="rgba(239,68,68,0.25)" />
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-6 leading-tight">
              <RevealText text="Why Influencer Marketing" /><br />
              <RevealText text="Fails in Pakistan." delay={0.2} />
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed mb-8">Most brands are burning budget on fake audiences, manual guesswork, and global tools never designed for Pakistan's unique creator landscape.</p>
            <Link to="/auth" className="inline-flex items-center gap-2 text-purple-400 text-sm font-semibold hover:text-purple-300 transition-colors">
              See how Mushin fixes this <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3 pt-2">
            {[
              { problem: 'Fake followers inflate reach by 30—60%',         impact: 'Avg. 2.4— wasted budget per campaign' },
              { problem: 'Manual spreadsheet research takes 2+ weeks',     impact: 'Opportunities expire before outreach ever happens' },
              { problem: 'No city-level or Urdu language targeting',       impact: 'Karachi brands paying for Lahore audiences' },
              { problem: 'Zero demographic transparency post-campaign',    impact: "You never know who's actually seeing your content" },
              { problem: 'Global tools ignore Pakistani platform nuances', impact: 'Critical blind spots in TikTok PK and local YouTube niches' },
            ].map(({ problem, impact }, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="flex gap-3 p-4 rounded-xl border border-red-500/10 bg-red-500/[0.03] hover:bg-red-500/[0.05] transition-colors">
                <X className="w-4 h-4 text-red-400/70 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-white/80 text-sm font-semibold mb-0.5">{problem}</div>
                  <div className="text-red-400/60 text-xs">{impact}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </SectionSpotlight>

      {/* PLATFORMS */}
      <SectionSpotlight id="features" aria-label="Platform coverage section" className="py-24 px-6 z-20">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-16">
            <div className="text-purple-400 text-xs font-medium uppercase tracking-widest mb-4">Platform Coverage</div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-4">Find Creators on<br />Every Platform.</h2>
            <p className="text-zinc-400 text-lg max-w-xl">Search Instagram, TikTok, and YouTube simultaneously. Filter by Pakistani city, niche, and language — real-time.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5">
            {platforms.map((pl, pi) => (
              <motion.div key={pl.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: pi * .1 }}
                whileHover={{ y: -6 }}
                className="rounded-2xl border p-7 cursor-pointer" style={{ borderColor: pl.border, background: pl.bg }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="font-black text-2xl" style={{ color: pl.color }}>{pl.name}</div>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse ml-1" style={{ background: pl.color }} />
                </div>
                <div className="text-xs font-medium mb-5" style={{ color: pl.color + 'aa' }}>Daily updated data</div>
                <div className="flex flex-wrap gap-2">
                  {pl.niches.map(n => (
                    <motion.span key={n} whileHover={{ scale: 1.08 }} className="text-xs px-2.5 py-1 rounded-lg font-medium cursor-default"
                      style={{ background: pl.color + '18', color: pl.color, border: `1px solid ${pl.color}35` }}>{n}</motion.span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </SectionSpotlight>

      {/* INTELLIGENCE ENGINE — ATOM ORBIT */}
      <SectionSpotlight aria-label="Intelligence engine section" className="py-24 px-6 border-t border-white/[0.06] z-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="text-purple-400 text-xs font-medium uppercase tracking-widest mb-4">The Intelligence Engine</motion.div>
            <RevealLine />
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 leading-tight">
              <RevealText text="Your" />{' '}<RevealText text="Command Center" className="shiny-text" delay={0.1} /><br />
              <RevealText text="for Pakistani Creators." delay={0.22} />
            </h2>
            <motion.p initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }}
              className="text-zinc-400 text-lg max-w-xl mx-auto">Every signal — search, fraud detection, outreach, ROAS — unified in one orbit.</motion.p>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-center items-center" style={{ minHeight: 520 }}>
            <OrbitingSkills />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
            className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4 max-w-2xl mx-auto">
            {[
              { label: 'AI Search',   color: '#a855f7', icon: <Search    style={{ width: 11, height: 11 }} /> },
              { label: 'Fraud Check', color: '#60a5fa', icon: <Shield    style={{ width: 11, height: 11 }} /> },
              { label: 'ROAS Engine', color: '#4ade80', icon: <TrendingUp style={{ width: 11, height: 11 }} /> },
              { label: 'Live Data',   color: '#facc15', icon: <Zap       style={{ width: 11, height: 11 }} /> },
              { label: 'Multi-City',  color: '#fb923c', icon: <MapPin    style={{ width: 11, height: 11 }} /> },
              { label: 'Team Board',  color: '#f472b6', icon: <Users     style={{ width: 11, height: 11 }} /> },
            ].map(({ label, color, icon }) => (
              <div key={label} className="flex items-center gap-1.5 justify-center px-3 py-1.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide"
                style={{ borderColor: color + '30', background: color + '0a', color: color + 'cc' }}>
                <span style={{ color }}>{icon}</span>{label}
              </div>
            ))}
          </motion.div>
        </div>
      </SectionSpotlight>

      {/* 3 STEPS */}
      <SectionSpotlight aria-label="How it works section" className="py-24 px-6 border-t border-white/[0.06] z-20">
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-20">
            <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="text-purple-400 text-xs font-medium uppercase tracking-widest mb-4">How it works</motion.div>
            <RevealLine />
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
              <RevealText text="From Search to Signed" /><br />
              <RevealText text="Deal in 3 Steps." delay={0.2} />
            </h2>
            <div className="flex gap-4 text-xs font-bold uppercase tracking-widest text-white/25 mt-4">
              <span>Discover</span><span>/</span><span>Analyze</span><span>/</span><span>Close</span>
            </div>
          </motion.div>
          <div className="space-y-24">
            <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: .5 }}
              className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="font-black text-[7rem] leading-none mb-4 select-none" style={{ color: 'rgba(168,85,247,0.10)' }}>01</div>
                <h3 className="text-2xl md:text-3xl font-black tracking-tight mb-4">Discover Verified Creators</h3>
                <p className="text-zinc-400 text-lg leading-relaxed">Enter a niche and city. Get live Pakistani creator profiles from the web — not a stale database.</p>
              </div>
              <div className="shadow-[0_24px_80px_rgba(0,0,0,.6)]"><MockSearch /></div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: .5 }}
              className="grid md:grid-cols-2 gap-12 items-center md:[&>*:first-child]:order-2">
              <div>
                <div className="font-black text-[7rem] leading-none mb-4 select-none" style={{ color: 'rgba(168,85,247,0.10)' }}>02</div>
                <h3 className="text-2xl md:text-3xl font-black tracking-tight mb-4">Analyze Trust Signals</h3>
                <p className="text-zinc-400 text-lg leading-relaxed">AI fraud scores, engagement metrics, and verified contacts surface in one click. Know who's real.</p>
              </div>
              <div className="shadow-[0_24px_80px_rgba(0,0,0,.6)]"><MockProfile /></div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: .5 }}
              className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="font-black text-[7rem] leading-none mb-4 select-none" style={{ color: 'rgba(168,85,247,0.10)' }}>03</div>
                <h3 className="text-2xl md:text-3xl font-black tracking-tight mb-4">Close the Deal</h3>
                <p className="text-zinc-400 text-lg leading-relaxed">Save to lists, manage on a visual Kanban, and send outreach — all from one workspace.</p>
              </div>
              <div className="shadow-[0_24px_80px_rgba(0,0,0,.6)]"><MockKanban /></div>
            </motion.div>
          </div>
        </div>
      </SectionSpotlight>

      {/* COMPARISON TABLE */}
      <SectionSpotlight aria-label="Comparison section" className="py-24 px-6 border-t border-white/[0.06] z-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="text-purple-400 text-xs font-medium uppercase tracking-widest mb-4">Why Mushin</motion.div>
            <RevealLine />
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              <RevealText text="Not All Tools Are" /><br />
              <RevealText text="Created Equal." delay={0.18} />
            </h2>
          </div>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
            <table aria-label="Mushin vs alternatives feature comparison" className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="text-left py-4 px-5 text-zinc-500 font-semibold w-1/2">Capability</th>
                  <th className="text-center py-4 px-3 text-zinc-600 font-medium text-xs">Manual</th>
                  <th className="text-center py-4 px-3 text-zinc-500 font-medium text-xs">Global Tools</th>
                  <th className="text-center py-4 px-3 text-purple-400 font-bold text-xs bg-purple-500/[0.08]">Mushin</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ['Pakistan-Specific AI Model',       false,  false,  true],
                  ['City-Level Creator Filters',        false,  false,  true],
                  ['Fraud Detection Accuracy',          'None', '~60%', '>90%'],
                  ['Urdu / English Content Filter',     false,  false,  true],
                  ['Pakistani Audience Demographics',   false,  false,  true],
                  ['24h Data Refresh Rate',             false,  false,  true],
                  ['ROAS Estimation Engine',            false,  false,  true],
                  ['Kanban Outreach Board',             false,  false,  true],
                ] as [string, boolean | string, boolean | string, boolean | string][]).map(([feat, man, glob, iq], i) => (
                  <tr key={i} className={`border-b border-white/[0.06] last:border-0 ${i % 2 !== 0 ? 'bg-white/[0.01]' : ''}`}>
                    <td className="py-3.5 px-5 text-white/70 text-sm">{feat}</td>
                    <td className="py-3.5 px-3 text-center">{man === false ? <X className="w-3.5 h-3.5 text-zinc-700 mx-auto" /> : <span className="text-zinc-500 text-xs">{man}</span>}</td>
                    <td className="py-3.5 px-3 text-center">{glob === false ? <X className="w-3.5 h-3.5 text-zinc-600 mx-auto" /> : <span className="text-zinc-400 text-xs">{glob}</span>}</td>
                    <td className="py-3.5 px-3 text-center bg-purple-500/[0.04]">{iq === true ? <CheckCircle className="w-4 h-4 text-purple-400 mx-auto" /> : <span className="text-purple-300 text-xs font-semibold">{iq}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </motion.div>
        </div>
      </SectionSpotlight>

      {/* ABOUT */}
      <SectionSpotlight id="about" aria-label="About section" className="py-24 px-6 border-t border-white/[0.06] z-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="text-purple-400 text-xs font-medium uppercase tracking-widest mb-4">About MUSHIN</motion.div>
            <RevealLine />
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-6 leading-tight">
              <RevealText text="Built for Pakistan's" /><br />
              <RevealText text="Creator Economy." delay={0.18} />
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed mb-6">We're a Karachi-based team obsessed with data accuracy and creator intelligence. We index the Pakistani creator space so your brand doesn't have to guess.</p>
            <p className="text-zinc-500 leading-relaxed">Every fraud score, every engagement metric, every audience demographic is calibrated specifically for how Pakistani audiences interact on Instagram, TikTok, and YouTube.</p>
          </div>
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="grid grid-cols-2 gap-4">
            {[{ v: '2023', l: 'Founded in Karachi' }, { v: '12+', l: 'Cities Indexed' }, { v: '3', l: 'Platforms Covered' }, { v: '24h', l: 'Data Refresh Rate' }].map(({ v, l }, i) => (
              <BentoCard key={i} className="p-6">
                <div className="text-3xl font-black text-white mb-1">{v}</div>
                <div className="text-zinc-500 text-sm">{l}</div>
              </BentoCard>
            ))}
          </motion.div>
        </div>
      </SectionSpotlight>

      {/* OBJECTION HANDLING */}
      <SectionSpotlight aria-label="Objection handling section" className="py-20 px-6 border-t border-white/[0.06] z-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="text-purple-400 text-xs font-medium uppercase tracking-widest mb-4">Zero Risk</motion.div>
            <RevealLine />
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter">
              <RevealText text="Every Concern, Addressed." />
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { icon: <Shield className="w-5 h-5 text-green-400" />,   title: 'No Lock-In',         desc: 'Month-to-month billing. Cancel instantly from your dashboard — no questions asked.' },
              { icon: <CheckCircle className="w-5 h-5 text-blue-400" />, title: 'Transparent Pricing', desc: 'The price listed is the price you pay. Zero hidden overages or surprise fees.' },
              { icon: <Zap className="w-5 h-5 text-yellow-400" />,     title: 'Real Human Support',  desc: 'Every plan includes support via email and chat — not a bot, not a knowledge base article.' },
              { icon: <Users className="w-5 h-5 text-purple-400" />,   title: '10,000+ Creators',   desc: '10,000+ indexed Pakistani creator profiles. If they are active, we are tracking them.' },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-3">{item.icon}</div>
                <div className="font-bold text-sm text-white mb-1">{item.title}</div>
                <div className="text-zinc-500 text-xs leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.04] p-8 text-center">
            <div className="text-white font-black text-xl mb-2">Refund Policy</div>
            <div className="text-zinc-400 text-sm max-w-md mx-auto">
              We do not offer refunds. You can cancel anytime and keep access until the end of your billing period.
            </div>
            <div className="mt-4">
              <Link to="/refunds" className="text-purple-400 text-sm font-semibold hover:text-purple-300 transition-colors">
                Read the full Refund Policy <ArrowRight className="inline-block w-4 h-4 ml-1" />
              </Link>
            </div>
          </div>
        </div>
      </SectionSpotlight>

      {/* PRICING */}
      <SectionSpotlight id="pricing" aria-label="Pricing section" className="py-24 px-6 border-t border-white/[0.06] z-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="text-purple-400 text-xs font-medium uppercase tracking-widest mb-4">Pricing</motion.div>
            <RevealLine />
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              <RevealText text="Simple, Honest" />{' '}
              <RevealText text="Pricing." delay={0.15} />
            </h2>
            <div className="flex items-center justify-center gap-3 mt-6" role="group" aria-label="Billing period">
              <button aria-pressed={pricePeriod === 'm'} onClick={() => setPricePeriod('m')} className={`text-xs font-bold px-4 py-1.5 rounded-full transition-all ${pricePeriod === 'm' ? 'bg-white text-black' : 'text-white/60 hover:text-white/80'}`}>Monthly</button>
              <button aria-pressed={pricePeriod === 'a'} onClick={() => setPricePeriod('a')} className={`text-xs font-bold px-4 py-1.5 rounded-full transition-all ${pricePeriod === 'a' ? 'bg-white text-black' : 'text-white/60 hover:text-white/80'}`}>Annual <span className="text-green-400">-20%</span></button>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {([
              {
                name: 'Pro',
                price: { m: 4999,  a: 3999  },
                desc: 'For brands running active campaigns.',
                features: ['500 search credits/mo','100 enrichment credits/mo','500 email sends/mo','Real-time scoring','MUSHIN score accuracy: 85%','Team members: 3'],
                cta: 'Start Pro',
                highlight: true,
              },
              {
                name: 'Business',
                price: { m: 14999, a: 11999 },
                desc: 'For agencies managing multiple brands.',
                features: ['2,000 search credits/mo','500 enrichment credits/mo','2,000 email sends/mo','Unlimited AI insights','Real-time scoring','MUSHIN score accuracy: 92%','Team members: 10'],
                cta: 'Start Business',
                highlight: false,
              },
              {
                name: 'Enterprise',
                price: { m: 39999, a: 31999 },
                desc: 'For large teams and high-volume research.',
                features: ['10,000 search credits/mo','2,500 enrichment credits/mo','10,000 email sends/mo','Unlimited AI insights','Real-time scoring','MUSHIN score accuracy: 96%','Team members: 50','Priority support'],
                cta: 'Contact Sales',
                highlight: false,
              },
            ] as { name: string; price: { m: number; a: number }; desc: string; features: string[]; cta: string; highlight: boolean }[]).map(plan => (
              <motion.div key={plan.name} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className={`relative rounded-2xl border p-7 flex flex-col ${plan.highlight ? 'border-purple-500/40 bg-purple-500/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
                {plan.highlight && <BorderBeam />}
                {plan.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-purple-600 text-white text-[10px] font-bold uppercase tracking-widest">Most Popular</div>}
                <div className="mb-5">
                  <div className="text-sm font-bold text-white/60 mb-1">{plan.name}</div>
                  <div className="flex items-end gap-1.5">
                    <span className="text-4xl font-black text-white">Rs {(pricePeriod === 'm' ? plan.price.m : plan.price.a).toLocaleString()}</span>
                    {plan.price.m > 0 && <span className="text-white/30 text-sm mb-1">/mo</span>}
                  </div>
                  <div className="text-zinc-500 text-xs mt-1">{plan.desc}</div>
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                      <CheckCircle className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <GlowCard className="p-0 rounded-full w-full border-none">
                  <Link
                    to="/auth"
                    className={`relative z-10 block text-center py-3 rounded-full text-sm font-bold transition-all ${
                      plan.highlight ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </GlowCard>
              </motion.div>
            ))}
          </div>
        </div>
      </SectionSpotlight>

      {/* FAQ */}
      <SectionSpotlight aria-label="Frequently asked questions" className="py-24 px-6 border-t border-white/[0.06] z-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="text-purple-400 text-xs font-medium uppercase tracking-widest mb-4">FAQ</motion.div>
            <RevealLine />
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter">
              <RevealText text="Questions, Answered." />
            </h2>
          </div>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-white/10 rounded-xl overflow-hidden">
                <AccordionTrigger className="px-5 py-4 text-sm font-semibold text-white/80 hover:text-white text-left hover:no-underline">{faq.q}</AccordionTrigger>
                <AccordionContent className="px-5 pb-4 text-sm text-zinc-400 leading-relaxed">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </SectionSpotlight>

      {/* CTA */}
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
          <p className="text-zinc-600 text-xs mt-6">Choose a plan to activate credits and real-time scoring.</p>
        </div>
      </SectionSpotlight>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.06] py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-8 mb-10">
            <div className="max-w-xs">
              <div className="mb-3"><MushInLogo height={32} /></div>
              <p className="text-zinc-500 text-sm leading-relaxed">Pakistan's first AI-powered influencer intelligence platform. Built to bring signal to a noisy market.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              <div>
                <div className="text-white/60 font-semibold uppercase tracking-widest text-[10px] mb-3">Product</div>
                <div className="space-y-2">
                  <button
                    className="block text-left text-zinc-500 hover:text-white transition-colors"
                    onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    Features
                  </button>
                  <Link to="/pricing" className="block text-zinc-500 hover:text-white transition-colors">Pricing</Link>
                  <Link to="/blog" className="block text-zinc-500 hover:text-white transition-colors">Changelog</Link>
                </div>
              </div>
              <div>
                <div className="text-white/60 font-semibold uppercase tracking-widest text-[10px] mb-3">Company</div>
                <div className="space-y-2">
                  <button
                    className="block text-left text-zinc-500 hover:text-white transition-colors"
                    onClick={() => document.getElementById("about")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    About
                  </button>
                  <Link to="/blog" className="block text-zinc-500 hover:text-white transition-colors">Blog</Link>
                  <span className="block text-zinc-500 cursor-default">Careers</span>
                  <span className="block text-zinc-500 cursor-default">Press</span>
                </div>
              </div>
              <div>
                <div className="text-white/60 font-semibold uppercase tracking-widest text-[10px] mb-3">Legal</div>
                <div className="space-y-2">
                  <Link to="/privacy" className="block text-zinc-500 hover:text-white transition-colors">Privacy</Link>
                  <Link to="/terms"   className="block text-zinc-500 hover:text-white transition-colors">Terms</Link>
                   <Link to="/cookies" className="block text-zinc-500 hover:text-white transition-colors">Cookies</Link>
                  <Link to="/subscription" className="block text-zinc-500 hover:text-white transition-colors">SaaS Subscription</Link>
                  <Link to="/refunds" className="block text-zinc-500 hover:text-white transition-colors">Refund Policy</Link>
                  <Link to="/eula" className="block text-zinc-500 hover:text-white transition-colors">EULA</Link>
                  <Link to="/dpa" className="block text-zinc-500 hover:text-white transition-colors">DPA</Link>
                  <Link to="/sla" className="block text-zinc-500 hover:text-white transition-colors">SLA</Link>
                  <Link to="/aup" className="block text-zinc-500 hover:text-white transition-colors">AUP</Link>
                  <Link to="/nda" className="block text-zinc-500 hover:text-white transition-colors">NDA</Link>
                  <Link to="/msa" className="block text-zinc-500 hover:text-white transition-colors">MSA</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-zinc-600 text-xs">&copy; 2026 Mushin. All rights reserved. Made in Pakistan 🇵🇰</div>
            <div className="flex items-center gap-4">
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram className="w-4 h-4 text-zinc-600 hover:text-white transition-colors cursor-pointer" /></a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><Youtube   className="w-4 h-4 text-zinc-600 hover:text-white transition-colors cursor-pointer" /></a>
              <a href="https://mushin-syq3.vercel.app" target="_blank" rel="noopener noreferrer" aria-label="Website"><Globe     className="w-4 h-4 text-zinc-600 hover:text-white transition-colors cursor-pointer" /></a>
            </div>
          </div>
        </div>
      </footer>

      </motion.div>
      )}

    </div>
    </MotionConfig>
  );
}

