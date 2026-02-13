import { motion, type Variants } from "framer-motion";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.08 } } };

/* Inline SVG icons — lightweight geometric line art */
function IconSearch() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
      <circle cx="11" cy="11" r="3" strokeDasharray="2 2" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
function IconKanban() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="18" rx="1" /><rect x="10" y="3" width="5" height="12" rx="1" /><rect x="17" y="3" width="5" height="15" rx="1" />
    </svg>
  );
}
function IconRocket() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="m7 16 4-8 4 4 5-9" />
    </svg>
  );
}

const FEATURES = [
  { Icon: IconSearch, title: "Live Influencer Search", desc: "Google‑powered discovery across Instagram, TikTok, and YouTube." },
  { Icon: IconShield, title: "Fraud Detection", desc: "AI fraud scoring identifies fake followers and inflated engagement." },
  { Icon: IconMail, title: "Email Extraction", desc: "Find contact emails with source badges for quick outreach." },
  { Icon: IconKanban, title: "Campaign Kanban", desc: "Drag‑and‑drop pipeline to manage influencer partnerships." },
  { Icon: IconRocket, title: "Outreach Automation", desc: "Email templates with variable substitution and open tracking." },
  { Icon: IconChart, title: "Analytics & ROI", desc: "Cross‑campaign dashboards with conversion and budget insights." },
];

export function Features() {
  return (
    <section className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="max-w-6xl mx-auto text-center space-y-16"
      >
        <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
          Everything You Need to <span className="aurora-text">Win</span>
        </motion.h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ Icon, title, desc }) => (
            <motion.div
              key={title}
              variants={fadeUp}
              className="glass-card-hover p-6 rounded-xl text-left space-y-3 will-change-transform"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg aurora-gradient text-primary">
                <Icon />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
