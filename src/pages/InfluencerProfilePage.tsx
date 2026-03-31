import { useCallback, useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronLeft, Loader2, RefreshCw, Sparkles, Lightbulb, Info, ShieldAlert,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useInfluencerLists } from "@/hooks/useInfluencerLists";
import { useInfluencerEvaluation } from "@/hooks/useInfluencerEvaluation";
import { useInfluencerProfile } from "@/hooks/useInfluencerProfile";
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
import { BrandAffinityPanel } from "@/components/influencer/BrandAffinityPanel";
import { SponsoredVsOrganicPanel } from "@/components/influencer/SponsoredVsOrganicPanel";
import { PredictiveGrowthPanel } from "@/components/influencer/PredictiveGrowthPanel";
import { CampaignResponsePanel } from "@/components/influencer/CampaignResponsePanel";
import { AudienceStabilityPanel } from "@/components/influencer/AudienceStabilityPanel";
import { BrandFitMeterPanel } from "@/components/influencer/BrandFitMeterPanel";

// Modularized Components
import { SimilarCreatorsSection } from "@/components/influencer/SimilarCreatorsSection";
import { PythonAnalyticsPanel } from "@/components/influencer/PythonAnalyticsPanel";
import { AudienceDemographics } from "@/components/influencer/AudienceDemographics";
import { ProfileSummary } from "@/components/influencer/ProfileSummary";
import { GlassCard } from "@/components/ui/glass-card";

// Types
interface PythonAnalyticsData {
  available: boolean;
  reason?: string;
  bot_detection: any;
  engagement_anomaly: any;
  cached?: boolean;
  analyzed_at?: string;
}

export default function InfluencerProfilePage() {
  const { platform, username } = useParams<{ platform: string; username: string }>();
  const { evaluate, evaluation, loading: evalLoading, fetchCached } = useInfluencerEvaluation();
  const { canUseAI } = usePlanLimits();
  const { toast } = useToast();
  const [enriching, setEnriching] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<PythonAnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [botFeedbackSent, setBotFeedbackSent] = useState(false);

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
      toast({ title: "Signal Isolated", description: `${profile.username} tracked.` });
      setShowAddToList(false);
    } catch {
      toast({ title: "Isolation Failed", variant: "destructive" });
    } finally {
      setAddingToList(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: "Signal Link Shared", description: "Standard encryption applied." });
  };

  const handleRunAnalytics = async () => {
    if (!platform || !username) return;
    setAnalyticsLoading(true);
    try {
      const metrics: any = {
        follower_count: profile?.metrics?.followers ?? profile?.metrics?.subscriber_count ?? profile?.follower_count ?? null,
        following_count: profile?.metrics?.following_count ?? profile?.following_count ?? null,
        posts_count: profile?.metrics?.posts_count ?? null,
        engagement_rate: profile?.metrics?.engagement_rate ?? profile?.engagement_rate ?? null,
        avg_likes: profile?.metrics?.avg_likes ?? null,
        avg_comments: profile?.metrics?.avg_comments ?? null,
        avg_views: (profile?.metrics as any)?.avg_views ?? null,
      };
      const { data: wsData } = await supabase.from("workspace_members").select("workspace_id").limit(1).maybeSingle();
      const { data, error } = await supabase.functions.invoke("ai-analytics", {
        body: { platform, username, metrics, workspace_id: wsData?.workspace_id },
      });
      if (error) throw error;
      setAnalyticsData(data as PythonAnalyticsData);
    } catch (err: any) {
      setAnalyticsData({
        available: false,
        bot_detection: { data_available: false },
        engagement_anomaly: { data_available: false },
      });
      toast({ title: "Analytics Offline", description: err.message, variant: "destructive" });
    } finally {
      setAnalyticsLoading(false);
    }
  };

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

  const loadEval = useCallback(async () => {
    if (platform && username) await fetchCached(platform, username);
  }, [platform, username, fetchCached]);

  useEffect(() => { loadEval(); }, [loadEval]);

  const handleEnrichAndEvaluate = async () => {
    if (!platform || !username) return;
    setEnriching(true);
    try {
      const { data: enrichData, error: enrichError } = await supabase.functions.invoke("enrich-influencer", {
        body: {
          username, platform,
          full_name: profile?.full_name,
          bio: profile?.bio,
          extracted_followers: profile?.metrics?.followers || profile?.metrics?.subscriber_count || profile?.follower_count,
          primary_niche: profile?.primary_niche || profile?.niche || evaluation?.niche_categories?.[0],
          force_refresh: !!evaluation,
        },
      });

      if (enrichData?.code === "BUDGET_LOCKED" || enrichData?.code === "CREDITS_EXHAUSTED") {
        toast({ title: "Resources Exhausted", description: enrichData.error, variant: "destructive" });
        setEnriching(false);
        return;
      }

      if (!enrichData?.cooldown_remaining_days && (enrichError || enrichData?.error) && enrichData?.code !== "PROCESSING") {
        throw new Error(enrichData?.technical_detail || enrichData?.error || enrichError?.message);
      }
      
      await reload();
      const latestMetrics = (enrichData?.profile?.metrics) || {};
      await evaluate({
        username, platform,
        followers: latestMetrics.followers ?? enrichData?.profile?.follower_count ?? profile?.metrics?.followers ?? profile?.follower_count,
        engagement_rate: latestMetrics.engagement_rate ?? enrichData?.profile?.engagement_rate ?? profile?.metrics?.engagement_rate ?? profile?.engagement_rate,
        bio: enrichData?.profile?.bio ?? profile?.bio,
      }, !!evaluation);
    } catch (err: any) {
      toast({ title: "Enrichment Error", description: err.message, variant: "destructive" });
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
    return <div className="p-8 text-center text-white/20">Invalid Profile Coordinates</div>;
  }

  const metrics = profile?.metrics || {};
  const followers = metrics.followers || metrics.subscriber_count || profile?.follower_count;
  const lastSearchUrl = (() => { try { return sessionStorage.getItem("mushin_last_search_url") || ""; } catch { return ""; } })();
  const following = metrics.following_count ?? profile?.following_count ?? null;
  const engagementRate = metrics.engagement_rate ?? profile?.engagement_rate;
  const city = metrics.city || profile?.city_extracted || profile?.city;
  const niche = profile?.primary_niche || evaluation?.niche_categories?.[0] || "Creator";
  const avatarUrl = profile?.avatar_url || (profile?.isCached ? profile?.imageUrl : null);
  const avatarInitials = (profile?.full_name || username || "?")
    .split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() || "?";
  const botProbability = profile?.bot_probability ?? null;
  const enrichmentFailed = profile?.enrichment_status === "failed";
  const enrichmentError = profile?.enrichment_error || "Data sync interrupted.";

  const growthChartData = followerHistory.map((h) => ({
    month: new Date(h.recorded_at).toLocaleDateString("en-PK", { month: "short" }),
    followers: h.follower_count,
  }));

  const totalPosts = contentPerformance.reduce((acc, t) => acc + t.posts, 0);
  const sponsoredPosts = contentPerformance.reduce((acc, t) => acc + t.sponsored, 0);
  const organicPosts = totalPosts - sponsoredPosts;

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20">
      {/* ── Internal Navigation Header ─── */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-colors" asChild>
          <Link to={`/search${lastSearchUrl}`}>
            <ChevronLeft size={14} className="mr-2" /> Return to Discovery
          </Link>
        </Button>
        <span className="w-1 h-1 rounded-full bg-white/10" />
        <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Intelligence Node: {username}</span>
      </div>

      {/* ── Similar Creators Strategy ─── */}
      {profile?.id && <SimilarCreatorsSection profileId={profile.id} currentPlatform={platform} />}

      {platform !== "youtube" && (
        <div className="bg-blue-500/5 border border-blue-500/10 text-blue-400/80 rounded-xl p-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 backdrop-blur-md">
          <Info className="h-4 w-4 shrink-0 text-blue-500" />
          <p>Multi-source ingestion active: Instagram/TikTok (Apify Node) + Native YouTube API Cluster</p>
        </div>
      )}

      {/* ── Main Profile Summary ─── */}
      <ProfileSummary 
        profile={profile}
        loading={profileLoading}
        isEnriched={isEnriched}
        followers={followers}
        following={following}
        postsCount={postsCount}
        engagementRate={engagementRate}
        city={city}
        niche={niche}
        evaluation={evaluation}
        isStale={isStale}
        daysSinceEnrichment={daysSinceEnrichment}
        handleEnrichAndEvaluate={handleEnrichAndEvaluate}
        handleRunAnalytics={handleRunAnalytics}
        handleShare={handleShare}
        setShowAddToList={setShowAddToList}
        enriching={enriching}
        analyticsLoading={analyticsLoading}
        analyticsData={analyticsData}
        avatarUrl={avatarUrl}
        avatarInitials={avatarInitials}
      />

      {/* ── Analytics Grid ─── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Follower Trajectory */}
        {growthChartData.length > 0 && (
          <GlassCard className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30">Growth Trajectory</h3>
              <div className="text-[8px] font-black uppercase tracking-widest text-white/10">Follower Delta (90D)</div>
            </div>
            <ChartContainer
              config={{ followers: { label: "Nodes", color: "#A855F7" } }}
              className="h-[240px] w-full"
            >
              <AreaChart data={growthChartData} margin={{ left: -20, right: 0, top: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="follGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A855F7" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }} axisLine={false} tickLine={false} dy={10} />
                <YAxis
                  tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)" }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${Math.round(v / 1_000)}K` : v}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="followers" stroke="#A855F7" strokeWidth={2} fill="url(#follGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ChartContainer>
          </GlassCard>
        )}

        {/* Content Efficiency */}
        {contentPerformance.length > 0 && (
          <GlassCard className="p-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-8">Content Efficiency</h3>
            <div className="space-y-6">
               {contentPerformance.map((row) => (
                 <div key={row.type} className="space-y-2">
                    <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
                       <span className="text-white/40">{row.type}s</span>
                       <span className="text-white">{row.posts}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 h-1.5">
                       <div className="bg-amber-500/20 rounded-full" style={{ width: `${(row.sponsored / row.posts) * 100}%` }} />
                       <div className="bg-emerald-500/20 rounded-full" style={{ width: `${((row.posts - row.sponsored) / row.posts) * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-white/10">
                       <span>{row.sponsored} Sponsored</span>
                       <span>{row.posts - row.sponsored} Organic</span>
                    </div>
                 </div>
               ))}
            </div>
          </GlassCard>
        )}
      </div>

      {/* ── Enrichment State Logic ─── */}
      {enrichmentFailed && !evalLoading && !profileLoading && (
        <GlassCard className="p-12 border-dashed border-red-500/20 flex flex-col items-center text-center">
            <ShieldAlert size={48} className="text-red-500/40 mb-6" />
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Sync Interrupted</h3>
            <p className="text-xs text-white/40 max-w-sm mb-8 leading-relaxed">{enrichmentError}</p>
            <Button className="h-12 px-10 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest" onClick={handleEnrichAndEvaluate} disabled={enriching}>
              {enriching ? <Loader2 size={16} className="animate-spin mr-2" /> : <RefreshCw size={16} className="mr-2" />}
              Re-initialize Uplink
            </Button>
        </GlassCard>
      )}

      {!evaluation && !evalLoading && !profileLoading && !enrichmentFailed && (
        <GlassCard className="p-12 border-dashed border-purple-500/20 flex flex-col items-center text-center">
            <Lightbulb size={48} className="text-purple-500/40 mb-6" />
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Initialize AI Audit</h3>
            <p className="text-xs text-white/40 max-w-sm mb-8 leading-relaxed">
              Synthesize cross-platform behavior, engagement velocity, and niche saturation metrics through our Neural Analysis Engine.
            </p>
            <Button className="h-12 px-10 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-purple-500/20" onClick={handleEnrichAndEvaluate} disabled={!canUseAI() || enriching}>
              {enriching ? <Loader2 size={16} className="animate-spin mr-2" /> : <Sparkles size={16} className="mr-2" />}
              Begin In-Depth Audit
            </Button>
        </GlassCard>
      )}

      {/* ── Full Intelligence Report ─── */}
      {evaluation && !evalLoading && (
        <div className="space-y-10">
          <div className="flex items-center gap-4">
             <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Intelligence Report</h2>
             <div className="h-0.5 flex-1 bg-white/[0.05]" />
             <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] font-black uppercase tracking-widest px-4 py-1.5">
               Confidence: {evaluation.overall_score}/100
             </Badge>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Column Alpha */}
            <div className="space-y-8">
               <AudienceDemographics 
                 ageRange={evaluation.estimated_demographics?.age_range} 
                 genderSplit={evaluation.estimated_demographics?.gender_split}
                 topCountries={evaluation.estimated_demographics?.top_countries}
               />
               <AuthenticityPanel authenticity={evaluation.authenticity} className="bg-transparent border-0 p-0 shadow-none" />
               
               {/* Bot Risk Integrated */}
               {(profile?.bot_probability_entendre != null) && (() => {
                  const score = Math.round((profile.bot_probability_entendre ?? 0) * 100);
                  return (
                    <GlassCard className="p-6">
                       <div className="flex items-center justify-between mb-6">
                          <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30">Bot Detection Vector</h3>
                          <span className="text-2xl font-black text-white">{score}<span className="text-[10px] text-white/20 ml-1">/100</span></span>
                       </div>
                       <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden mb-4">
                          <div className={cn("h-full transition-all duration-1000", score < 40 ? "bg-emerald-500" : score < 60 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${score}%` }} />
                       </div>
                       <p className="text-[10px] text-white/40 uppercase tracking-widest leading-loose">
                          Rule-based statistical classification · Probability of non-human interaction nodes.
                       </p>
                    </GlassCard>
                  );
               })()}

               <GlassCard className="p-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-4">Growth Pattern</h3>
                  <p className="text-sm text-white/60 leading-relaxed italic">"{evaluation.growth_assessment?.pattern}"</p>
                  {evaluation.growth_assessment?.risk_flags?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-6">
                       {evaluation.growth_assessment.risk_flags.map((f: string) => (
                         <Badge key={f} variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-red-500/5 text-red-400 border-red-500/20">{f}</Badge>
                       ))}
                    </div>
                  )}
               </GlassCard>
            </div>

            {/* Column Beta */}
            <div className="space-y-8">
               <EngagementPanel engagement={evaluation.engagement_rating} platform={platform} className="bg-transparent border-0 p-0 shadow-none" />
               <BrandSafetyPanel brandSafety={evaluation.brand_safety} className="bg-transparent border-0 p-0 shadow-none" />
               {followerHistory.length > 0 && <GrowthAnalyticsPanel history={followerHistory} className="bg-transparent border-0 p-0 shadow-none" />}
               <SponsoredVsOrganicPanel 
                  data={{
                    sponsored_er: (evaluation.engagement_rating?.rate || 4) * 0.75,
                    organic_er: (evaluation.engagement_rating?.rate || 4) * 1.2,
                    post_count_sponsored: sponsoredPosts,
                    post_count_organic: organicPosts,
                  }}
                  className="bg-transparent border-0 p-0 shadow-none"
               />
               <PredictiveGrowthPanel 
                  platform={platform as any} 
                  followerCount={followers} 
                  engagementRate={engagementRate} 
                  postsCount={postsCount} 
                  primaryNiche={niche} 
                  recentFollowerDelta={followerHistory.length >= 2 ? (followerHistory[followerHistory.length - 1].follower_count - followerHistory[0].follower_count) : null}
                  className="bg-transparent border-0 p-0 shadow-none" 
               />
               <BrandFitMeterPanel platform={platform as any} followerCount={followers} engagementRate={engagementRate} botProbability={botProbability} creatorNiche={niche} className="bg-transparent border-0 p-0 shadow-none" />
            </div>
          </div>
        </div>
      )}

      {/* ── Secondary Analytics ─── */}
      {analyticsData && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <PythonAnalyticsPanel data={analyticsData} />
        </motion.div>
      )}

      {/* Add to List Node Selection */}
      <Dialog open={showAddToList} onOpenChange={setShowAddToList}>
        <DialogContent className="bg-black/90 border-white/10 text-white max-w-sm backdrop-blur-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tighter">Isolate Signal</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-4">
            {!lists || lists.length === 0 ? (
              <p className="text-[10px] text-white/20 uppercase font-black text-center py-4">No active monitoring lists.</p>
            ) : (
              lists.map((list) => (
                <button
                  key={list.id}
                  disabled={addingToList}
                  onClick={() => handleAddToListSelect(list.id)}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all flex items-center justify-between disabled:opacity-50 group"
                >
                  <span className="text-xs font-black uppercase tracking-widest text-white/60 group-hover:text-white">{list.name}</span>
                  <Sparkles size={12} className="text-white/10 group-hover:text-purple-400 group-hover:scale-125 transition-all" />
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white" onClick={() => setShowAddToList(false)}>Abort</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const cn = (...args: any[]) => args.filter(Boolean).join(" ");
