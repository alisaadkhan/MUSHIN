import { motion } from 'framer-motion';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { SectionSpotlight, RevealLine, RevealText } from '@/components/landing/LandingShared';

const faqs = [
  { q: "Is the data for Pakistan accurate?", a: "Yes. Unlike global tools that use generic scrapers, Mushin is calibrated specifically for the Pakistani creator landscape using local engagement benchmarks and audience growth patterns." },
  { q: "How do you detect fake followers?", a: "Our AI model analyzes 25+ trust signals including engagement velocity, follower-to-like ratios, and common bot-pattern comments in local dialects (Urdu/Roman Urdu)." },
  { q: "Can I cancel my subscription any time?", a: "Absolutely. We offer month-to-month billing with no long-term contracts. You can cancel with one click from your dashboard settings." },
  { q: "Do you offer custom agency plans?", a: "Yes. For agencies managing 10+ brands, we offer white-label reporting, higher API limits, and dedicated account management. Contact our sales team for a custom quote." }
];

export const LandingFAQ = () => {
  return (
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
  );
};
