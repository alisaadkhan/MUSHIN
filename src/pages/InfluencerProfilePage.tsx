import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Instagram, Youtube, SlidersHorizontal, Loader2, RefreshCw, Users, Lightbulb, MapPin, Calendar, Plus, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useInfluencerEvaluation, type InfluencerEvaluation } from "@/hooks/useInfluencerEvaluation";
import { EvaluationScoreBadge } from "@/components/influencer/EvaluationScoreBadge";
import { EngagementPanel } from "@/components/influencer/EngagementPanel";
import { AuthenticityPanel } from "@/components/influencer/AuthenticityPanel";
import { DemographicsPanel } from "@/components/influencer/DemographicsPanel";
import { BrandSafetyPanel } from "@/components/influencer/BrandSafetyPanel";
import { NicheTagsDisplay } from "@/components/influencer/NicheTagsDisplay";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  tiktok: SlidersHorizontal,
  youtube: Youtube,
};

// Placeholder engagement over time data
const engagementOverTime = [
  { month: "Mar", rate: 4.2 }, { month: "Apr", rate: 4.5 }, { month: "May", rate: 3.8 },
  { month: "Jun", rate: 5.1 }, { month: "Jul", rate: 4.9 }, { month: "Aug", rate: 5.4 },
  { month: "Sep", rate: 5.0 }, { month: "Oct", rate: 5.8 }, { month: "Nov", rate: 6.1 },
  { month: "Dec", rate: 5.5 }, { month: "Jan", rate: 6.3 }, { month: "Feb", rate: 4.8 },
];

// Placeholder content performance
const contentPerformance = [
  { type: "Reels", posts: 48, engagement: "6.2%", reach: "120K" },
  { type: "Stories", posts: 124, engagement: "4.8%", reach: "85K" },
  { type: "Posts", posts: 36, engagement: "3.9%", reach: "95K" },
  { type: "Lives", posts: 8, engagement: "8.1%", reach: "45K" },
];

export default function InfluencerProfilePage() {
  const { platform, username } = useParams<{ platform: string; username: string }>();
  const { evaluate, evaluation, loading, fetchCached } = useInfluencerEvaluation();
  const { canUseAI } = usePlanLimits();
  const [cacheData, setCacheData] = useState<any>(null);
  const [loadingCache, setLoadingCache] = useState(true);
  const navigate = useNavigate();

  const PlatformIcon = platformIcons[platform || ""] || Users;

  useEffect(() => {
    if (!platform || !username) return;
    const load = async () => {
      setLoadingCache(true);
      const { data: cached } = await supabase
        .from("influencers_cache")
        .select("*")
        .eq("platform", platform)
        .eq("username", username)
        .maybeSingle();
      setCacheData(cached);
      await fetchCached(platform, username);
      setLoadingCache(false);
    };
    load();
  }, [platform, username, fetchCached]);

  const handleEvaluate = async () => {
    if (!platform || !username) return;
    const d = cacheData?.data || {};
    await evaluate({
      username,
      platform,
      followers: d.followers || d.subscriber_count,
      engagement_rate: d.engagement_rate,
      avg_views: d.avg_views || d.average_views,
      bio: d.bio || d.snippet,
      snippet: d.snippet,
      title: d.title,
      link: d.link,
    });
  };

  if (!platform || !username) {
    return <div className="p-8 text-center text-muted-foreground">Invalid profile URL</div>;
  }

  const d = cacheData?.data || {};
  const followers = d.followers || d.subscriber_count;
  const niche = evaluation?.niche_categories?.[0] || "Creator";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/search"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
        </Button>
      </div>

      {/* Header with large avatar */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-muted border-2 border-primary/20">
                <PlatformIcon className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold">{d.title || username}</h1>
                  {evaluation && <EvaluationScoreBadge score={evaluation.overall_score} size="lg" showLabel />}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm text-muted-foreground">@{username}</span>
                  <Badge variant="outline" className="text-[10px]">{platform}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{niche}</Badge>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  {d.city_extracted && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{d.city_extracted}</span>
                  )}
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Joined 2019</span>
                  {d.link && (
                    <a href={d.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      <Globe className="h-3 w-3" />Profile
                    </a>
                  )}
                </div>

                {/* Stat badges */}
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  {followers && (
                    <div className="rounded-lg bg-muted px-3 py-1.5 text-center">
                      <p className="text-sm font-bold">{Number(followers).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Followers</p>
                    </div>
                  )}
                  <div className="rounded-lg bg-muted px-3 py-1.5 text-center">
                    <p className="text-sm font-bold">892</p>
                    <p className="text-[10px] text-muted-foreground">Posts</p>
                  </div>
                  <div className="rounded-lg bg-muted px-3 py-1.5 text-center">
                    <p className="text-sm font-bold">1,247</p>
                    <p className="text-[10px] text-muted-foreground">Following</p>
                  </div>
                  <div className="rounded-lg bg-muted px-3 py-1.5 text-center">
                    <p className="text-sm font-bold">4.8%</p>
                    <p className="text-[10px] text-muted-foreground">Engagement</p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 shrink-0">
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <RefreshCw className="h-3 w-3" /> Refresh Data
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <Plus className="h-3 w-3" /> Add to List
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1.5">
                  <Plus className="h-3 w-3" /> Add to Campaign
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Evaluate button */}
      {!evaluation && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="glass-card border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Lightbulb className="h-10 w-10 text-primary mb-3" />
              <h3 className="text-lg font-semibold mb-1">Run AI Evaluation</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                Get a comprehensive score including engagement analysis, authenticity check, demographics estimate, and brand safety rating.
              </p>
              <Button className="btn-shine gap-2" onClick={handleEvaluate} disabled={!canUseAI()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
                Evaluate Influencer
              </Button>
              {!canUseAI() && (
                <p className="text-xs text-destructive mt-2">AI credits required. Upgrade your plan.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="glass-card">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-10 w-1/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Evaluation Results */}
      {evaluation && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Evaluation Report</h2>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleEvaluate} disabled={loading || !canUseAI()}>
              <RefreshCw className="h-3 w-3" /> Re-evaluate
            </Button>
          </div>

          {/* Demographics 3-column */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Audience Age</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[
                  { range: "13-17", pct: 8 }, { range: "18-24", pct: 35 }, { range: "25-34", pct: 32 },
                  { range: "35-44", pct: 15 }, { range: "45+", pct: 10 },
                ].map((a) => (
                  <div key={a.range} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{a.range}</span>
                    <span className="font-medium">{a.pct}%</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Gender Split</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[
                  { gender: "Female", pct: 62 }, { gender: "Male", pct: 35 }, { gender: "Other", pct: 3 },
                ].map((g) => (
                  <div key={g.gender} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{g.gender}</span>
                    <span className="font-medium">{g.pct}%</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Top Locations</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(evaluation.estimated_demographics?.top_countries || [
                  "United States", "United Kingdom", "Canada", "Australia",
                ]).map((country: string, i: number) => (
                  <div key={country} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{country}</span>
                    <span className="font-medium">{[42, 12, 8, 6][i] || 5}%</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Evaluation panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EngagementPanel engagement={evaluation.engagement_rating} platform={platform} />
            <AuthenticityPanel authenticity={evaluation.authenticity} />
            <BrandSafetyPanel brandSafety={evaluation.brand_safety} />
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Growth Assessment</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{evaluation.growth_assessment.pattern}</p>
                {evaluation.growth_assessment.risk_flags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {evaluation.growth_assessment.risk_flags.map((flag, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/20">{flag}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Content Performance */}
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Content Performance</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {contentPerformance.map(cp => (
                  <div key={cp.type} className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-sm font-semibold">{cp.type}</p>
                    <p className="text-xs text-muted-foreground mt-1">{cp.posts} posts</p>
                    <p className="text-xs text-muted-foreground">{cp.engagement} eng</p>
                    <p className="text-xs text-muted-foreground">{cp.reach} reach</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Engagement Over Time */}
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Engagement Rate Over Time</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={{ rate: { label: "Engagement %", color: "hsl(var(--primary))" } }} className="h-[240px] w-full">
                <LineChart data={engagementOverTime} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Niche + Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="glass-card">
              <CardContent className="p-5">
                <NicheTagsDisplay categories={evaluation.niche_categories} />
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Recommendations</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {evaluation.recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}
    </div>
  );
}
