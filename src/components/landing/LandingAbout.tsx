import { motion } from 'framer-motion';
import { Shield, CheckCircle, Zap, Users } from 'lucide-react';
import { SectionSpotlight, RevealLine, RevealText, BentoCard } from '@/components/landing/LandingShared';

export const LandingAbout = () => {
  return (
    <>
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
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-8 text-center">
            <div className="text-4xl mb-3">💰</div>
            <div className="text-white font-black text-xl mb-2">14-Day Money-Back Guarantee</div>
            <div className="text-zinc-400 text-sm max-w-md mx-auto">Not satisfied in the first 14 days? Email us and we'll refund every rupee. No forms, no friction.</div>
          </div>
        </div>
      </SectionSpotlight>
    </>
  );
};
