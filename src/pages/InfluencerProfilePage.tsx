import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Instagram, Youtube, SlidersHorizontal, Loader2, RefreshCw, Users, Lightbulb } from "lucide-react";
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

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  tiktok: SlidersHorizontal,
  youtube: Youtube,
};

export default function InfluencerProfilePage() {
  const { platform, username } = useParams<{ platform: string; username: string }>();
  const { evaluate, evaluation, loading, fetchCached } = useInfluencerEvaluation();
  const { canUseAI } = usePlanLimits();
  const [cacheData, setCacheData] = useState<any>(null);
  const [loadingCache, setLoadingCache] = useState(true);

  const PlatformIcon = platformIcons[platform || ""] || Users;

  // Load cached influencer data + evaluation
  useEffect(() => {
    if (!platform || !username) return;
    const load = async () => {
      setLoadingCache(true);
      // Get cached influencer data
      const { data: cached } = await supabase
        .from("influencers_cache")
        .select("*")
        .eq("platform", platform)
        .eq("username", username)
        .maybeSingle();
      setCacheData(cached);

      // Try loading cached evaluation
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/search"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
        </Button>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <PlatformIcon className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{d.title || username}</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">@{username}</span>
                    <Badge variant="outline" className="text-[10px]">{platform}</Badge>
                    {followers && (
                      <Badge variant="secondary" className="text-[10px]">
                        {Number(followers).toLocaleString()} followers
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {evaluation && <EvaluationScoreBadge score={evaluation.overall_score} size="lg" showLabel />}
                {d.link && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={d.link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Profile
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Evaluate / Re-evaluate button */}
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

      {/* Loading state */}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EngagementPanel engagement={evaluation.engagement_rating} platform={platform} />
            <AuthenticityPanel authenticity={evaluation.authenticity} />
            <DemographicsPanel demographics={evaluation.estimated_demographics} />
            <BrandSafetyPanel brandSafety={evaluation.brand_safety} />
          </div>

          {/* Growth Assessment */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Growth Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">{evaluation.growth_assessment.pattern}</p>
              {evaluation.growth_assessment.risk_flags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {evaluation.growth_assessment.risk_flags.map((flag, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/20">
                      {flag}
                    </Badge>
                  ))}
                </div>
              )}
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
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recommendations</CardTitle>
              </CardHeader>
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
