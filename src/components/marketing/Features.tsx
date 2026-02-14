import { motion, type Variants } from "framer-motion";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.08 } } };

function IconSearch() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><circle cx="11" cy="11" r="3" strokeDasharray="2 2" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
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

const CAPABILITIES = [
  { Icon: IconShield, title: "Reduce fraud risk by 99%", desc: "AI-powered scoring analyzes engagement patterns and audience authenticity before you spend." },
  { Icon: IconSearch, title: "Find creators in seconds, not hours", desc: "Live Google-powered discovery across Instagram, TikTok, and YouTube — always fresh data." },
  { Icon: IconMail, title: "Extract verified emails instantly", desc: "Contact information with source badges so you can launch outreach immediately." },
  { Icon: IconKanban, title: "Manage every partnership visually", desc: "Drag-and-drop Kanban pipeline keeps every deal organized from first touch to signed contract." },
  { Icon: IconRocket, title: "Automate outreach at scale", desc: "Email templates with variable substitution, open tracking, and bulk sending built in." },
  { Icon: IconChart, title: "Prove ROI with real data", desc: "Cross-campaign dashboards with conversion tracking and budget insights for stakeholder reporting." },
];

export function Features() {
  return (
    <section id="features" className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div
        initial="hidden" whileInView="visible" viewport={{ once: true }}
        variants={stagger}
        className="max-w-6xl mx-auto text-center space-y-16"
      >
        <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
          Built for Teams That Take Influencer Marketing{" "}
          <span className="aurora-text">Seriously</span>
        </motion.h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CAPABILITIES.map(({ Icon, title, desc }) => (
            <motion.div key={title} variants={fadeUp}
              className="glass-card-hover p-6 rounded-xl text-left space-y-3 will-change-transform">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg aurora-gradient text-primary" style={{ boxShadow: "0 0 20px -5px hsl(var(--aurora-violet) / 0.3)" }}>
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
