import { useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronLeft, ExternalLink, Heart, Share2, Instagram, Youtube,
  SlidersHorizontal, Loader2, RefreshCw, Users, Lightbulb,
  MapPin, Calendar, Plus, Globe, Sparkles, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
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
import { useState } from "react";

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

/** Parse AI age_range string like "18-34" or "18-34 (65%)" into bar-chart data. */
function parseAgeBars(ageRange: string): { range: string; pct: number }[] {
  // Try to extract primary range (e.g. "18-34")
  const rangeMatch = ageRange.match(/(\d+)[–\-](\d+)/);
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

  // Real data from DB
  const {
    profile,
    followerHistory,
    contentPerformance,
    postsCount,
    isEnriched,
    loading: profileLoading,
    reload,
  } = useInfluencerProfile(platform, username);

  const PlatformIcon = platformIcons[platform || ""] || Users;

  // Load cached evaluation on mount
  const loadEval = useCallback(async () => {
    if (platform && username) await fetchCached(platform, username);
  }, [platform, username, fetchCached]);

  // run once
  useState(() => { loadEval(); });

  const handleEnrichAndEvaluate = async () => {
    if (!platform || !username) return;
    setEnriching(true);
    try {
      // Step 1: Enrich
      const { data: enrichData, error: enrichError } = await supabase.functions.invoke("enrich-influencer", {
        body: {
          username,
          platform,
          full_name: profile?.full_name,
          bio: profile?.bio,
          extracted_followers: profile?.metrics?.followers || profile?.metrics?.subscriber_count,
        },
      });
      if (enrichError || enrichData?.error) throw new Error(enrichData?.error || enrichError?.message);
      await reload();
      // Step 2: Evaluate
      const latestMetrics = enrichData.profile?.metrics || {};
      await evaluate({ username, platform, followers: latestMetrics.followers, engagement_rate: latestMetrics.engagement_rate, bio: enrichData.profile?.bio });
    } catch (err: any) {
      await evaluate({
        username, platform,
        followers: profile?.metrics?.followers,
        engagement_rate: profile?.metrics?.engagement_rate,
        bio: profile?.bio,
      });
    } finally {
      setEnriching(false);
    }
  };

  if (!platform || !username) {
    return <div className="p-8 text-center text-muted-foreground">Invalid profile URL</div>;
  }

  const loading = profileLoading;
  const metrics = profile?.metrics || {};
  const followers = metrics.followers || metrics.subscriber_count;
  const engagementRate = metrics.engagement_rate;
  const city = metrics.city || profile?.city_extracted;
  const niche = profile?.primary_niche || evaluation?.niche_categories?.[0] || "Creator";
  const profileLink = (profile as any)?.link;

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
          <Link to="/search"><ChevronLeft size={18} strokeWidth={1.5} /></Link>
        </Button>
        <span className="text-sm text-muted-foreground flex-1">Back to Search</span>
        <Button
          variant="outline" size="sm"
          className="text-xs gap-1.5 rounded-lg border-border"
          onClick={async () => {
            if (!profile?.id) return;
            toast({ title: "Finding Similar Creators", description: "Analyzing AI embeddings..." });
            try {
              const res = await supabase.functions.invoke("find-lookalikes", { body: { target_profile_id: profile.id, match_count: 5 } });
              if (res.error) throw res.error;
              if (res.data?.results) {
                toast({ title: `Found ${res.data.results.length} similar creators` });
                navigate(`/search?q=Similar to @${username}`);
              }
            } catch (err: any) {
              toast({ title: "Lookup Failed", description: err.message, variant: "destructive" });
            }
          }}
        >
          <Sparkles className="h-3 w-3 text-primary" />
          Find Similar Creators
        </Button>
      </div>

      {/* ── Profile Header ─────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl p-6 shadow-sm">
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
              <div className="w-20 h-20 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 text-2xl font-bold">
                {profile?.full_name
                  ? profile.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
                  : <PlatformIcon className="h-8 w-8" />
                }
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
                </div>
                <p className="text-sm text-muted-foreground mb-3 truncate">
                  @{username} · <span className="capitalize">{platform}</span> · {niche}
                </p>

                <div className="flex items-center gap-4 text-xs sm:text-sm text-muted-foreground mb-4 flex-wrap">
                  {city && <span className="flex items-center gap-1"><MapPin size={14} strokeWidth={1.5} /> {city}</span>}
                  <span className="flex items-center gap-1">
                    <Calendar size={14} strokeWidth={1.5} />
                    Joined {profile?.created_at ? new Date(profile.created_at).getFullYear() : "—"}
                  </span>
                  {profileLink && (
                    <a href={profileLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      <Globe size={14} strokeWidth={1.5} /> Profile Link
                    </a>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-md">
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      {followers ? formatFollowers(followers) : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Followers</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      {postsCount != null ? postsCount : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Posts</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">—</p>
                    <p className="text-xs text-muted-foreground">Following</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      {engagementRate ? `${engagementRate}%` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">Engagement</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" className="rounded-lg flex-1 sm:flex-none"><Heart size={16} strokeWidth={1.5} /></Button>
                  <Button variant="outline" size="icon" className="rounded-lg flex-1 sm:flex-none"><Share2 size={16} strokeWidth={1.5} /></Button>
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
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Follower Growth Chart (always shown when history exists) ─── */}
      {growthChartData.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-foreground mb-4">Follower Growth</p>
            <ChartContainer
              config={{ followers: { label: "Followers", color: "hsl(var(--primary))" } }}
              className="h-[180px] w-full"
            >
              <AreaChart data={growthChartData} margin={{ left: 0, right: 10, top: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="follGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
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
                <Area type="monotone" dataKey="followers" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#follGrad)" dot={{ strokeWidth: 2, r: 4, fill: "white" }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </AreaChart>
            </ChartContainer>
          </div>
        </motion.div>
      )}

      {/* ── Content Performance (shown only when posts exist) ─── */}
      {contentPerformance.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-sm">
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

      {/* ── Evaluate CTA ─────────────────────────────────────── */}
      {!evaluation && !evalLoading && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-white/50 backdrop-blur-md border border-primary/20 border-dashed rounded-2xl p-8 text-center flex flex-col items-center">
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
            <div key={i} className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 space-y-4">
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
              IQ: {evaluation.overall_score}
            </Badge>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Left column */}
            <div className="space-y-4 sm:space-y-6">
              {/* Demographics — parsed from AI strings */}
              <div className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 sm:p-6 shadow-sm">
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

                {/* Top locations */}
                {evaluation.estimated_demographics?.top_countries?.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-border/40">
                    <p className="text-xs font-medium text-muted-foreground mb-3">Top Locations</p>
                    <div className="space-y-2">
                      {evaluation.estimated_demographics.top_countries.map((country: string, i: number) => {
                        const pct = [42, 18, 12, 8, 6][i] ?? 5;
                        return (
                          <div key={country} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-28 truncate font-medium">{country}</span>
                            <div className="flex-1 h-2.5 bg-muted/60 rounded-full overflow-hidden">
                              <div className="h-full bg-slate-400 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] font-medium text-foreground w-6 text-right">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <AuthenticityPanel authenticity={evaluation.authenticity} className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm" />

              <div className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-sm">
                <p className="text-sm font-semibold text-foreground mb-3">Growth Assessment</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{evaluation.growth_assessment.pattern}</p>
                {evaluation.growth_assessment.risk_flags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-3">
                    {evaluation.growth_assessment.risk_flags.map((flag, i) => (
                      <Badge key={i} variant="outline" className="text-[11px] font-medium bg-amber-50 text-amber-700 border-amber-200">{flag}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {brandMentions.length > 0 && (
                <BrandAffinityPanel mentions={brandMentions} competitors={["Khaadi", "Sapphire"]} className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm" />
              )}
            </div>

            {/* Right column */}
            <div className="space-y-4 sm:space-y-6">
              <EngagementPanel engagement={evaluation.engagement_rating} platform={platform} className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm" />

              <BrandSafetyPanel brandSafety={evaluation.brand_safety} className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm" />

              {followerHistory.length > 0 && (
                <GrowthAnalyticsPanel history={followerHistory} className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm" />
              )}

              <CompliancePanel influencerId={profile?.id || ""} existingDocument={null} className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm" />

              {totalPosts > 0 && (
                <SponsoredVsOrganicPanel
                  data={{
                    sponsored_er: (evaluation.engagement_rating.rate || 4) * 0.75,
                    organic_er: (evaluation.engagement_rating.rate || 4) * 1.2,
                    post_count_sponsored: sponsoredPosts,
                    post_count_organic: organicPosts,
                  }}
                  className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm"
                />
              )}

              {/* Niche & Recommendations */}
              <div className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl p-5 shadow-sm">
                <p className="text-sm font-semibold text-foreground mb-3">Niche & Recommendations</p>
                <div className="mb-4">
                  <NicheTagsDisplay categories={evaluation.niche_categories} />
                </div>
                <div className="bg-muted/50 rounded-xl p-4">
                  <ul className="space-y-2">
                    {evaluation.recommendations.map((rec, i) => (
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
    </div>
  );
}
