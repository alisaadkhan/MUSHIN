import React from "react";
import { ExternalLink, Loader2, MoreHorizontal, MapPin, Instagram, Youtube, ShieldCheck, Plus, Sparkles } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EvaluationScoreBadge } from "@/components/influencer/EvaluationScoreBadge";
import { getQualityTier } from "@/modules/search/ranking";
import type { useNavigate } from "react-router-dom";

export interface SearchResult {
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

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p === "instagram") return <Instagram className="h-3.5 w-3.5 text-pink-500" />;
  if (p === "youtube") return <Youtube className="h-3.5 w-3.5 text-red-500" />;
  if (p === "twitch") return <span className="text-xs font-bold" style={{ color: "#9147ff" }}>TV</span>;
  return <span className="text-xs font-bold text-foreground">TT</span>;
}

export const ResultCard = React.memo(function ResultCard({
  c, isFreePlan, lists, cachedScores, evaluatingUsername, evalLoading,
  canUseAI, navigate, evaluateInfluencer, setEvaluatingUsername,
  setCachedScores, handleAddToList, setPendingAddResult, setShowCreateList,
}: ResultCardProps) {
  const displayName = c.full_name || c.title || c.username;
  const initials = displayName.split(" ").map((n: string) => n[0]).slice(0, 2).join("") || "?";
  const city = c.city_extracted || c.city;
  const scoreKey = `${c.platform} - ${c.username}`;
  const cachedScore = cachedScores[scoreKey];

  return (
    <div
      data-testid="result-card"
      data-username={c.username}
      data-platform={c.platform}
      className={`bg-background border border-border rounded-2xl p-5 transition-all duration-200 relative ${isFreePlan ? "opacity-50 pointer-events-none select-none" : ""}`}
    >
      {c.is_enriched && (
        <div className="absolute -top-3 -right-2 pointer-events-none">
          <Badge className="bg-green-500 hover:bg-green-600 shadow-sm gap-1 px-2 py-0.5 pointer-events-none">
            <ShieldCheck className="h-3 w-3" /> Verified
          </Badge>
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate(`/influencer/${c.platform.toLowerCase()}/${c.username.replace("@", "")}`, { state: { from: window.location.search } })}>

          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase overflow-hidden flex-shrink-0 shadow-[0_0_0_2px_hsl(var(--primary)/0.1)]">
            {c.imageUrl
              ? <img src={c.imageUrl} alt={displayName} className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              : <span>{initials}</span>
            }
          </div>
          <div className="overflow-hidden min-w-0 max-w-[200px]">
            <p className="text-sm font-medium text-foreground truncate" title={displayName}>{displayName}</p>
            <p className="text-xs text-muted-foreground truncate" title={c.username.replace("@", "")}>@{c.username.replace("@", "")}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
              <MoreHorizontal size={14} strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href={c.link} target="_blank" rel="noopener noreferrer" className="cursor-pointer flex items-center">
                <ExternalLink className="h-4 w-4 mr-2" /> View Profile
              </a>
            </DropdownMenuItem>
            {canUseAI() && (
              <DropdownMenuItem
                disabled={evalLoading && evaluatingUsername === c.username}
                onClick={async () => {
                  setEvaluatingUsername(c.username);
                  const result = await evaluateInfluencer({
                    username: c.username, platform: c.platform,
                    followers: c.extracted_followers, snippet: c.snippet,
                    title: c.title, link: c.link,
                  });
                  if (result) {
                    setCachedScores((prev: any) => ({ ...prev, [scoreKey]: result.overall_score }));
                  }
                  setEvaluatingUsername(null);
                }}
              >
                {evalLoading && evaluatingUsername === c.username
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Sparkles className="h-4 w-4 mr-2 text-primary" />}
                AI Evaluate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs font-medium text-muted-foreground uppercase tracking-wider" disabled>
              Add to List
            </DropdownMenuItem>
            {lists?.map((list: any) => (
              <DropdownMenuItem key={list.id} onClick={() => handleAddToList(list.id, c)}>
                {list.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => { setPendingAddResult(c); setShowCreateList(true); }}>
              <Plus className="h-4 w-4 mr-2 text-primary" />
              <span className="text-primary">Create New List</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span data-testid="card-platform" className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 flex items-center gap-1">
          <PlatformIcon platform={c.platform} /> {c.platform}
        </span>
        {c.niche && (
          <span
            data-testid="card-niche"
            className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium"
            style={{ opacity: c.niche_confidence != null ? Math.max(0.5, c.niche_confidence) : 1 }}
            title={c.niche_confidence != null ? `Niche confidence: ${Math.round(c.niche_confidence * 100)}%` : undefined}
          >
            {c.niche}
          </span>
        )}
        {city && (
          <span data-testid="card-city" className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" />{city}
          </span>
        )}
        {(() => {
          const qt = getQualityTier(c._search_score);
          return qt ? (
            <span
              data-testid="card-quality-tier"
              className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border ${qt.colorClass}`}
              title={`Relevance tier based on multi-factor ranking score (${c._search_score != null ? Math.round(c._search_score * 100) : "?"}%)`}
            >
              {qt.label}
            </span>
          ) : null;
        })()}
        {c.contact_email && (
          <span
            data-testid="card-verified-contact"
            className="text-[10px] font-semibold rounded-full px-2 py-0.5 border bg-violet-500/10 text-violet-400 border-violet-500/20"
            title="Verified contact email found in profile"
          >
            ✉ Contact
          </span>
        )}
      </div>

      {c.tags && c.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {c.tags.slice(0, 5).map(tag => (
            <span key={tag} className="text-[10px] bg-muted/80 text-muted-foreground rounded px-1.5 py-0.5 font-mono">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {c.bio && (
        <div className="mb-3 text-xs text-muted-foreground/80 line-clamp-2">
          {c.bio}
        </div>
      )}

      {c.contact_email && (
        <div className="mb-3">
          <a
            href={`mailto:${c.contact_email}`}
            className="text-xs text-primary/80 hover:text-primary truncate flex items-center gap-1 max-w-full"
            title={c.contact_email}
            onClick={e => e.stopPropagation()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0">
              <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
              <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
            </svg>
            <span className="truncate">{c.contact_email}</span>
          </a>
        </div>
      )}

      {c.social_links && c.social_links.length > 0 ? (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          {c.social_links.map((url) => {
            const isIG = url.includes("instagram.com");
            const isYT = url.includes("youtube.com");
            const isTT = url.includes("tiktok.com");
            const isTW = url.includes("x.com") || url.includes("twitter.com");
            const isFB = url.includes("facebook.com") || url.includes("fb.com");
            const label = isIG ? "Instagram" : isYT ? "YouTube" : isTT ? "TikTok" : isTW ? "X" : isFB ? "Facebook" : "Social";
            return (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 border border-border/60 rounded-full px-2 py-0.5 hover:border-primary/40 transition-colors"
              >
                {isIG && <Instagram className="h-2.5 w-2.5 text-pink-500 mr-0.5" />}
                {isYT && <Youtube className="h-2.5 w-2.5 text-red-500 mr-0.5" />}
                {isTT && <span className="text-[8px] font-bold mr-0.5">TT</span>}
                {isTW && <span className="text-[8px] font-bold mr-0.5">X</span>}
                {isFB && <span className="text-[8px] font-bold mr-0.5">FB</span>}
                {label}
              </a>
            );
          })}
        </div>
      ) : c.is_enriched && !c.contact_email ? (
        <p className="mb-3 text-[10px] text-muted-foreground/50 italic">Contact information unavailable</p>
      ) : null}

      <div className="grid grid-cols-3 gap-2 text-center mt-4 border-t border-border/50 pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Followers</p>
          <p data-testid="card-followers" className="text-sm font-semibold text-foreground data-mono">
            {c.extracted_followers ? formatFollowers(c.extracted_followers) : "—"}
          </p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1">
            <p className="text-xs text-muted-foreground">Engagement</p>
          </div>
          <p data-testid="card-engagement" className="text-sm font-semibold text-foreground data-mono">
            {c.engagement_rate != null ? `${c.engagement_rate.toFixed(1)}%` : "—"}
          </p>
          <div className="flex justify-center mt-1">
            {c.is_enriched && (
              <span
                title={c.is_stale
                  ? `Real data from enrichment but over ${c.enrichment_ttl_days ?? 30} days old. Re-enrich for fresh data.`
                  : `Verified real engagement rate from ${c.last_enriched_at ? new Date(c.last_enriched_at).toLocaleDateString() : "recent"} enrichment`
                }
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded cursor-help ${
                  c.is_stale
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {c.is_stale ? "STALE" : "REAL"}
              </span>
            )}
            {!c.is_enriched && c.engagement_source === "benchmark_estimate" && (
              <span
                title={`Industry benchmark for ${c.engagement_benchmark_bucket ?? "this"}-tier ${c.platform} accounts. Enrich for real data.`}
                className="text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded cursor-help"
              >
                BENCHMARK
              </span>
            )}
            {!c.is_enriched && c.engagement_source !== "benchmark_estimate" && (
              <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">
                EST
              </span>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Relevance</p>
          {c._search_score != null ? (
            <div className="mt-1">
              <p
                className="text-sm font-semibold text-foreground data-mono cursor-help"
                title={`Score: ${Math.round(c._search_score * 100)}%\nSignals: keyword match, snippet relevance, engagement, authenticity, recency${c._intent ? `, intent (${c._intent.replace("_", " ")})` : ""}`}
              >
                {Math.round(c._search_score * 100)}%
              </p>
              <div className="h-1 bg-muted/50 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    c._search_score >= 0.65
                      ? "bg-emerald-500"
                      : c._search_score >= 0.35
                      ? "bg-amber-400"
                      : "bg-muted-foreground/40"
                  }`}
                  style={{ width: `${Math.round(c._search_score * 100)}%` }}
                />
              </div>
              {cachedScore != null && (
                <div className="flex justify-center mt-1.5">
                  <EvaluationScoreBadge score={cachedScore} size="sm" />
                </div>
              )}
            </div>
          ) : cachedScore != null ? (
            <div className="flex justify-center mt-1">
              <EvaluationScoreBadge score={cachedScore} size="sm" />
            </div>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground/40 mt-1">&mdash;</p>
          )}
        </div>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="w-full mt-4 rounded-xl text-xs gap-1.5 border-border hover:border-primary/50 hover:text-primary"
        onClick={() => navigate(`/influencer/${c.platform.toLowerCase()}/${c.username.replace("@", "")}`, { state: { from: window.location.search } })}
      >
        <ExternalLink className="h-3 w-3" /> View Profile
      </Button>
    </div>
  );
});
