/**
 * BlogPage.tsx  —  MUSHIN  ·  Complete Rewrite
 *
 * Replaces the 36-line "Coming Soon" placeholder with old InfluenceIQ branding.
 *
 * Delivers:
 *  - Featured post hero section
 *  - Article grid with categories
 *  - Filter tabs (All / Guides / Strategy / Platform Updates)
 *  - Newsletter subscription CTA
 *  - "More coming soon" state for empty categories
 *  - Full MUSHIN dark design system
 *
 * Blog posts are static seed data — connect to your CMS/Supabase to make them dynamic.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEO } from "@/components/SEO";
import { ArrowLeft, ArrowRight, Clock, Tag, Rss } from 'lucide-react';
import { MushInIcon } from '@/components/ui/MushInLogo';

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Category = 'All' | 'Guides' | 'Strategy' | 'Updates';

interface Post {
  id: string;
  title: string;
  excerpt: string;
  category: Exclude<Category, 'All'>;
  readTime: number;
  date: string;
  featured?: boolean;
  tag?: string;
}

/* ─── Seed Data ──────────────────────────────────────────────────────────── */
const posts: Post[] = [
  {
    id: 'guide-fraud-detection',
    title: 'How to Spot Fake Followers in the Pakistani Creator Market',
    excerpt:
      'A practical breakdown of the engagement signals, growth patterns, and audience anomaly markers that reveal inflated Pakistani influencer accounts — before you spend a rupee.',
    category: 'Guides',
    readTime: 8,
    date: 'Mar 28, 2026',
    featured: true,
    tag: 'Fraud Detection',
  },
  {
    id: 'strategy-nano-influencers',
    title: 'Why Nano-Influencers Drive Higher ROAS in Pakistan',
    excerpt:
      "Data from 400+ Pakistani campaigns shows nano-creators (10K\u201350K followers) consistently outperform mega-influencers on cost-per-acquisition. Here\u2019s why.",
    category: 'Strategy',
    readTime: 6,
    date: 'Mar 14, 2026',
    tag: 'Campaign Strategy',
  },
  {
    id: 'guide-urdu-content',
    title: 'Urdu vs English Content: Which Performs Better on Pakistani TikTok?',
    excerpt:
      'We analysed 1,200 Pakistani TikTok accounts to understand how language choice affects reach, engagement, and audience demographics.',
    category: 'Guides',
    readTime: 5,
    date: 'Feb 27, 2026',
    tag: 'Content Strategy',
  },
  {
    id: 'update-v2-launch',
    title: 'MUSHIN v2: ROAS Engine, Kanban Board & City-Level Filters',
    excerpt:
      'Our biggest release yet. Introducing the ROAS Estimation Engine, a visual campaign Kanban board, city-level creator filters, and 3x faster search results.',
    category: 'Updates',
    readTime: 4,
    date: 'Feb 10, 2026',
    tag: 'Product Update',
  },
  {
    id: 'strategy-eid-campaigns',
    title: 'Running Influencer Campaigns During Eid: A Playbook',
    excerpt:
      "Eid is Pakistan\u2019s highest-spending period. This guide covers creator selection timing, content brief structure, and budget allocation for Eid campaigns.",
    category: 'Strategy',
    readTime: 7,
    date: 'Jan 22, 2026',
    tag: 'Seasonal Strategy',
  },
  {
    id: 'guide-instagram-metrics',
    title: 'The 7 Instagram Metrics That Actually Predict Campaign Success',
    excerpt:
      "Follower count is a vanity metric. Here are the seven signals in MUSHIN\u2019s scoring model that correlate with real audience action and brand lift.",
    category: 'Guides',
    readTime: 6,
    date: 'Jan 8, 2026',
    tag: 'Analytics',
  },
];

/* ─── Featured Post ───────────────────────────────────────────────────────── */
const FeaturedPost = ({ post }: { post: Post }) => (
  <article className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 hover:border-purple-500/20 hover:bg-white/[0.03] transition-all duration-200 cursor-pointer">
    <div className="flex flex-col md:flex-row gap-8 items-start">
      {/* Accent */}
      <div className="hidden md:flex w-1 self-stretch rounded-full bg-gradient-to-b from-purple-600 via-purple-500/50 to-transparent flex-shrink-0" />
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold uppercase tracking-wider">
            Featured
          </span>
          {post.tag && (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <Tag className="w-3 h-3" />
              {post.tag}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-zinc-500 ml-auto">
            <Clock className="w-3 h-3" />
            {post.readTime} min read
          </span>
        </div>
        <h2
          className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3 group-hover:text-purple-200 transition-colors leading-tight"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          {post.title}
        </h2>
        <p className="text-zinc-400 leading-relaxed mb-6 max-w-2xl">{post.excerpt}</p>
        <div className="flex items-center justify-between">
          <span className="text-zinc-600 text-xs">{post.date}</span>
          <span className="flex items-center gap-1.5 text-purple-400 text-sm font-bold group-hover:gap-3 transition-all">
            Read Article <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </div>
  </article>
);

/* ─── Post Card ───────────────────────────────────────────────────────────── */
const PostCard = ({ post }: { post: Post }) => (
  <article className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 flex flex-col hover:border-purple-500/20 hover:bg-white/[0.03] transition-all duration-200 cursor-pointer">
    <div className="flex items-center gap-2 mb-4">
      <span
        className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
        style={{
          background:
            post.category === 'Guides'
              ? 'rgba(168,85,247,0.1)'
              : post.category === 'Strategy'
              ? 'rgba(59,130,246,0.1)'
              : 'rgba(34,197,94,0.1)',
          color:
            post.category === 'Guides'
              ? '#c084fc'
              : post.category === 'Strategy'
              ? '#60a5fa'
              : '#4ade80',
          border: `1px solid ${
            post.category === 'Guides'
              ? 'rgba(168,85,247,0.2)'
              : post.category === 'Strategy'
              ? 'rgba(59,130,246,0.2)'
              : 'rgba(34,197,94,0.2)'
          }`,
        }}
      >
        {post.category}
      </span>
      {post.tag && (
        <span className="text-[10px] text-zinc-600 flex items-center gap-1">
          <Tag className="w-2.5 h-2.5" />
          {post.tag}
        </span>
      )}
    </div>
    <h3
      className="text-lg font-black tracking-tight text-white mb-3 group-hover:text-purple-200 transition-colors leading-snug flex-1"
      style={{ fontFamily: "'Syne', sans-serif" }}
    >
      {post.title}
    </h3>
    <p className="text-zinc-500 text-sm leading-relaxed mb-5 line-clamp-2">{post.excerpt}</p>
    <div className="flex items-center justify-between mt-auto">
      <span className="text-zinc-600 text-xs">{post.date}</span>
      <span className="flex items-center gap-1 text-zinc-500 text-xs">
        <Clock className="w-3 h-3" />
        {post.readTime} min
      </span>
    </div>
  </article>
);

/* ─── Category Tab ────────────────────────────────────────────────────────── */
const CategoryTab = ({
  label,
  active,
  onClick,
}: {
  label: Category;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-150 ${
      active
        ? 'bg-white text-black'
        : 'text-zinc-500 hover:text-white border border-white/[0.08] hover:border-white/20'
    }`}
  >
    {label}
  </button>
);

/* ─── Main ────────────────────────────────────────────────────────────────── */
export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('All');

  const categories: Category[] = ['All', 'Guides', 'Strategy', 'Updates'];

  const featuredPost = posts.find((p) => p.featured);
  const filteredPosts = posts
    .filter((p) => !p.featured)
    .filter((p) => activeCategory === 'All' || p.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#060608] text-white overflow-x-hidden">
      <SEO title="Blog" description="Latest insights on influencer marketing in Pakistan." />
      {/* Background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 35% at 50% 0%, rgba(88,28,135,0.07) 0%, transparent 65%)',
          zIndex: 0,
        }}
      />

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
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* ── PAGE HEADER ── */}
        <div className="py-16 border-b border-white/[0.06]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Rss className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400 text-xs font-bold uppercase tracking-widest">
                  MUSHIN Blog
                </span>
              </div>
              <h1
                className="text-4xl md:text-5xl font-black tracking-tighter leading-tight"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                Influencer Intelligence
                <br />
                <span style={{ color: 'rgba(168,85,247,0.9)' }}>for Pakistan.</span>
              </h1>
            </div>
            <p className="text-zinc-400 max-w-xs text-sm leading-relaxed">
              Strategy guides, platform updates, and data insights for Pakistani marketing teams.
            </p>
          </div>
        </div>

        {/* ── FEATURED ── */}
        {featuredPost && activeCategory === 'All' && (
          <div className="py-10">
            <FeaturedPost post={featuredPost} />
          </div>
        )}

        {/* ── CATEGORY FILTERS ── */}
        <div className="flex items-center gap-2 py-6 border-t border-white/[0.05] flex-wrap">
          {categories.map((cat) => (
            <CategoryTab
              key={cat}
              label={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
          <span className="ml-auto text-zinc-600 text-xs">
            {filteredPosts.length} article{filteredPosts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── ARTICLES GRID ── */}
        {filteredPosts.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 pb-16">
            {filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center mx-auto mb-5">
              <Rss className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-zinc-500 text-sm">More {activeCategory} articles coming soon.</p>
          </div>
        )}

        {/* ── NEWSLETTER CTA ── */}
        <div className="border-t border-white/[0.06] py-14 mb-6">
          <div className="rounded-2xl border border-purple-500/15 bg-purple-500/[0.04] p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-8">
            <div className="flex-1">
              <h2
                className="text-xl font-black tracking-tight text-white mb-2"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                Get new articles in your inbox
              </h2>
              <p className="text-zinc-400 text-sm">
                Strategy insights and platform updates, delivered weekly. No spam.
              </p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <input
                type="email"
                placeholder="you@company.com"
                className="flex-1 md:w-56 bg-white/[0.04] border border-white/[0.1] rounded-full px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/40 transition-colors"
              />
              <button className="flex-shrink-0 bg-purple-600 hover:bg-purple-500 transition-colors text-white text-sm font-bold px-6 py-2.5 rounded-full">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-white/[0.06] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-zinc-600 text-xs">&copy; 2026 Mushin. All rights reserved.</p>
          <div className="flex items-center gap-5 text-xs text-zinc-600">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
