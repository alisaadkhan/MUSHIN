import { useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronLeft, ExternalLink, Heart, Share2, Instagram, Youtube,
  SlidersHorizontal, Loader2, RefreshCw, Users, Lightbulb,
  MapPin, Calendar, Plus, Globe, Sparkles, BarChart3, ShieldCheck, ShieldAlert, ShieldX, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useInfluencerLists } from "@/hooks/useInfluencerLists";
import { useInfluencerEvaluation, type InfluencerEvaluation } from "@/hooks/useInfluencerEvaluation";
import { useInfluencerProfile } from "@/hooks/useInfluencerProfile";
import { EvaluationScoreBadge } from "@/components/influencer/EvaluationScoreBadge";
import { EngagementPanel } from "@/components/influencer/EngagementPanel";
import { AuthenticityPanel } from "@/components/influencer/AuthenticityPanel";
import { BrandSafetyPanel } from "@/components/influencer/BrandSafetyPanel";
import { CompliancePanel } from "@/components/payments/CompliancePanel";
import { NicheTagsDisplay } from "@/components/influencer/NicheTagsDisplay";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useToast } from "@/hooks/use-toast";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { GrowthAnalyticsPanel } from "@/components/influencer/GrowthAnalyticsPanel";
import { BrandAffinityPanel, type BrandMention } from "@/components/influencer/BrandAffinityPanel";
import { SponsoredVsOrganicPanel } from "@/components/influencer/SponsoredVsOrganicPanel";
import { PredictiveGrowthPanel } from "@/components/influencer/PredictiveGrowthPanel";
import { CampaignResponsePanel } from "@/components/influencer/CampaignResponsePanel";
import { AudienceStabilityPanel } from "@/components/influencer/AudienceStabilityPanel";
import { BrandFitMeterPanel } from "@/components/influencer/BrandFitMeterPanel";
import { useState, useEffect } from "react";

// ── Python Analytics types ────────────────────────────────────────────────────
interface BotDetectionResult {
  data_available: boolean;
  bot_probability?: number | null;
  risk_level?: string | null;
  signals_triggered?: string[];
  confidence?: string | null;
}
interface EngagementAnomalyResult {
  data_available: boolean;
  anomaly_score?: number | null;
  anomalies_detected?: string[];
  explanation?: string | null;
}
interface PythonAnalyticsData {
  available: boolean;
  reason?: string;
  bot_detection: BotDetectionResult;
  engagement_anomaly: EngagementAnomalyResult;
  cached?: boolean;
  analyzed_at?: string;
}

// ── SimilarCreatorsSection ────────────────────────────────────────────────────
function SimilarCreatorsSection({ profileId, currentPlatform }: { profileId: string; currentPlatform: string }) {
  const [similar, setSimilar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.functions
      .invoke("find-lookalikes", {
        body: { target_profile_id: profileId, limit: 12, same_platform_only: false },
      })
      .then(({ data }) => {
        if (!cancelled && data?.results) setSimilar(data.results);
      })
      .catch(console.warn)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profileId]);

  if (!loading && similar.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Similar Creators You May Like</h3>
        </div>
        {loading ? (
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-36 space-y-2">
                <Skeleton className="h-10 w-10 rounded-full mx-auto" />
                <Skeleton className="h-3 w-24 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {similar.map((c: any) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/influencer/${c.platform}/${c.username.replace("@", "")}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/influencer/${c.platform}/${c.username.replace("@", "")}`)}
                className="flex-shrink-0 w-36 cursor-pointer hover:bg-muted/50 rounded-xl p-3 transition-colors text-center"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase overflow-hidden mx-auto mb-2">
                  {c.avatar_url ? (
                    <img
                      src={c.avatar_url}
                      alt={c.username}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    (c.full_name || c.username).slice(0, 2).toUpperCase()
                  )}
                </div>
                <p className="text-xs font-medium text-foreground truncate">{c.full_name || c.username}</p>
                <p className="text-[10px] text-muted-foreground truncate">@{c.username.replace("@", "")}</p>
                {c.primary_niche && (
                  <span className="text-[9px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 mt-1 inline-block">
                    {c.primary_niche}
                  </span>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {Math.round((c.similarity ?? 0) * 100)}% match
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── PythonAnalyticsPanel ──────────────────────────────────────────────────────
function PythonAnalyticsPanel({ data }: { data: PythonAnalyticsData }) {
  if (!data.available) {
    return (
      <div className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Statistical Analytics
        </p>
        <p className="text-xs text-muted-foreground italic">
          {data.reason ?? "Analytics service unavailable — try again later."}
        </p>
      </div>
    );
  }

  const bot = data.bot_detection;
  const eng = data.engagement_anomaly;

  const botPct = bot.data_available && bot.bot_probability != null
    ? Math.round(bot.bot_probability * 100) : null;
  const botRiskColor =
    bot.risk_level === "high" ? "bg-red-500"
    : bot.risk_level === "medium" ? "bg-amber-500"
    : "bg-emerald-500";
  const botBadgeColor =
    bot.risk_level === "high" ? "text-red-600 bg-red-50 border-red-200"
    : bot.risk_level === "medium" ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-emerald-600 bg-emerald-50 border-emerald-200";

  const anomalyPct = eng.data_available && eng.anomaly_score != null
    ? Math.round(eng.anomaly_score * 100) : null;
  const anomalyLabel =
    anomalyPct === null ? null
    : anomalyPct < 20 ? "Normal"
    : anomalyPct < 50 ? "Moderate"
    : "Anomalous";
  const anomalyColor =
    anomalyPct === null ? ""
    : anomalyPct < 20 ? "bg-emerald-500"
    : anomalyPct < 50 ? "bg-amber-500"
    : "bg-red-500";

  return (
    <div className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Statistical Analytics
        </p>
        {data.cached && (
          <span className="text-[9px] text-muted-foreground bg-muted/60 border border-border/40 rounded-full px-2 py-0.5">
            Cached · {data.analyzed_at ? new Date(data.analyzed_at).toLocaleDateString() : ""}
          </span>
        )}
      </div>

      {/* Bot probability */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-muted-foreground">Statistical Bot Risk</p>
          {bot.data_available && bot.risk_level ? (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${botBadgeColor}`}>
              {bot.risk_level.charAt(0).toUpperCase() + bot.risk_level.slice(1)} Risk
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">Data unavailable</span>
          )}
        </div>
        {botPct !== null ? (
          <>
            <div className="h-2.5 bg-muted/60 rounded-full overflow-hidden mb-1">
              <div className={`h-full rounded-full transition-all ${botRiskColor}`} style={{ width: `${botPct}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground text-right">{botPct}% probability · {bot.confidence} confidence</p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">Insufficient data to compute bot probability.</p>
        )}
        {bot.signals_triggered && bot.signals_triggered.length > 0 && (
          <details className="mt-2 group">
            <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground list-none flex items-center gap-1 select-none">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              {bot.signals_triggered.length} signal{bot.signals_triggered.length > 1 ? "s" : ""} triggered
            </summary>
            <ul className="mt-2 space-y-1 pl-3 border-l-2 border-muted">
              {bot.signals_triggered.map((s, i) => (
                <li key={i} className="text-[10px] text-muted-foreground leading-relaxed">{s}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Engagement anomaly */}
      <div className="pt-3 border-t border-border/30">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-muted-foreground">Engagement Anomaly</p>
          {anomalyLabel ? (
            <span className="text-[10px] text-muted-foreground font-medium">{anomalyLabel}</span>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">Data unavailable</span>
          )}
        </div>
        {anomalyPct !== null ? (
          <div className="h-2.5 bg-muted/60 rounded-full overflow-hidden mb-1">
            <div className={`h-full rounded-full transition-all ${anomalyColor}`} style={{ width: `${anomalyPct}%` }} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">Insufficient engagement data.</p>
        )}
        {eng.anomalies_detected && eng.anomalies_detected.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {eng.anomalies_detected.map((a, i) => (
              <li key={i} className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 leading-relaxed">{a}</li>
            ))}
          </ul>
        ) : eng.data_available && anomalyPct === 0 ? (
          <p className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 mt-1">
            ✓ No statistically notable engagement anomalies detected
          </p>
        ) : null}
      </div>

      <p className="text-[9px] text-muted-foreground/50 pt-1 border-t border-border/20">
        Rule-based statistical model · Not a substitute for platform-verified data
      </p>
    </div>
  );
}

export function DataStalenessBadge({ daysSince, onRefresh, disabled }: { daysSince: number; onRefresh: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onRefresh}
      disabled={disabled}
      className="flex items-center gap-2 text-amber-400 bg-[#353148] hover:bg-[#2a2739] transition-colors px-3 py-2 rounded-lg text-[11px] font-medium border border-[#353148] w-full mt-2 disabled:opacity-50"
    >
      <ShieldAlert size={14} className="shrink-0" />
      Data may be outdated — last enriched {daysSince} days ago
    </button>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const platformIcons: Record<string, any> = {
  instagram: Instagram,
  tiktok: SlidersHorizontal,
  youtube: Youtube,
};

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

/** Parse following/posts counts from the Google-snippet bio text when DB values are null. */
function parseStatsFromBio(bio: string | null): { following: number | null; posts: number | null } {
  if (!bio) return { following: null, posts: null };
  const followingMatch = bio.match(/(\d[\d,]*)\s+following/i);
  const postsMatch = bio.match(/(\d[\d,]*)\s+posts?/i);
  return {
    following: followingMatch ? parseInt(followingMatch[1].replace(/,/g, ""), 10) : null,
    posts: postsMatch ? parseInt(postsMatch[1].replace(/,/g, ""), 10) : null,
  };
}

/** Parse AI age_range string like "18-34" or "18-34 (65%)" into bar-chart data. */
function parseAgeBars(ageRange: string): { range: string; pct: number }[] {
  // Try to extract primary range (e.g. "18-34")
  const rangeMatch = ageRange.match(/(\d+)[–-](\d+)/);
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1]);
    const high = parseInt(rangeMatch[2]);
    // Distribute remaining % across 5 standard buckets
    return [
      { range: "13-17", pct: low >= 18 ? 5 : 20 },
      { range: "18-24", pct: low <= 18 && high >= 24 ? 35 : (low <= 24 ? 25 : 8) },
      { range: "25-34", pct: low <= 25 && high >= 34 ? 32 : (low <= 34 ? 20 : 12) },
      { range: "35-44", pct: high >= 44 ? 20 : 15 },
      { range: "45+", pct: high >= 45 ? 25 : 10 },
    ];
  }
  // Fallback
  return [
    { range: "13-17", pct: 8 }, { range: "18-24", pct: 35 },
    { range: "25-34", pct: 32 }, { range: "35-44", pct: 15 }, { range: "45+", pct: 10 },
  ];
}

/** Parse AI gender_split string like "60% Female, 40% Male" into bar data. */
function parseGenderBars(genderSplit: string): { gender: string; pct: number }[] {
  const female = genderSplit.match(/(\d+)%\s*female/i);
  const male = genderSplit.match(/(\d+)%\s*male/i);
  const femalePct = female ? parseInt(female[1]) : 60;
  const malePct = male ? parseInt(male[1]) : 35;
  const otherPct = Math.max(0, 100 - femalePct - malePct);
  return [
    { gender: "Female", pct: femalePct },
    { gender: "Male", pct: malePct },
    ...(otherPct > 0 ? [{ gender: "Other", pct: otherPct }] : []),
  ];
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function InfluencerProfilePage() {
  const { platform, username } = useParams<{ platform: string; username: string }>();
  const { evaluate, evaluation, loading: evalLoading, fetchCached } = useInfluencerEvaluation();
  const { canUseAI } = usePlanLimits();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [enriching, setEnriching] = useState(false);
  const [brandMentions] = useState<BrandMention[]>([]);
  const [botFeedbackSent, setBotFeedbackSent] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<PythonAnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const [addingToList, setAddingToList] = useState(false);

  const { data: lists } = useInfluencerLists();

  const handleAddToListSelect = async (listId: string) => {
    if (!profile) return;
    setAddingToList(true);
    try {
      const { error } = await supabase.from("list_items").upsert(
        { list_id: listId, platform: profile.platform, username: profile.username, profile_id: profile.id },
        { onConflict: "list_id,username,platform" }
      );
      if (error) throw error;
      toast({ title: "Added to list", description: `${profile.username} added successfully.` });
      setShowAddToList(false);
    } catch {
      toast({ title: "Failed to add", variant: "destructive" });
    } finally {
      setAddingToList(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied!", description: "Profile link copied to clipboard." });
  };

  const handleRunAnalytics = async () => {
    if (!platform || !username) return;
    setAnalyticsLoading(true);
    try {
      const metrics = {
        follower_count: profile?.metrics?.followers ?? profile?.metrics?.subscriber_count ?? profile?.follower_count ?? null,
        following_count: profile?.metrics?.following_count ?? profile?.following_count ?? null,
        posts_count: profile?.metrics?.posts_count ?? null,
        engagement_rate: profile?.metrics?.engagement_rate ?? profile?.engagement_rate ?? null,
        avg_likes: profile?.metrics?.avg_likes ?? null,
        avg_comments: profile?.metrics?.avg_comments ?? null,
        avg_views: profile?.metrics?.avg_views ?? null,
      };
      const { data, error } = await supabase.functions.invoke("ai-analytics", {
        body: { platform, username, metrics },
      });
      if (error) throw error;
      setAnalyticsData(data as PythonAnalyticsData);
    } catch (err: any) {
      setAnalyticsData({
        available: false,
        reason: "Analytics service unavailable — try again later.",
        bot_detection: { data_available: false },
        engagement_anomaly: { data_available: false },
      });
      const errMsg = err.message?.includes("Failed to send a request")
        ? "Analytics service is not running. This feature requires the edge functions to be deployed and reachable."
        : err.message || "Something went wrong";
      toast({ title: "Analytics unavailable", description: errMsg, variant: "destructive" });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Real data from DB
  const {
    profile,
    followerHistory,
    contentPerformance,
    postsCount,
    isEnriched,
    loading: profileLoading,
    reload,
    daysSinceEnrichment,
    isStale,
  } = useInfluencerProfile(platform, username);

  const PlatformIcon = platformIcons[platform || ""] || Users;

  // Load cached evaluation on mount
  const loadEval = useCallback(async () => {
    if (platform && username) await fetchCached(platform, username);
  }, [platform, username, fetchCached]);

  // run once
  useEffect(() => { loadEval(); }, [loadEval]);

  const handleEnrichAndEvaluate = async () => {
    if (!platform || !username) return;
    setEnriching(true);
    try {
      const { data: enrichData, error: enrichError } = await supabase.functions.invoke("enrich-influencer", {
        body: {
          username,
          platform,
          full_name: profile?.full_name,
          bio: profile?.bio,
          extracted_followers: profile?.metrics?.followers || profile?.metrics?.subscriber_count || profile?.follower_count,
          // Pass niche from cache so enrich-influencer doesn't overwrite with Lifestyle
          primary_niche: profile?.primary_niche || profile?.niche || evaluation?.niche_categories?.[0],
          // force_refresh when user has already evaluated (they explicitly want fresh data)
          force_refresh: !!evaluation,
        },
      });

      // Handle structured error codes (all responses now return HTTP 200)
      if (enrichData?.cooldown_remaining_days) {
        const days = enrichData.cooldown_remaining_days;
        toast({
          title: "Profile Data Is Fresh",
          description: `Data was enriched recently — running AI evaluation on current data. Re-enrichment available in ${days} day(s).`,
        });
        // Don't return — fall through to evaluate() with existing profile data
      } else
      if (enrichData?.code === "PROCESSING") {
        toast({ title: "Enrichment In Progress", description: "Data fetch is running — showing evaluation on current data.", variant: "default" });
        // Fall through to evaluate with current data
      } else if (enrichData?.code === "BUDGET_LOCKED") {
        toast({ title: "Budget Limit Reached", description: enrichData.error, variant: "destructive" });
        setEnriching(false);
        return;
      } else if (enrichData?.code === "CREDITS_EXHAUSTED") {
        toast({ title: "Credits Exhausted", description: "Add enrichment credits in Settings → Billing.", variant: "destructive" });
        setEnriching(false);
        return;
      }

      // If no blocking error code and no real error, reload and evaluate
      const hasBlockingError = enrichData?.code === "BUDGET_LOCKED" || enrichData?.code === "CREDITS_EXHAUSTED";
      if (!hasBlockingError && (enrichError || enrichData?.error) && !enrichData?.cooldown_remaining_days && enrichData?.code !== "PROCESSING") {
        throw new Error(enrichData?.technical_detail || enrichData?.error || enrichError?.message);
      }
      if (!hasBlockingError) await reload();
      const latestMetrics = (enrichData?.profile?.metrics) || {};
      await evaluate({
        username, platform,
        followers: latestMetrics.followers ?? enrichData?.profile?.follower_count ?? profile?.metrics?.followers ?? profile?.follower_count,
        engagement_rate: latestMetrics.engagement_rate ?? enrichData?.profile?.engagement_rate ?? profile?.metrics?.engagement_rate ?? profile?.engagement_rate,
        bio: enrichData?.profile?.bio ?? profile?.bio,
      }, !!evaluation); // forceRefresh=true when already have an evaluation
    } catch (err: any) {
      const raw: string = err.message || "Unknown error";
      const enrichMsg = raw.includes("Failed to send a request")
        ? "Enrichment service is unreachable. Please ensure the edge functions are deployed."
        : raw;
      toast({ title: "Enrichment Failed", description: enrichMsg, variant: "destructive" });
      // Still try to evaluate with available data
      await evaluate({
        username, platform,
        followers: profile?.metrics?.followers,
        engagement_rate: profile?.metrics?.engagement_rate,
        bio: profile?.bio,
      }, !!evaluation).catch(() => { });
    } finally {
      setEnriching(false);
    }
  };

  if (!platform || !username) {
    return <div className="p-8 text-center text-muted-foreground">Invalid profile URL</div>;
  }

  const loading = profileLoading;
  const metrics = profile?.metrics || {};
  const followers = metrics.followers || metrics.subscriber_count || profile?.follower_count;
  const lastSearchUrl = (() => { try { return sessionStorage.getItem("mushin_last_search_url") || ""; } catch { return ""; } })();
  const snippetStats = !isEnriched ? parseStatsFromBio(profile?.bio) : { following: null, posts: null };
  const following = metrics.following_count ?? profile?.following_count ?? snippetStats.following ?? null;
  const engagementRate = metrics.engagement_rate ?? profile?.engagement_rate;
  const city = metrics.city || profile?.city_extracted || profile?.city;
  const niche = profile?.primary_niche || evaluation?.niche_categories?.[0] || "Creator";
  const profileLink = profile?.link;
  const avatarUrl = profile?.avatar_url || (profile?.isCached ? profile?.imageUrl : null);
  const avatarInitials = (profile?.full_name || username || "?")
    .split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() || "?";
  // Quality signals from enrichment
  const audienceQualityScore = profile?.audience_quality_score ?? null;
  const botProbability = profile?.bot_probability ?? null;
  const dataSource = profile?.data_source ?? null;
  const enrichmentStatus = profile?.enrichment_status ?? null;
  const enrichedAt = profile?.enriched_at ? new Date(profile.enriched_at) : null;
  // We no longer rely on derived cache staleness, DataStalenessBadge queries the DB directly
  // Whether the profile is cached-only (never been enriched)
  const isCacheOnly = !isEnriched && profile?.isCached;
  const enrichmentFailed = enrichmentStatus === "failed";
  const enrichmentError = profile?.enrichment_error || "Unknown error during data fetching. Please try again later.";

  // Build follower growth chart data
  const growthChartData = followerHistory.map((h) => ({
    month: new Date(h.recorded_at).toLocaleDateString("en-PK", { month: "short" }),
    followers: h.follower_count,
  }));

  // Sponsored vs organic from posts
  const sponsoredPosts = contentPerformance.reduce((acc, t) => acc + t.sponsored, 0);
  const totalPosts = contentPerformance.reduce((acc, t) => acc + t.posts, 0);
  const organicPosts = totalPosts - sponsoredPosts;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/search${lastSearchUrl}`}><ChevronLeft size={18} strokeWidth={1.5} /></Link>
        </Button>
        <span className="text-sm text-muted-foreground flex-1">Back to Search</span>
      </div>

      {/* ── Similar Creators (inline) ──────────────────────────── */}
      {profile?.id && <SimilarCreatorsSection profileId={profile.id} currentPlatform={platform} />}

      {platform !== "youtube" && (
        <div className="bg-blue-50/50 border border-blue-200/50 text-blue-800 rounded-lg p-3 text-sm flex items-start gap-2 backdrop-blur-sm">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
          <p>Instagram and TikTok data is sourced via Apify. YouTube data comes directly from the official YouTube Data API v3.</p>
        </div>
      )}

      {/* ── Profile Header ─────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl p-6 shadow-sm">
          {loading ? (
            <div className="flex items-start gap-6">
              <Skeleton className="w-20 h-20 rounded-full shrink-0" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-32" />
                <div className="grid grid-cols-4 gap-4 max-w-md mt-4">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Avatar */}
              <div className="w-20 h-20 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 text-2xl font-bold overflow-hidden relative">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={profile?.full_name || username}
                    className="w-full h-full object-cover absolute inset-0"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                      // Show initials fallback
                      const fallback = img.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <span
                  className="w-full h-full flex items-center justify-center text-2xl font-bold"
                  style={{ display: avatarUrl ? 'none' : 'flex' }}
                >
                  {avatarInitials}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground truncate">
                    {profile?.full_name || username}
                  </h1>
                  {evaluation
                    ? <EvaluationScoreBadge score={evaluation.overall_score} size="lg" showLabel />
                    : profile?.overall_score
                      ? <EvaluationScoreBadge score={profile.overall_score} size="lg" showLabel />
                      : <span className="text-xs bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 font-medium">Unscored</span>
                  }
                  {/* Data source badge */}
                  {(!isEnriched && !enrichmentFailed) && (
                    <span title="Metrics sourced from Google search results" className="text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                      <Globe className="h-2.5 w-2.5" /> Data from Google
                    </span>
                  )}
                  {dataSource === "youtube_api" && (
                    <span title="Real data verified via official YouTube API" className="text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                      <ShieldCheck className="h-2.5 w-2.5" /> YouTube Verified
                    </span>
                  )}
                  {(dataSource === "synthetic_ai" || dataSource === "synthetic" || dataSource === "mock") && !isCacheOnly && (
                    <span title="Data is simulated for demonstration purposes" className="text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5" /> Simulated Data
                    </span>
                  )}
                  {enrichmentFailed && (
                    <span className="text-[10px] font-medium bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                      Last enrichment failed – try again
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-3 truncate">
                  @{username} · <span className="capitalize">{platform}</span> · {niche}
                </p>

                <div className="flex items-center gap-4 text-xs sm:text-sm text-muted-foreground mb-4 flex-wrap">
                  {city && <span className="flex items-center gap-1"><MapPin size={14} strokeWidth={1.5} /> {city}</span>}
                  {isEnriched && profile?.created_at && (
                    <span className="flex items-center gap-1">
                      <Calendar size={14} strokeWidth={1.5} />
                      Indexed {new Date(profile.created_at).getFullYear()}
                    </span>
                  )}
                  {profileLink && (
                    <a href={profileLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      <Globe size={14} strokeWidth={1.5} /> Profile Link
                    </a>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg">
                  {[  
                    { label: "Followers", value: followers != null ? formatFollowers(followers) : "—" },
                    { label: "Posts", value: (isEnriched ? postsCount : (postsCount ?? snippetStats.posts)) != null ? (isEnriched ? postsCount! : (postsCount ?? snippetStats.posts)!).toLocaleString() : "—" },
                    { label: "Following", value: following != null ? formatFollowers(following) : "—" },
                    { label: "Engagement", value: engagementRate != null ? `${engagementRate.toFixed(1)}%` : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted/40 border border-border/50 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-base font-bold text-foreground leading-tight">{value}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                {!isEnriched && followers == null && following == null && engagementRate == null && (
                  <p className="text-[11px] text-amber-600/80 mt-2 flex items-center gap-1">
                    <Info className="h-3 w-3 shrink-0" />
                    Full stats load after enrichment — click <span className="font-semibold">Enrich &amp; Evaluate</span> below.
                  </p>
                )}

                {/* Bio */}
                {profile?.bio
                  ? <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-lg line-clamp-3">{profile.bio}</p>
                  : <p className="text-sm text-muted-foreground/60 italic mt-3">Bio not available — click <span className="not-italic font-medium">Enrich &amp; Evaluate</span> to load the full profile.</p>
                }
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
                {/* Audience Quality Score */}
                {audienceQualityScore != null && (
                  <div className="flex items-center gap-2 text-xs">
                    {botProbability != null && botProbability < 30
                      ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      : botProbability != null && botProbability < 60
                        ? <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                        : <ShieldX className="h-3.5 w-3.5 text-red-500" />
                    }
                    <span className="text-muted-foreground">Audience Quality:</span>
                    <span className={`font-semibold ${audienceQualityScore >= 70 ? "text-emerald-600" :
                      audienceQualityScore >= 40 ? "text-amber-600" : "text-red-600"
                      }`}>{audienceQualityScore}/100</span>
                    {dataSource === "apify" && (
                      <span title="Verified by Apify" className="bg-blue-100 text-blue-700 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-blue-200">LIVE</span>
                    )}
                  </div>
                )}
                {/* Data Staleness Badge (DB Source of Truth) */}
                {isStale && (
                  <DataStalenessBadge
                    daysSince={Math.floor(daysSinceEnrichment!)}
                    onRefresh={handleEnrichAndEvaluate}
                    disabled={evalLoading || enriching || !canUseAI()}
                  />
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" className="rounded-lg flex-1 sm:flex-none" onClick={() => setShowAddToList(true)} title="Add to list"><Heart size={16} strokeWidth={1.5} /></Button>
                  <Button variant="outline" size="icon" className="rounded-lg flex-1 sm:flex-none" onClick={handleShare} title="Copy link"><Share2 size={16} strokeWidth={1.5} /></Button>
                  {profileLink && (
                    <Button variant="outline" size="icon" className="rounded-lg flex-1 sm:flex-none" asChild>
                      <a href={profileLink} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} strokeWidth={1.5} /></a>
                    </Button>
                  )}
                </div>
                <Button
                  variant="outline" size="sm"
                  className="w-full text-xs gap-1.5"
                  onClick={handleEnrichAndEvaluate}
                  disabled={evalLoading || enriching || !canUseAI()}
                >
                  <RefreshCw className={`h-3 w-3 ${(evalLoading || enriching) ? "animate-spin" : ""}`} />
                  {evaluation ? "Refresh Data" : isEnriched ? "Evaluate" : "Enrich & Evaluate"}
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="w-full text-xs gap-1.5"
                  onClick={handleRunAnalytics}
                  disabled={analyticsLoading || !profile}
                >
                  <BarChart3 className={`h-3 w-3 ${analyticsLoading ? "animate-pulse" : ""}`} />
                  {analyticsLoading ? "Running analytics…" : analyticsData ? "Refresh Analytics" : "Run Statistical Analytics"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Follower Growth Chart (always shown when history exists) ─── */}
      {growthChartData.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-foreground mb-4">Follower Growth</p>
            <ChartContainer
              config={{ followers: { label: "Followers", color: "hsl(var(--primary))" } }}
              className="h-[180px] w-full"
            >
              <AreaChart data={growthChartData} margin={{ left: 0, right: 10, top: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="follGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A855F7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} dy={10} />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false} axisLine={false} dx={-10}
                  tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${Math.round(v / 1_000)}K` : v}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="followers" stroke="#A855F7" strokeWidth={3} fill="url(#follGrad)" dot={{ strokeWidth: 2, r: 4, fill: "white" }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </AreaChart>
            </ChartContainer>
          </div>
        </motion.div>
      )}

      {/* ── Content Performance (shown only when posts exist) ─── */}
      {contentPerformance.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Content Performance
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border/50">
                    <th className="text-left pb-2 font-medium">Type</th>
                    <th className="text-right pb-2 font-medium">Posts</th>
                    <th className="text-right pb-2 font-medium">Sponsored</th>
                    <th className="text-right pb-2 font-medium">Organic</th>
                  </tr>
                </thead>
                <tbody>
                  {contentPerformance.map((row) => (
                    <tr key={row.type} className="border-b border-border/30 last:border-0">
                      <td className="py-2.5 font-medium text-foreground">{row.type}s</td>
                      <td className="py-2.5 text-right text-muted-foreground">{row.posts}</td>
                      <td className="py-2.5 text-right text-amber-600">{row.sponsored}</td>
                      <td className="py-2.5 text-right text-emerald-600">{row.posts - row.sponsored}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Enrichment Error State ─────────────────────────────────────── */}
      {enrichmentFailed && !evalLoading && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-red-50/50 backdrop-blur-md border border-red-200 border-dashed rounded-2xl p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100/50 rounded-full flex items-center justify-center mb-4 text-red-600">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-red-900 mb-2">Enrichment Failed</h3>
            <p className="text-sm text-red-700/80 max-w-md mb-6 whitespace-pre-line">
              {enrichmentError}
            </p>
            <Button className="bg-red-600 hover:bg-red-700 text-foreground px-8 gap-2 shadow-sm shadow-red-500/20" onClick={handleEnrichAndEvaluate} disabled={enriching}>
              {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {enriching ? "Retrying..." : "Retry Enrichment"}
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── Evaluate CTA ─────────────────────────────────────── */}
      {!evaluation && !evalLoading && !loading && !enrichmentFailed && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-card/50 backdrop-blur-md border border-primary/20 border-dashed rounded-2xl p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lightbulb className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Run AI Evaluation</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Get a comprehensive score covering engagement analysis, authenticity check, estimated audience demographics, and brand safety rating.
            </p>
            <Button className="btn-shine px-8 gap-2 shadow-sm shadow-primary/20" onClick={handleEnrichAndEvaluate} disabled={!canUseAI() || enriching}>
              {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
              {enriching ? "Enriching & Evaluating..." : "Evaluate Influencer"}
            </Button>
            {!canUseAI() && (
              <p className="text-xs text-destructive mt-3 font-medium bg-destructive/10 px-3 py-1 rounded-full">AI credits required. Upgrade your plan.</p>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Eval Loading Skeletons ─────────────────────────────── */}
      {evalLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 space-y-4">
              <Skeleton className="h-5 w-1/3 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-3 w-5/6 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Full AI Evaluation Report ────────────────────────── */}
      {evaluation && !evalLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">AI Evaluation Report</h2>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 font-medium">
              Score: {evaluation.overall_score}
            </Badge>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Left column */}
            <div className="space-y-4 sm:space-y-6">
              {/* Demographics — parsed from AI strings */}
              <div className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 sm:p-6 shadow-sm">
                <p className="text-sm font-semibold text-foreground mb-5 flex justify-between items-center">
                  Audience Demographics
                  <Badge variant="outline" className="text-[10px] font-normal">AI Estimated</Badge>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Age */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-3">Age Range</p>
                    <p className="text-xs text-primary font-medium mb-2">{evaluation.estimated_demographics?.age_range}</p>
                    <div className="space-y-2">
                      {parseAgeBars(evaluation.estimated_demographics?.age_range || "").map((a) => (
                        <div key={a.range} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-10 font-medium">{a.range}</span>
                          <div className="flex-1 h-2.5 bg-muted/60 rounded-full overflow-hidden">
                            <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${a.pct}%` }} />
                          </div>
                          <span className="text-[10px] font-medium text-foreground w-6 text-right">{a.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Gender */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-3">Gender</p>
                    <p className="text-xs text-primary font-medium mb-2">{evaluation.estimated_demographics?.gender_split}</p>
                    <div className="space-y-2">
                      {parseGenderBars(evaluation.estimated_demographics?.gender_split || "").map((g) => (
                        <div key={g.gender} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-12 font-medium">{g.gender}</span>
                          <div className="flex-1 h-2.5 bg-muted/60 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${g.pct}%` }} />
                          </div>
                          <span className="text-[10px] font-medium text-foreground w-6 text-right">{g.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Top locations — rank only, no fake percentages */}
                {evaluation.estimated_demographics?.top_countries?.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-border/40">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-muted-foreground">Top Locations</p>
                      <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        AI estimated · rank only
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {evaluation.estimated_demographics.top_countries.map((country: string, i: number) => {
                        const medals = ["🥇", "🥈", "🥉"];
                        const icon = medals[i] ?? "📍";
                        return (
                          <span
                            key={country}
                            className="inline-flex items-center gap-1.5 text-xs font-medium bg-muted/50 border border-border/40 rounded-full px-3 py-1.5 text-foreground"
                          >
                            <span>{icon}</span>
                            {country}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2.5 leading-relaxed">
                      Ranking only — exact audience percentages require Meta Business API access.
                    </p>
                  </div>
                )}
              </div>
              <AuthenticityPanel authenticity={evaluation.authenticity} className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm" />

              {(profile?.bot_probability_entendre !== null && profile?.bot_probability_entendre !== undefined) && (() => {
                const score = Math.round((profile.bot_probability_entendre ?? 0) * 100);
                const tier = score < 20 ? { label: "Authentic", color: "text-emerald-600 bg-emerald-50 border-emerald-200" }
                  : score < 40 ? { label: "Low Risk", color: "text-blue-600 bg-blue-50 border-blue-200" }
                  : score < 60 ? { label: "Moderate Risk", color: "text-amber-600 bg-amber-50 border-amber-200" }
                  : score < 80 ? { label: "High Risk", color: "text-orange-600 bg-orange-50 border-orange-200" }
                  : { label: "Very High Risk", color: "text-red-600 bg-red-50 border-red-200" };
                const signals: any[] = (profile as any).bot_signals || [];
                return (
                  <div className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <ShieldAlert size={16} className="text-muted-foreground" strokeWidth={1.5} />
                        <p className="text-sm font-semibold text-foreground">Bot Risk Score</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${tier.color}`}>{tier.label}</span>
                        <span className="text-2xl font-black text-foreground data-mono">{score}</span>
                        <span className="text-xs text-muted-foreground">/100</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-muted/60 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full transition-all ${score < 40 ? "bg-emerald-500" : score < 60 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>

                    {/* Collapsible signals */}
                    {signals.length > 0 && (
                      <details className="group">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none list-none flex items-center gap-1">
                          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                          Why this score? ({(profile as any).bot_signals_triggered ?? signals.length} of {(profile as any).bot_total_signals_checked ?? "16"} signals triggered)
                        </summary>
                        <div className="mt-3 space-y-2 pl-2 border-l-2 border-muted">
                          {signals.map((s: any, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 uppercase ${
                                s.risk === "high" ? "bg-red-100 text-red-700"
                                : s.risk === "medium" ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-600"
                              }`}>{s.risk}</span>
                              <p className="text-xs text-muted-foreground leading-relaxed">{s.detail}</p>
                            </div>
                          ))}
                          {(profile as any).bot_confidence_tier && (
                            <p className="text-[10px] text-muted-foreground pt-1 italic">
                              Detection confidence: {(profile as any).bot_confidence_tier}
                              {(profile as any).bot_interpretation ? ` · ${(profile as any).bot_interpretation}` : ""}
                            </p>
                          )}
                        </div>
                      </details>
                    )}

                    {/* Feedback widget */}
                    {!botFeedbackSent ? (
                      <div className="mt-3 pt-3 border-t border-border/30">
                        <p className="text-[10px] text-muted-foreground mb-2">Was this score accurate?</p>
                        <div className="flex gap-2">
                          {[
                            { label: "✓ Yes, a bot", verdict: "bot" },
                            { label: "✗ No, real", verdict: "authentic" },
                          ].map(({ label, verdict }) => (
                            <button
                              key={verdict}
                              onClick={async () => {
                                try {
                                  await supabase.functions.invoke("detect-bot-entendre", {
                                    body: {
                                      action: "feedback",
                                      username: profile.username,
                                      platform: profile.platform,
                                      predicted_score: score,
                                      verdict,
                                      signals_triggered: signals.map((s: any) => s.name),
                                    },
                                  });
                                  setBotFeedbackSent(true);
                                } catch (e) {
                                  console.warn("Feedback error:", e);
                                }
                              }}
                              className="text-[10px] px-3 py-1.5 rounded-full border border-border/50 text-muted-foreground hover:bg-muted/50 transition-colors"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-emerald-600 mt-3 pt-3 border-t border-border/30">
                        ✓ Feedback recorded — improves detection accuracy over time
                      </p>
                    )}
                  </div>
                );
              })()}
              <div className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-sm">
                <p className="text-sm font-semibold text-foreground mb-3">Growth Assessment</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{evaluation.growth_assessment?.pattern ?? ""}</p>
                {(evaluation.growth_assessment?.risk_flags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-3">
                    {(evaluation.growth_assessment?.risk_flags ?? []).map((flag, i) => (
                      <Badge key={i} variant="outline" className="text-[11px] font-medium bg-amber-50 text-amber-700 border-amber-200">{flag}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {brandMentions.length > 0 && (
                <BrandAffinityPanel mentions={brandMentions} competitors={["Khaadi", "Sapphire"]} className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm" />
              )}
            </div>

            {/* Right column */}
            <div className="space-y-4 sm:space-y-6">
              <EngagementPanel engagement={evaluation.engagement_rating} platform={platform} className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm" />

              <BrandSafetyPanel brandSafety={evaluation.brand_safety} className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm" />

              {followerHistory.length > 0 && (
                <GrowthAnalyticsPanel history={followerHistory} className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm" />
              )}

              <CompliancePanel influencerId={profile?.id || ""} existingDocument={null} className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm" />

              {totalPosts > 0 && (
                <SponsoredVsOrganicPanel
                  data={{
                    sponsored_er: (evaluation.engagement_rating?.rate || 4) * 0.75,
                    organic_er: (evaluation.engagement_rating?.rate || 4) * 1.2,
                    post_count_sponsored: sponsoredPosts,
                    post_count_organic: organicPosts,
                  }}
                  className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm"
                />
              )}

              {/* ── P6.5 Intelligence Panels ──────────────────────── */}
              <PredictiveGrowthPanel
                platform={(platform as any) || "instagram"}
                followerCount={followers ?? null}
                recentFollowerDelta={null}
                engagementRate={engagementRate ?? null}
                postsCount={postsCount ?? null}
                primaryNiche={niche}
                className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm"
              />

              <BrandFitMeterPanel
                platform={(platform as any) || "instagram"}
                followerCount={followers ?? null}
                engagementRate={engagementRate ?? null}
                botProbability={botProbability}
                creatorNiche={niche}
                className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm"
              />

              <CampaignResponsePanel
                platform={(platform as any) || "instagram"}
                followerCount={followers ?? null}
                engagementRate={engagementRate ?? null}
                botProbability={botProbability}
                creatorNiche={niche}
                className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm"
              />

              <AudienceStabilityPanel
                platform={platform || "instagram"}
                followerCount={followers ?? null}
                engagementRate={engagementRate ?? null}
                botProbability={botProbability}
                postsCount={postsCount ?? null}
                className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm"
              />

              {/* Niche & Recommendations */}
              <div className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-sm">
                <p className="text-sm font-semibold text-foreground mb-3">Niche & Recommendations</p>
                <div className="mb-4">
                  <NicheTagsDisplay categories={evaluation.niche_categories ?? []} />
                </div>
                <div className="bg-muted/50 rounded-xl p-4">
                  <ul className="space-y-2">
                    {(evaluation.recommendations ?? []).map((rec, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1 opacity-70" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Statistical Analytics — always visible once data is loaded ─── */}
      {analyticsLoading && (
        <div className="bg-background/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 animate-pulse space-y-3">
          <div className="h-4 bg-muted/60 rounded w-1/3" />
          <div className="h-2.5 bg-muted/60 rounded-full" />
          <div className="h-2.5 bg-muted/60 rounded-full w-4/5" />
        </div>
      )}
      {analyticsData && !analyticsLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <PythonAnalyticsPanel data={analyticsData} />
        </motion.div>
      )}

      {/* Add to List Dialog */}
      <Dialog open={showAddToList} onOpenChange={setShowAddToList}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to List</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto py-1">
            {!lists || lists.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No lists yet. Create one from the Lists page.</p>
            ) : (
              lists.map((list) => (
                <button
                  key={list.id}
                  disabled={addingToList}
                  onClick={() => handleAddToListSelect(list.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors flex items-center justify-between text-sm disabled:opacity-50"
                >
                  <span>{list.name}</span>
                  <Plus size={14} className="text-muted-foreground" />
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddToList(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
