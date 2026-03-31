import React, { useRef } from 'react';
import { motion, useTransform, useScroll } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  CheckCircle, Sparkles, ArrowRight, Search, Shield, Zap, Users, 
  Instagram, Youtube, TrendingUp, MapPin, X, Building2, ShoppingBag 
} from 'lucide-react';
import { MushInIcon } from '@/components/ui/MushInLogo';
import { SectionSpotlight, RevealLine, RevealText, BentoCard, Ticker } from '@/components/landing/LandingShared';

/* --- Atom Orbit ------------------------------------------------------------ */
const AtomOrbit = () => {
  const SZ = 500;
  const C  = SZ / 2;
  const R1 = 130, R2 = 220;

  const inner = [
    { deg: -90, color: '#E1306C', label: 'Instagram', icon: <Instagram style={{ width: 18, height: 18, color: '#E1306C' }} /> },
    { deg:  30, color: '#69C9D0', label: 'TikTok',    icon: <span style={{ fontWeight: 900, color: '#69C9D0', fontSize: 12, lineHeight: '1', letterSpacing: '-0.04em' }}>TT</span> },
    { deg: 150, color: '#FF0000', label: 'YouTube',   icon: <Youtube style={{ width: 16, height: 16, color: '#FF4444' }} /> },
  ];

  const outer = [
    { deg: -90, color: '#a855f7', label: 'AI Search',    icon: <Search    style={{ width: 14, height: 14, color: '#c084fc' }} /> },
    { deg: -18, color: '#60a5fa', label: 'Fraud Check',  icon: <Shield    style={{ width: 14, height: 14, color: '#60a5fa' }} /> },
    { deg:  54, color: '#4ade80', label: 'ROAS Engine',  icon: <TrendingUp style={{ width: 14, height: 14, color: '#4ade80' }} /> },
    { deg: 126, color: '#facc15', label: 'Live Data',    icon: <Zap       style={{ width: 14, height: 14, color: '#facc15' }} /> },
    { deg: 198, color: '#fb923c', label: 'Multi-City',   icon: <MapPin    style={{ width: 14, height: 14, color: '#fb923c' }} /> },
    { deg: 270, color: '#f472b6', label: 'Team Board',   icon: <Users     style={{ width: 14, height: 14, color: '#f472b6' }} /> },
  ];

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
    <div style={{ position: 'relative', width: SZ, height: SZ, maxWidth: '100%', margin: '0 auto' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', opacity: 0.35 }}
        viewBox={`0 0 ${SZ} ${SZ}`}>
        {outer.map(({ deg, color }, i) => {
          const x = C + Math.cos((deg * Math.PI) / 180) * R2;
          const y = C + Math.sin((deg * Math.PI) / 180) * R2;
          return (
            <g key={i}>
              <line x1={C} y1={C} x2={x} y2={y} stroke={color} strokeWidth={1}
                strokeDasharray="3 6"
                style={{ animation: `beam-travel ${1.4 + i * 0.18}s linear infinite` }} />
            </g>
          );
        })}
      </svg>
      {ring(R1 * 2, '16s', 'ao-r1', 'cw',  inner, 44)}
      {ring(R2 * 2, '26s', 'ao-r2', 'ccw', outer, 36)}
      <div style={{
        position: 'absolute', top: C - 44, left: C - 44, width: 88, height: 88,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(88,28,135,0.5) 0%, rgba(4,4,8,0.9) 70%)',
        border: '2px solid rgba(168,85,247,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'hub-pulse 3s ease-in-out infinite', zIndex: 10,
      }}>
        <MushInIcon size={58} className="drop-shadow-[0_0_10px_rgba(168,85,247,0.7)]" />
      </div>
    </div>
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
      <div className="text-white/20 text-[10px]">3 verified creatorsSorted by Relevance</div>
      <div className="text-white/15 text-[9px] text-right pb-1 italic">Illustrative; not real data</div>
      <div className="space-y-1">
        {[
          { n: 'Sana Malik',   av: 'SM', bg: '7c3aed', s: 'Lifestyle; Lahore',  f: '421K', e: '7.3%', hi: true },
          { n: 'Usman Tariq',  av: 'UT', bg: '0891b2', s: 'Travel; Karachi',    f: '892K', e: '5.8%' },
          { n: 'Mehreen Raza', av: 'MR', bg: '059669', s: 'Fashion; Islamabad', f: '1.1M', e: '6.4%' },
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
      <span className="ml-2 text-white/30">Creator Trust Score; Sana Malik</span>
    </div>
    <div className="p-4">
      <div className="text-white/15 text-[9px] text-right pb-1 italic">Illustrative; not real data</div>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-black text-white border border-purple-500/30" style={{ background: '#7c3aed' }}>SM</div>
        <div className="flex-1">
          <div className="text-white/80 font-semibold text-sm">Sana Malik</div>
          <div className="text-white/30 text-[10px] mb-1.5">@sana_pk; Lifestyle; Lahore</div>
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
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /><span>Verified audience; Lowest fake-follower ratio</span>
      </div>
    </div>
  </div>
);

const MockKanban = () => (
  <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#0d0d14] shadow-2xl select-none text-xs">
    <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.08] bg-black/25">
      <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" /><div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
      <span className="ml-2 text-white/30">Campaign Kanban; Summer 2025</span>
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

export const LandingFeatures = () => {
  const platforms = [
    { name: 'Instagram', color: '#E1306C', bg: '#E1306C15', border: '#E1306C30', niches: ['Fashion','Beauty','Lifestyle','Food','Travel'] },
    { name: 'TikTok',    color: '#69C9D0', bg: '#69C9D015', border: '#69C9D030', niches: ['Comedy','Entertainment','Dance','Trends','DIY'] },
    { name: 'YouTube',   color: '#FF0000', bg: '#FF000015', border: '#FF000030', niches: ['Tech','Education','Vlogs','Reviews','Gaming'] },
  ];

  return (
    <>
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
              { icon: <Building2 className="w-5 h-5 text-purple-400" />, title: 'Agencies',          desc: 'Manage multiple brand campaigns, deliver verified creator lists, and produce client-ready reports; all from one workspace.' },
              { icon: <ShoppingBag className="w-5 h-5 text-pink-400" />,  title: 'E-commerce Brands', desc: 'Find product creators in your exact niche and city who drive real sales; not just impressions and likes.' },
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
                    <p className="text-zinc-500 text-sm leading-relaxed mt-4">AI fraud analysis using engagement velocity, follower growth patterns, and audience anomalies; estimated on benchmark datasets.</p>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-green-400 text-xs font-medium">Live monitoring active</span>
                    </div>
                  </div>
                </div>
              </BentoCard>
            </motion.div>
            {[{ v: 10, s: 'K+', l: 'Pakistani Creators', delay: .08 }, { v: 4, s: '.2x', l: 'ROAS Improvement', delay: .12 }, { v: 12, s: '+', l: 'Cities Covered', delay: .16 }, { v: 2800, s: '+', l: 'Indexed Creators', delay: .20 }].map((item, i) => (
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
              { problem: 'Fake followers inflate reach by 30-60%',         impact: 'Avg. 2.4x wasted budget per campaign' },
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
            <p className="text-zinc-400 text-lg max-w-xl">Search Instagram, TikTok, and YouTube simultaneously. Filter by Pakistani city, niche, and language; real-time.</p>
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

      {/* INTELLIGENCE ENGINE */}
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
              className="text-zinc-400 text-lg max-w-xl mx-auto">Every signal; search, fraud detection, outreach, ROAS; unified in one orbit.</motion.p>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-center items-center" style={{ minHeight: 520 }}>
            <AtomOrbit />
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
                <p className="text-zinc-400 text-lg leading-relaxed">Enter a niche and city. Get live Pakistani creator profiles from the web; not a stale database.</p>
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
                <p className="text-zinc-400 text-lg leading-relaxed">Save to lists, manage on a visual Kanban, and send outreach; all from one workspace.</p>
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
    </>
  );
};
