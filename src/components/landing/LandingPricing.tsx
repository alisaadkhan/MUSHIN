import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { SectionSpotlight, RevealLine, RevealText, BorderBeam } from '@/components/landing/LandingShared';

export const LandingPricing = () => {
  const [pricePeriod, setPricePeriod] = useState<'m' | 'a'>('m');

  return (
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
            { name: 'Free',     price: { m: 0,     a: 0     }, desc: 'For individuals just getting started.',       features: ['50 searches/month','5 creator profiles/day','Basic Relevance score','Email support'],                                                                     cta: 'Start Free',     highlight: false },
            { name: 'Pro',      price: { m: 4999,  a: 3999  }, desc: 'For brands running active campaigns.',        features: ['Unlimited searches','Full creator profiles','Fraud detection reports','Campaign Kanban board','CSV export','Priority support'],                    cta: 'Start Pro',      highlight: true  },
            { name: 'Business', price: { m: 14999, a: 11999 }, desc: 'For agencies managing multiple brands.',      features: ['Everything in Pro','Multi-seat access (5 users)','API access','White-label reports','Dedicated account manager','Custom integrations'],           cta: 'Contact Sales',  highlight: false },
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
              <Link to="/auth" className={`block text-center py-3 rounded-full text-sm font-bold transition-all ${plan.highlight ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'border border-white/20 hover:border-white/40 text-white'}`}>{plan.cta}</Link>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionSpotlight>
  );
};
