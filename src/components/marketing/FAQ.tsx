import { motion, type Variants } from "framer-motion";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const FAQS = [
  {
    q: "Which Pakistani cities do you cover?",
    a: "InfluenceIQ indexes creators from all major Pakistani cities including Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta, Sialkot, Gujranwala, and more. You can filter search results by specific city or region.",
  },
  {
    q: "Can I search for Urdu content creators?",
    a: "Yes. Our search filters include a language selector where you can specifically look for creators who publish content in Urdu, English, or both. This makes it easy to find authentic Pakistani voices for your audience.",
  },
  {
    q: "How do I pay in PKR?",
    a: "We accept payments in Pakistani Rupees (PKR) via JazzCash, EasyPaisa, and all major debit/credit cards. No need to deal with USD or international payment complications.",
  },
  {
    q: "Which platforms do you support?",
    a: "InfluenceIQ supports influencer discovery across Instagram, TikTok, and YouTube — the three platforms with the highest Pakistani creator activity. Additional platforms may be added based on demand.",
  },
  {
    q: "How accurate is the fraud detection for Pakistani creators?",
    a: "Our AI fraud scoring achieves 94%+ accuracy and is specifically calibrated for Pakistani social media patterns — including detecting regionally bought followers, engagement pods common in PK, and bot activity targeting Pakistani audiences.",
  },
  {
    q: "Can I do WhatsApp outreach through the platform?",
    a: "Yes. InfluenceIQ has built-in WhatsApp outreach because most Pakistani creators prefer WhatsApp for business inquiries. You can send templated messages, track responses, and manage conversations directly in the app.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. The free tier gives you 50 creator searches and basic scoring with zero credit card or payment required. Upgrade to Pro when you're ready to unlock city filters, WhatsApp outreach, and PKR campaign tracking.",
  },
  {
    q: "Is my data stored in Pakistan?",
    a: "We offer Pakistan data residency for Business-tier customers. All plans benefit from encrypted data transit and GDPR-compliant storage practices regardless of residency option.",
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
        <div className="text-center space-y-3">
          <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-widest text-primary">FAQ</motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
            Frequently Asked Questions
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground text-sm">
            Everything you need to know about using InfluenceIQ in Pakistan.
          </motion.p>
        </div>

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
