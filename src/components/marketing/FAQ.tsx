import { motion, type Variants } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const FAQS = [
  {
    q: "How is InfluenceIQ different from legacy tools like CreatorIQ?",
    a: "Unlike legacy platforms that rely on stale, monthly-updated databases, InfluenceIQ uses live Google-powered discovery to surface real-time influencer data. Plus, our pay-as-you-go pricing means you never get locked into an annual contract.",
  },
  {
    q: "How accurate is the fraud detection?",
    a: "Our AI-powered fraud scoring achieves 99% accuracy by analyzing engagement patterns, follower growth velocity, and audience authenticity signals — catching fake followers before you spend a dollar.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. The free tier includes 50 search credits and 10 enrichment credits with no credit card required. Upgrade when you're ready.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Absolutely. There are no contracts or commitments. You can downgrade or cancel your plan instantly from your account settings.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. We're GDPR-compliant with SOC2-ready infrastructure, all payments processed through Stripe, and full transparency into how your data is stored and used.",
  },
  {
    q: "What platforms do you support?",
    a: "InfluenceIQ currently supports influencer discovery across Instagram, TikTok, and YouTube, with additional platforms on the roadmap.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        className="max-w-3xl mx-auto space-y-12"
      >
        <motion.h2 variants={fadeUp}
          className="text-3xl md:text-4xl font-bold tracking-tight text-center">
          Common Questions
        </motion.h2>

        <motion.div variants={fadeUp}>
          <Accordion type="single" collapsible className="space-y-3">
            {FAQS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}
                className="glass-card rounded-xl px-6 border-none">
                <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline py-5">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-5 leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </motion.div>
    </section>
  );
}
