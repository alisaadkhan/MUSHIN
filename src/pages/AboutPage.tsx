/**
 * AboutPage.tsx  —  MUSHIN  ·  Complete Rewrite
 *
 * Replaces the 184-line version that used a completely different design system:
 *  - Wrong color palette (zinc / gray, no purple)
 *  - Wrong nav ("Platform" generic label, wrong button styles)
 *  - Generic hero copy unrelated to MUSHIN
 *  - No connection to MUSHIN's brand voice
 *
 * This rewrite:
 *  - Matches LandingPage's dark system (#060608, purple, Syne)
 *  - Tells MUSHIN's actual story: Karachi-built, Pakistan-focused
 *  - Values, team philosophy, and roadmap sections
 *  - Proper mission statement and CTA
 *  - No external deps beyond MushInLogo and lucide-react
 */

import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { SEO } from "@/components/SEO";
import { ArrowLeft, ArrowRight, MapPin, Shield, Zap, Users, Globe, Heart } from 'lucide-react';
import { MushInIcon, MushInLogo } from '@/components/ui/MushInLogo';

/* ─── Subtle Grain ───────────────────────────────────────────────────────── */
const Grain = () => (
  <svg
    className="pointer-events-none fixed inset-0 w-full h-full"
    style={{ zIndex: 1, opacity: 0.035 }}
  >
    <filter id="about-grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#about-grain)" />
  </svg>
);

/* ─── Stat Card ──────────────────────────────────────────────────────────── */
const StatCard = ({ value, label }: { value: string; label: string }) => (
  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-center">
    <div
      className="text-4xl font-black text-white mb-1 tracking-tight"
      style={{ fontFamily: "'Syne', sans-serif" }}
    >
      {value}
    </div>
    <div className="text-zinc-500 text-xs">{label}</div>
  </div>
);

/* ─── Value Card ─────────────────────────────────────────────────────────── */
const ValueCard = ({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 hover:border-purple-500/20 hover:bg-white/[0.04] transition-all duration-200">
    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-4 group-hover:border-purple-500/25 transition-colors">
      {icon}
    </div>
    <h3 className="font-bold text-white mb-2 text-sm">{title}</h3>
    <p className="text-zinc-500 text-xs leading-relaxed">{desc}</p>
  </div>
);

/* ─── Timeline Item ──────────────────────────────────────────────────────── */
const TimelineItem = ({
  year,
  title,
  desc,
  last,
}: {
  year: string;
  title: string;
  desc: string;
  last?: boolean;
}) => (
  <div className="flex gap-5">
    <div className="flex flex-col items-center">
      <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-purple-500/40 flex-shrink-0 mt-1" />
      {!last && <div className="w-px flex-1 bg-white/[0.07] mt-2" />}
    </div>
    <div className={`pb-${last ? '0' : '10'}`}>
      <span className="text-purple-400 text-[10px] font-bold uppercase tracking-widest mb-1 block">
        {year}
      </span>
      <h4 className="text-white font-bold text-sm mb-1">{title}</h4>
      <p className="text-zinc-500 text-xs leading-relaxed">{desc}</p>
    </div>
  </div>
);

/* ─── Main ────────────────────────────────────────────────────────────────── */
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#060608] text-white overflow-x-hidden">
      <SEO title="About MUSHIN" description="Learn about MUSHIN, Pakistan's Creator Intelligence Platform." />
      <Grain />

      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: 0 }}>
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(ellipse, rgba(88,28,135,0.08) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* ── NAV ── */}
      <header className="relative z-10 sticky top-0 border-b border-white/[0.06] bg-[#060608]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center gap-4 h-14 px-6">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <Link to="/" className="flex items-center gap-2 ml-auto" aria-label="MUSHIN Home">
            <MushInIcon size={24} />
            <span
              className="text-sm font-bold tracking-[0.15em] text-white"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              MUSHIN
            </span>
          </Link>
          <Link
            to="/auth"
            className="bg-purple-600 hover:bg-purple-500 transition-colors text-white text-xs font-bold px-5 py-2 rounded-full ml-2"
          >
            Start Free
          </Link>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative z-10 border-b border-white/[0.06] py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <MapPin className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-purple-400 text-xs font-bold uppercase tracking-widest">
              Karachi, Pakistan
            </span>
          </div>
          <h1
            className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] mb-8"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            We're building the
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #a855f7 0%, #c084fc 50%, #7c3aed 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              intelligence layer
            </span>
            <br />
            for Pakistan's creator economy.
          </h1>
          <p className="text-zinc-400 text-xl leading-relaxed max-w-2xl">
            MUSHIN was born out of frustration. After watching brands burn marketing budgets on
            fake-follower influencers and guesswork campaigns, we built the data infrastructure
            Pakistan's market never had.
          </p>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="relative z-10 border-b border-white/[0.06] py-14 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard value="2023" label="Founded in Karachi" />
            <StatCard value="10K+" label="Creators indexed" />
            <StatCard value="12+" label="Cities covered" />
            <StatCard value="24h" label="Data refresh cycle" />
          </div>
        </div>
      </section>

      {/* ── MISSION ── */}
      <section className="relative z-10 border-b border-white/[0.06] py-20 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="text-purple-400 text-[10px] font-bold uppercase tracking-widest mb-4">
              Our Mission
            </div>
            <div className="h-px bg-white/[0.06] mb-6" />
            <h2
              className="text-3xl md:text-4xl font-black tracking-tighter mb-6 leading-tight"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Remove guesswork from influencer marketing in Pakistan.
            </h2>
            <p className="text-zinc-400 leading-relaxed mb-4">
              Global tools treat Pakistan as an afterthought. They miss city-level nuance, Urdu
              language signals, and the specific engagement patterns of Pakistani audiences on
              Instagram, TikTok, and YouTube.
            </p>
            <p className="text-zinc-500 text-sm leading-relaxed">
              We built MUSHIN from the ground up for this market — calibrated on Pakistani
              creator behaviour, validated against Pakistani campaign data, and continuously
              improved by a team embedded in Karachi's marketing ecosystem.
            </p>
          </div>
          <div className="space-y-4">
            {[
              {
                q: 'Why Pakistan-first?',
                a: "Because no one else was doing it right. Pakistani creators and brands deserve tools built for their reality, not adapted from tools built for US or UK markets.",
              },
              {
                q: 'What does MUSHIN mean?',
                a: "Mushin (無心) is a Japanese concept — 'mind without mind' — a state of pure, uncluttered clarity. We bring that clarity to influencer decisions.",
              },
              {
                q: 'Where are you based?',
                a: 'Karachi. Our team is entirely Pakistan-based, which means we understand the local creator landscape intuitively — not through an algorithm trained on overseas data.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                <p className="text-white font-bold text-sm mb-2">{q}</p>
                <p className="text-zinc-500 text-xs leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VALUES ── */}
      <section className="relative z-10 border-b border-white/[0.06] py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <div className="text-purple-400 text-[10px] font-bold uppercase tracking-widest mb-4">
              What We Stand For
            </div>
            <div className="h-px bg-white/[0.06] mb-6" />
            <h2
              className="text-3xl font-black tracking-tighter"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Our Values
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <ValueCard
              icon={<Shield className="w-5 h-5 text-green-400" />}
              title="Data Integrity"
              desc="We never fabricate metrics. If we're uncertain about a data point, we say so. Every score has a methodology, and every methodology is documented."
            />
            <ValueCard
              icon={<Zap className="w-5 h-5 text-yellow-400" />}
              title="Speed Over Perfection"
              desc="The Pakistani market moves fast. We ship fast, iterate fast, and fix fast. A good decision made now beats a perfect decision made next month."
            />
            <ValueCard
              icon={<Users className="w-5 h-5 text-blue-400" />}
              title="User Obsession"
              desc="We talk to marketers every week. Every feature we build starts with a real problem observed in a real Pakistani campaign."
            />
            <ValueCard
              icon={<Globe className="w-5 h-5 text-purple-400" />}
              title="Local First"
              desc="We index Pakistani creators, not global databases. We understand Urdu content, Eid campaign dynamics, and regional audience behaviour."
            />
            <ValueCard
              icon={<Heart className="w-5 h-5 text-pink-400" />}
              title="Creator Respect"
              desc="Creators are people, not inventory. We display their data responsibly and give creators the ability to review and correct their profiles."
            />
            <ValueCard
              icon={<Shield className="w-5 h-5 text-cyan-400" />}
              title="Radical Transparency"
              desc="Our pricing is public. Our data sources are documented. Our fraud detection methodology is explained. No black boxes."
            />
          </div>
        </div>
      </section>

      {/* ── TIMELINE ── */}
      <section className="relative z-10 border-b border-white/[0.06] py-20 px-6">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-16">
          <div>
            <div className="text-purple-400 text-[10px] font-bold uppercase tracking-widest mb-4">
              Our Journey
            </div>
            <div className="h-px bg-white/[0.06] mb-8" />
            <div className="space-y-0">
              <TimelineItem
                year="Q3 2023"
                title="Founded in Karachi"
                desc="Started as an internal tool for a digital agency — a spreadsheet on steroids for finding Pakistani Instagram creators."
              />
              <TimelineItem
                year="Q1 2024"
                title="First 1,000 creators indexed"
                desc="Built the crawler infrastructure to index Instagram, TikTok, and YouTube creator profiles across 5 Pakistani cities."
              />
              <TimelineItem
                year="Q3 2024"
                title="AI fraud detection launched"
                desc="Released the first version of our fake-follower detection model, trained on Pakistani creator behaviour data."
              />
              <TimelineItem
                year="Q1 2025"
                title="Public beta"
                desc="Opened the platform to 200 beta brands and agencies. Collected feedback across 400+ campaigns."
              />
              <TimelineItem
                year="Q1 2026"
                title="MUSHIN v2"
                desc="Launched ROAS Engine, Kanban board, city-level filters, and Business plan with multi-seat access."
                last
              />
            </div>
          </div>

          {/* What's Next */}
          <div>
            <div className="text-purple-400 text-[10px] font-bold uppercase tracking-widest mb-4">
              What's Next
            </div>
            <div className="h-px bg-white/[0.06] mb-8" />
            <div className="space-y-4">
              {[
                {
                  title: 'YouTube Shorts Intelligence',
                  desc: 'Dedicated analytics for Pakistani YouTube Shorts creators — a fast-growing and underanalysed segment.',
                  status: 'In Development',
                  color: '#a855f7',
                },
                {
                  title: 'Creator Outreach Automation',
                  desc: 'Templated outreach sequences with open-rate tracking, directly from the MUSHIN dashboard.',
                  status: 'Q2 2026',
                  color: '#60a5fa',
                },
                {
                  title: 'Brand Safety Scoring',
                  desc: 'Flag creators with past controversy, brand conflicts, or audience sentiment shifts before you sign.',
                  status: 'Planned',
                  color: '#4ade80',
                },
              ].map(({ title, desc, status, color }) => (
                <div
                  key={title}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="text-white font-bold text-sm">{title}</h4>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ color, background: color + '15', border: `1px solid ${color}30` }}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <MushInLogo height={40} />
          </div>
          <h2
            className="text-4xl md:text-5xl font-black tracking-tighter mb-5 leading-tight"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Ready to bring clarity
            <br />
            to your campaigns?
          </h2>
          <p className="text-zinc-400 mb-8">
            Join the Pakistani marketing teams already using MUSHIN to make smarter influencer
            decisions.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 transition-colors text-white font-bold px-8 py-3.5 rounded-full text-sm"
            >
              Start for Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 border border-white/10 hover:border-white/25 text-zinc-300 hover:text-white transition-all font-medium px-8 py-3.5 rounded-full text-sm"
            >
              See the Product
            </Link>
          </div>
          <p className="text-zinc-600 text-xs mt-5">
            Free plan forever. No credit card required.
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-zinc-600 text-xs">&copy; 2026 Mushin. Made in Pakistan 🇵🇰</p>
          <div className="flex items-center gap-5 text-xs text-zinc-600">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link to="/blog" className="hover:text-white transition-colors">Blog</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
