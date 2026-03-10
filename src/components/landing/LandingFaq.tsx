import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

interface FaqItem { q: string; a: string }

export default function LandingFaq({ faqs }: { faqs: FaqItem[] }) {
  return (
    <Accordion type="single" collapsible className="space-y-2">
      {faqs.map((faq, i) => (
        <AccordionItem key={i} value={`faq-${i}`} className="border border-white/10 rounded-xl overflow-hidden">
          <AccordionTrigger className="px-5 py-4 text-sm font-semibold text-white/80 hover:text-white text-left hover:no-underline">{faq.q}</AccordionTrigger>
          <AccordionContent className="px-5 pb-4 text-sm text-zinc-400 leading-relaxed">{faq.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
