/**
 * LegalPageLayout.tsx
 * Shared layout for all legal pages (Privacy, Terms, Cookie Policy).
 * Matches MUSHIN's dark design system: #060608 bg, purple accent, Syne font.
 * Replaces the old InfluenceIQ-branded stubs that used a mismatched design system.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { MushInLogo, MushInIcon } from '@/components/ui/MushInLogo';

/* ─── Types ──────────────────────────────────────────────────────────────── */
export interface LegalSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

interface Props {
  title: string;
  subtitle?: string;
  lastUpdated: string;
  sections: LegalSection[];
  badge?: string;
}

/* ─── Sidebar TOC ────────────────────────────────────────────────────────── */
const TableOfContents = ({ sections, activeId }: { sections: LegalSection[]; activeId: string }) => (
  <nav aria-label="Page sections" className="space-y-1 sticky top-28">
    <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-4 px-3">Contents</p>
    {sections.map((s) => (
      <a
        key={s.id}
        href={`#${s.id}`}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150 group ${
          activeId === s.id
            ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
            : 'text-zinc-500 hover:text-white/70 hover:bg-white/[0.03]'
        }`}
      >
        <ChevronRight
          className={`w-3 h-3 flex-shrink-0 transition-transform ${activeId === s.id ? 'text-purple-400 translate-x-0.5' : 'text-zinc-700 group-hover:text-zinc-500'}`}
        />
        {s.title}
      </a>
    ))}
  </nav>
);

/* ─── Main Layout ─────────────────────────────────────────────────────────── */
export default function LegalPageLayout({ title, subtitle, lastUpdated, sections, badge }: Props) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const ids = sections.map((s) => s.id);
    const elements = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    elements.forEach((el) => observerRef.current?.observe(el));
    return () => observerRef.current?.disconnect();
  }, [sections]);

  return (
    <div className="min-h-screen bg-[#060608] text-white overflow-x-hidden">
      {/* Subtle background gradient */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(88,28,135,0.07) 0%, transparent 70%)',
          zIndex: 0,
        }}
      />

      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#060608]/80 backdrop-blur-xl">
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
        </div>
      </header>

      {/* ── HERO HEADER ── */}
      <div className="relative z-10 border-b border-white/[0.06] py-16 px-6">
        <div className="max-w-6xl mx-auto">
          {badge && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/[0.06] text-purple-400 text-[10px] font-bold uppercase tracking-widest mb-5">
              {badge}
            </div>
          )}
          <h1
            className="text-4xl md:text-5xl font-black tracking-tighter mb-3 leading-tight"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-zinc-400 text-base max-w-xl leading-relaxed mb-4">{subtitle}</p>
          )}
          <p className="text-zinc-600 text-xs">Last updated: {lastUpdated}</p>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-14">
        <div className="flex gap-16">
          {/* Sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <TableOfContents sections={sections} activeId={activeId} />
          </aside>

          {/* Main */}
          <main className="flex-1 min-w-0">
            <div className="space-y-14">
              {sections.map((section) => (
                <article key={section.id} id={section.id} className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-px flex-1 bg-white/[0.06]" />
                    <h2
                      className="text-lg font-black tracking-tight text-white whitespace-nowrap"
                      style={{ fontFamily: "'Syne', sans-serif" }}
                    >
                      {section.title}
                    </h2>
                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>
                  <div className="text-zinc-400 text-sm leading-relaxed space-y-4">
                    {section.content}
                  </div>
                </article>
              ))}
            </div>

            {/* Contact CTA */}
            <div className="mt-16 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div>
                <p className="text-white font-bold mb-1">Questions about this policy?</p>
                <p className="text-zinc-500 text-sm">Our team responds within 24 hours.</p>
              </div>
              <a
                href="mailto:privacy@mushin.com"
                className="flex-shrink-0 bg-purple-600 hover:bg-purple-500 transition-colors text-white text-sm font-bold px-6 py-2.5 rounded-full"
              >
                Contact Us
              </a>
            </div>
          </main>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-white/[0.06] py-8 px-6 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-zinc-600 text-xs">&copy; 2026 Mushin. All rights reserved.</p>
          <div className="flex items-center gap-5 text-xs text-zinc-600">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link to="/cookies" className="hover:text-white transition-colors">Cookies</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
