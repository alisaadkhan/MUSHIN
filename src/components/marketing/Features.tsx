import { motion, type Variants } from "framer-motion";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};
const stagger: Variants = { visible: { transition: { staggerChildren: 0.08 } } };

const features = [
  {
    title: "Live Influencer Search",
    desc: "Google‑powered discovery across Instagram, TikTok, and YouTube — always real‑time.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" /><path d="M18 18l6 6" /><circle cx="12" cy="12" r="4" opacity="0.4" />
      </svg>
    ),
  },
  {
    title: "Fraud Detection",
    desc: "AI fraud scoring identifies fake followers and inflated engagement instantly.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3L3 8v6c0 6.5 4.7 12.6 11 14 6.3-1.4 11-7.5 11-14V8L14 3z" /><path d="M10 14l3 3 5-6" />
      </svg>
    ),
  },
  {
    title: "Email Extraction",
    desc: "Find contact emails from bios and snippets with verified source badges.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="22" height="16" rx="2" /><path d="M3 8l11 7 11-7" /><circle cx="21" cy="18" r="3" opacity="0.5" />
      </svg>
    ),
  },
  {
    title: "Campaign Management",
    desc: "Drag‑and‑drop Kanban pipeline to manage every influencer partnership.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="6" height="20" rx="1" /><rect x="11" y="4" width="6" height="14" rx="1" /><rect x="19" y="4" width="6" height="18" rx="1" />
      </svg>
    ),
  },
  {
    title: "Outreach Automation",
    desc: "Email templates with variable substitution, open tracking, and bulk sending.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 2L11 13" /><path d="M22 2l-7 22-4-9-9-4 22-7z" />
      </svg>
    ),
  },
  {
    title: "Analytics & ROI",
    desc: "Cross‑campaign dashboards with conversion tracking and budget insights.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 25V15l6-4 6 6 10-12" /><circle cx="25" cy="5" r="2" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section className="relative py-24 px-6 md:px-12 lg:px-24">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="max-w-6xl mx-auto text-center space-y-16">
        <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold tracking-tight">
          Everything You Need to <span className="aurora-text">Win</span>
        </motion.h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <motion.div key={f.title} variants={fadeUp} className="glass-card-hover p-6 rounded-xl text-left space-y-3 will-change-transform">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg aurora-gradient text-primary">
                {f.icon}
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
