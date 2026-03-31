import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { SectionSpotlight, RevealLine, RevealText, MarqueeRow } from '@/components/landing/LandingShared';

export const LandingTestimonials = () => {
  return (
    <SectionSpotlight aria-label="Testimonials section" className="py-20 border-t border-white/[0.06] z-20">
      <div>
        <div className="text-center mb-12 px-6">
          <motion.div initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="text-purple-400 text-xs font-medium uppercase tracking-widest mb-4">Built for Marketing Teams Across Pakistan</motion.div>
          <RevealLine />
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight">
            <RevealText text="Teams Love" className="aurora-text" />{' '}
            <RevealText text="What We Built." delay={0.2} />
          </h2>
          <p className="text-white/30 text-xs mt-4">* Testimonials below are illustrative scenarios — not attributed to specific companies.</p>
        </div>
        <div className="mb-8">
          <MarqueeRow speed={28} items={['Fintech','E-commerce','Telecom','Fashion Retail','FMCG','Digital Agency','D2C Brand','Media House','Startup','Food & Beverage','Beauty & Skincare','EdTech'].map((b, i) => (
            <div key={i} className="px-5 py-2 rounded-full border border-white/10 bg-white/[0.03] text-white/60 text-sm font-semibold whitespace-nowrap hover:border-purple-500/30 hover:text-purple-400 transition-colors cursor-pointer">{b}</div>
          ))} />
        </div>
        <div className="space-y-4">
          <MarqueeRow speed={38} items={[
            { name: 'Sarah K.',  role: 'Brand Manager — Fintech',         text: 'Found 3 mega-creators for our Eid campaign in under 10 minutes. The ROAS was exceptional.' },
            { name: 'Ahmed R.',  role: 'Growth Lead — E-commerce',        text: 'The fraud detection alone saved us from 2 fake-follower influencers with 800K combined followers.' },
            { name: 'Fatima Z.', role: 'CMO — Fashion Retail',            text: 'We replaced 3 separate tools with Mushin. The Kanban board is a game changer.' },
            { name: 'Usman T.', role: 'Digital Director — Fintech',       text: 'Karachi-specific filtering is insane. Found 47 verified nano-influencers in our exact market.' },
          ].map((t, i) => (
            <div key={i} className="w-72 flex-shrink-0 bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:border-purple-500/20 transition-all">
              <div className="flex gap-1 mb-3">{[...Array(5)].map((_, j) => <Star key={j} className="w-3 h-3 fill-purple-400 text-purple-400" />)}</div>
              <p className="text-white/70 text-sm leading-relaxed mb-4">"{t.text}"</p>
              <div className="text-sm font-bold text-white">{t.name}</div>
              <div className="text-white/60 text-xs">{t.role}</div>
            </div>
          ))} />
          <MarqueeRow reverse speed={42} items={[
            { name: 'Nadia M.',  role: 'Influencer Lead — Fashion Retail', text: "The Relevance Score is the most reliable metric for Pakistani creator quality I've ever used." },
            { name: 'Bilal A.',  role: 'CEO — Digital Agency',             text: 'Clients trust our recommendations more now that we back everything with Mushin data.' },
            { name: 'Anosha B.', role: 'Marketing Head — D2C Brand',       text: 'Went from 2 weeks of manual research to 30 minutes of verified outreach. Remarkable.' },
            { name: 'Zaid H.',   role: 'Founder — Media House',            text: 'City-level niche filters are something no other platform offers for Pakistan. Game-changing.' },
          ].map((t, i) => (
            <div key={i} className="w-72 flex-shrink-0 bg-white/[0.03] border border-white/10 rounded-2xl p-5 hover:border-purple-500/20 transition-all">
              <div className="flex gap-1 mb-3">{[...Array(5)].map((_, j) => <Star key={j} className="w-3 h-3 fill-purple-400 text-purple-400" />)}</div>
              <p className="text-white/70 text-sm leading-relaxed mb-4">"{t.text}"</p>
              <div className="text-sm font-bold text-white">{t.name}</div>
              <div className="text-white/60 text-xs">{t.role}</div>
            </div>
          ))} />
        </div>
      </div>
    </SectionSpotlight>
  );
};
