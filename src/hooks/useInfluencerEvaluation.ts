import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface InfluencerEvaluation {
  overall_score: number;
  engagement_rating: { rate: number; benchmark_comparison: string; verdict: string };
  authenticity: { score: number; risk_level: string; flags: string[]; summary: string };
  growth_assessment: { pattern: string; risk_flags: string[] };
  estimated_demographics: { age_range: string; gender_split: string; top_countries: string[] };
  niche_categories: string[];
  brand_safety: { rating: "safe" | "caution" | "risk"; flags: string[] };
  recommendations: string[];
}

export interface CachedEvaluation {
  id: string;
  platform: string;
  username: string;
  evaluation: InfluencerEvaluation;
  overall_score: number;
  evaluated_at: string;
  workspace_id: string;
}

export function useInfluencerEvaluation() {
  const { workspace } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<InfluencerEvaluation | null>(null);

  const fetchCached = useCallback(async (platform: string, username: string): Promise<CachedEvaluation | null> => {
    if (!workspace) return null;
    const { data } = await supabase
      .from("influencer_evaluations")
      .select("*")
      .eq("platform", platform)
      .eq("username", username)
      .eq("workspace_id", workspace.workspace_id)
      .eq("evaluation_version", 1) // Phase 6: Version validation
      .gt("expires_at", new Date().toISOString()) // Phase 6: Cache expiry
      .maybeSingle();
    if (data) {
      setEvaluation(data.evaluation as unknown as InfluencerEvaluation);
      return data as unknown as CachedEvaluation;
    }
    return null;
  }, [workspace]);

  const evaluate = useCallback(async (influencerData: any): Promise<InfluencerEvaluation | null> => {
    if (!workspace) return null;
    setLoading(true);
    try {
      // Check cache first
      const cached = await fetchCached(influencerData.platform, influencerData.username);
      if (cached) {
        setLoading(false);
        return cached.evaluation as unknown as InfluencerEvaluation;
      }

      // Call AI
      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: { type: "evaluate", data: influencerData },
      });
      if (error) throw error;
      if (data?.error) {
        const status = data?.status;
        if (status === 429) toast({ title: "Rate limited", description: "Please wait a moment.", variant: "destructive" });
        else if (status === 402) toast({ title: "Credits exhausted", description: "Add AI credits in settings.", variant: "destructive" });
        else toast({ title: "Evaluation failed", description: data.error, variant: "destructive" });
        return null;
      }

      const result = data as InfluencerEvaluation;
      setEvaluation(result);

      // Cache result
      await supabase.from("influencer_evaluations").upsert({
        platform: influencerData.platform,
        username: influencerData.username,
        evaluation: result as any,
        overall_score: result.overall_score,
        workspace_id: workspace.workspace_id,
        evaluated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90-day expiry
        evaluation_version: 1,
      }, { onConflict: "platform,username,workspace_id" });

      return result;
    } catch (err: any) {
      toast({ title: "Evaluation failed", description: err.message || "Unknown error", variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  }, [workspace, fetchCached, toast]);

  const getCachedScore = useCallback(async (platform: string, username: string): Promise<number | null> => {
    if (!workspace) return null;
    const { data } = await supabase
      .from("influencer_evaluations")
      .select("overall_score")
      .eq("platform", platform)
      .eq("username", username)
      .eq("workspace_id", workspace.workspace_id)
      .eq("evaluation_version", 1)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    return data?.overall_score ?? null;
  }, [workspace]);

  return { evaluate, evaluation, loading, fetchCached, getCachedScore };
}
