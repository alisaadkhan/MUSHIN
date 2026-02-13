import { motion } from "framer-motion";
import { Search, Filter, Download, Users, Eye, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Influencer {
  id: string;
  username: string;
  platform: "instagram" | "tiktok" | "youtube";
  followers: string;
  engagement: string;
  location: string;
  email: string | null;
  avatar: string;
}

// ── Mock Data ──────────────────────────────────────────────────────────────────

const INFLUENCERS: Influencer[] = [
  { id: "1", username: "aisha.style", platform: "instagram", followers: "1.2M", engagement: "4.8%", location: "Dubai, UAE", email: "aisha@mgmt.co", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=aisha.style" },
  { id: "2", username: "techvault", platform: "youtube", followers: "890K", engagement: "6.1%", location: "London, UK", email: null, avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=techvault" },
  { id: "3", username: "fitfatima", platform: "tiktok", followers: "2.4M", engagement: "8.3%", location: "Karachi, PK", email: "fatima@influence.pk", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=fitfatima" },
  { id: "4", username: "wanderlust.sam", platform: "instagram", followers: "540K", engagement: "3.9%", location: "Toronto, CA", email: "sam@travel.co", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=wanderlust.sam" },
  { id: "5", username: "codewithzara", platform: "youtube", followers: "1.8M", engagement: "5.5%", location: "Berlin, DE", email: null, avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=codewithzara" },
  { id: "6", username: "glowbyrai", platform: "tiktok", followers: "3.1M", engagement: "9.2%", location: "Lagos, NG", email: "rai@beautymgmt.com", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=glowbyrai" },
  { id: "7", username: "nomad.omar", platform: "instagram", followers: "670K", engagement: "4.1%", location: "Istanbul, TR", email: null, avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=nomad.omar" },
  { id: "8", username: "buildinpublic", platform: "youtube", followers: "420K", engagement: "7.4%", location: "Austin, US", email: "hello@buildinpublic.dev", avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=buildinpublic" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────────

const PLATFORM_STYLES: Record<Influencer["platform"], string> = {
  instagram: "bg-pink-500/10 text-pink-400 border border-pink-500/20",
  tiktok: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
  youtube: "bg-red-500/10 text-red-400 border border-red-500/20",
};

const rowContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const rowItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function Index() {
  const [query, setQuery] = useState("");

  const filtered = query
    ? INFLUENCERS.filter(
        (i) =>
          i.username.toLowerCase().includes(query.toLowerCase()) ||
          i.location.toLowerCase().includes(query.toLowerCase())
      )
    : INFLUENCERS;

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
      >
        <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2 border-white/10">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button size="sm" className="btn-shine gap-2">
            <Download className="h-4 w-4" />
            Export All
          </Button>
        </div>
      </motion.div>

      {/* ── Hero Search Bar ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search influencers by name, niche, or location…"
            className="w-full h-14 pl-14 pr-20 rounded-xl bg-white/[0.03] backdrop-blur-md border border-white/5 text-foreground placeholder:text-muted-foreground shadow-inner transition-all duration-200 focus:outline-none focus:border-indigo-500/50 focus:shadow-[0_0_20px_rgba(99,102,241,0.15)]"
          />
          <kbd className="absolute right-5 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-muted-foreground font-mono">
            ⌘K
          </kbd>
        </div>
      </motion.div>

      {/* ── Data Grid ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-md overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-6 h-12 text-xs font-medium text-muted-foreground uppercase tracking-wider">Influencer</th>
                <th className="text-left px-4 h-12 text-xs font-medium text-muted-foreground uppercase tracking-wider">Platform</th>
                <th className="text-left px-4 h-12 text-xs font-medium text-muted-foreground uppercase tracking-wider">Audience</th>
                <th className="text-left px-4 h-12 text-xs font-medium text-muted-foreground uppercase tracking-wider">Engagement</th>
                <th className="text-left px-4 h-12 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-right px-6 h-12 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <motion.tbody variants={rowContainer} initial="hidden" animate="show">
              {filtered.map((inf) => (
                <motion.tr
                  key={inf.id}
                  variants={rowItem}
                  className="border-b border-white/[0.03] h-[72px] hover:bg-white/[0.02] transition-colors duration-150 will-change-[background-color]"
                >
                  {/* Influencer */}
                  <td className="px-6">
                    <div className="flex items-center gap-3">
                      <img
                        src={inf.avatar}
                        alt={inf.username}
                        className="h-10 w-10 rounded-full ring-1 ring-white/10 bg-white/5"
                        loading="lazy"
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">@{inf.username}</p>
                        <p className="text-xs text-muted-foreground truncate">{inf.location}</p>
                      </div>
                    </div>
                  </td>

                  {/* Platform */}
                  <td className="px-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${PLATFORM_STYLES[inf.platform]}`}>
                      {inf.platform}
                    </span>
                  </td>

                  {/* Audience */}
                  <td className="px-4">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-sm">{inf.followers}</span>
                    </div>
                  </td>

                  {/* Engagement */}
                  <td className="px-4">
                    <span className="font-mono text-sm text-emerald-400">{inf.engagement}</span>
                  </td>

                  {/* Status */}
                  <td className="px-4">
                    {inf.email ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Enriched
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Pending
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 text-right">
                    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
