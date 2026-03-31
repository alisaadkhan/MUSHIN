import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  MoreHorizontal, ExternalLink, Sparkles, Loader2, Plus, 
  ShieldCheck, MapPin, Instagram, Youtube 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/GlassCard';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuSeparator, DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { EvaluationScoreBadge } from '@/components/influencer/EvaluationScoreBadge';
import { getQualityTier } from '@/modules/search/ranking';
import { useMouseSpotlight } from '@/hooks/useMouseSpotlight';

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  username: string;
  platform: string;
  displayUrl?: string;
  extracted_followers?: number;
  imageUrl?: string;
  niche?: string;
  city?: string;
  city_extracted?: string;
  engagement_rate?: number;
  engagement_is_estimated?: boolean;
  bio?: string;
  full_name?: string;
  contact_email?: string | null;
  social_links?: string[];
  _search_score?: number;
  niche_confidence?: number;
  is_enriched?: boolean;
  enrichment_status?: string;
  is_stale?: boolean;
  last_enriched_at?: string | null;
  enrichment_ttl_days?: number;
  engagement_source?: "real_eval" | "real_enriched" | "benchmark_estimate";
  engagement_benchmark_bucket?: string;
  _intent?: string;
  tags?: string[];
}

interface ResultCardProps {
  c: SearchResult;
  isFreePlan: boolean;
  lists: Array<{ id: string; name: string }> | undefined;
  cachedScores: Record<string, number>;
  evaluatingUsername: string | null;
  evalLoading: boolean;
  canUseAI: () => boolean;
  selectedNiches: string[];
  navigate: ReturnType<typeof useNavigate>;
  evaluateInfluencer: (params: {
    username: string; platform: string;
    followers?: number; snippet?: string;
    title?: string; link?: string;
  }) => Promise<{ overall_score: number } | null>;
  setEvaluatingUsername: (v: string | null) => void;
  setCachedScores: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  handleAddToList: (listId: string, result: SearchResult) => Promise<void>;
  setPendingAddResult: (r: SearchResult | null) => void;
  setShowCreateList: (v: boolean) => void;
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

export function PlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p === "instagram") return <Instagram className="h-3.5 w-3.5 text-pink-500" />;
  if (p === "youtube") return <Youtube className="h-3.5 w-3.5 text-red-500" />;
  if (p === "twitch") return <span className="text-xs font-bold" style={{ color: "#9147ff" }}>TV</span>;
  return <span className="text-xs font-bold text-foreground">TT</span>;
}

export function ResultCard({ 
  c, isFreePlan, lists, cachedScores, evaluatingUsername, evalLoading, 
  canUseAI, selectedNiches, navigate, evaluateInfluencer, 
  setEvaluatingUsername, setCachedScores, handleAddToList, 
  setPendingAddResult, setShowCreateList 
}: ResultCardProps) {
  const { mouseX, mouseY, onMouseMove } = useMouseSpotlight();
  const displayName = c.full_name || c.title || c.username;
  const initials = displayName.split(" ").map((n: string) => n[0]).slice(0, 2).join("") || "?";
  const city = c.city_extracted || c.city;

  return (
    <GlassCard 
      data-testid="result-card"
      onMouseMove={onMouseMove}
      mouseX={mouseX}
      mouseY={mouseY}
      className={`p-5 transition-all duration-300 relative group/card h-full flex flex-col ${isFreePlan ? "blur-sm pointer-events-none select-none" : ""}`}
    >
      {c.is_enriched && (
        <div className="absolute -top-3 -right-2 z-10">
          <Badge className="bg-green-500/90 hover:bg-green-600 shadow-lg gap-1 px-2 py-0.5 border-none">
            <ShieldCheck className="h-3 w-3" /> <span className="text-[10px] font-black uppercase">Verified</span>
          </Badge>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div 
          className="flex items-center gap-3 cursor-pointer min-w-0"
          onClick={() => navigate(`/influencer/${c.platform.toLowerCase()}/${c.username.replace("@", "")}`, { state: { from: window.location.search } })}
        >
          <div className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-sm font-black text-white uppercase overflow-hidden flex-shrink-0 group-hover/card:border-purple-500/30 transition-colors">
            {c.imageUrl
              ? <img src={c.imageUrl} alt={displayName} className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              : <span>{initials}</span>
            }
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate group-hover/card:text-purple-400 transition-colors">{displayName}</p>
            <p className="text-[11px] text-white/30 truncate">@{c.username.replace("@", "")}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10">
              <MoreHorizontal size={14} className="text-white/40" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#0c0c14] border-white/10">
            <DropdownMenuItem asChild>
              <a href={c.link} target="_blank" rel="noopener noreferrer" className="cursor-pointer flex items-center text-xs">
                <ExternalLink className="h-3.5 w-3.5 mr-2" /> View Profile
              </a>
            </DropdownMenuItem>
            {canUseAI() && (
              <DropdownMenuItem
                className="text-xs"
                disabled={evalLoading && evaluatingUsername === c.username}
                onClick={async () => {
                  setEvaluatingUsername(c.username);
                  const result = await evaluateInfluencer({
                    username: c.username, platform: c.platform,
                    followers: c.extracted_followers, snippet: c.snippet,
                    title: c.title, link: c.link,
                  });
                  if (result) {
                    setCachedScores((prev: any) => ({ ...prev, [`${c.platform} - ${c.username}`]: result.overall_score }));
                  }
                  setEvaluatingUsername(null);
                }}
              >
                {evalLoading && evaluatingUsername === c.username
                  ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5 mr-2 text-purple-400" />}
                AI Evaluate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem className="text-[10px] font-black text-white/30 uppercase tracking-widest pointer-events-none">
              Add to List
            </DropdownMenuItem>
            {lists?.map((list: any) => (
              <DropdownMenuItem key={list.id} className="text-xs" onClick={() => handleAddToList(list.id, c)}>
                {list.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem className="text-xs text-purple-400" onClick={() => { setPendingAddResult(c); setShowCreateList(true); }}>
              <Plus className="h-3.5 w-3.5 mr-2" /> Create New List
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline" className="bg-white/[0.03] border-white/10 text-[10px] text-white/60 hover:bg-white/[0.06] transition-colors rounded-lg">
          <PlatformIcon platform={c.platform} /> <span className="ml-1">{c.platform}</span>
        </Badge>
        {c.niche && (
          <Badge className="bg-purple-500/10 hover:bg-purple-500/20 text-[10px] text-purple-400 border-purple-500/20 rounded-lg">
            {c.niche}
          </Badge>
        )}
        {city && (
          <Badge variant="outline" className="bg-white/[0.02] border-white/5 text-[10px] text-white/30 rounded-lg">
            <MapPin className="h-2.5 w-2.5 mr-1" />{city}
          </Badge>
        )}
      </div>

      {c.tags && c.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {c.tags.slice(0, 4).map(tag => (
            <span key={tag} className="text-[10px] text-white/20 hover:text-white/40 transition-colors">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {c.bio && (
        <p className="text-[12px] text-white/50 line-clamp-2 leading-relaxed mb-4 flex-1">
          {c.bio}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 py-4 mb-4 border-y border-white/[0.06]">
        <div className="text-center">
          <div className="text-[10px] text-white/30 uppercase tracking-widest font-black mb-1">Followers</div>
          <div className="text-sm font-black text-white">
            {c.extracted_followers ? formatFollowers(c.extracted_followers) : "—"}
          </div>
        </div>
        <div className="text-center border-x border-white/[0.06]">
          <div className="text-[10px] text-white/30 uppercase tracking-widest font-black mb-1">Engagement</div>
          <div className="text-sm font-black text-white">
            {c.engagement_rate != null ? `${c.engagement_rate.toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-white/30 uppercase tracking-widest font-black mb-1">Relevance</div>
          <div className="text-sm font-black text-purple-400">
            {c._search_score != null ? `${Math.round(c._search_score * 100)}%` : "—"}
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full rounded-xl text-[10px] font-black uppercase tracking-widest h-10 border-white/10 hover:border-purple-500/40 hover:text-purple-400 group/btn transition-all active:scale-95"
        onClick={() => navigate(`/influencer/${c.platform.toLowerCase()}/${c.username.replace("@", "")}`, { state: { from: window.location.search } })}
      >
        View Intelligence <ArrowRight className="ml-2 w-3.5 h-3.5 opacity-30 group-hover/btn:opacity-100 transition-opacity" />
      </Button>
    </GlassCard>
  );
}

const ArrowRight = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);
