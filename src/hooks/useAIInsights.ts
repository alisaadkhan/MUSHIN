import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface FraudCheckResult {
  risk: "low" | "medium" | "high";
  flags: string[];
  summary: string;
  checked_at: string;
}

export interface Recommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: "outreach" | "budget" | "timeline" | "strategy";
}

export function useAIInsights() {
  const { toast } = useToast();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [fraudLoading, setFraudLoading] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);

  const handleError = useCallback((err: any, status?: number) => {
    const msg = err?.message || err?.error || "AI request failed";
    if (status === 429) {
      toast({ title: "Rate limited", description: "Too many requests. Please wait a moment.", variant: "destructive" });
    } else if (status === 402) {
      toast({ title: "Credits exhausted", description: "Please add AI credits in your workspace settings.", variant: "destructive" });
    } else {
      toast({ title: "AI Error", description: msg, variant: "destructive" });
    }
  }, [toast]);

  const generateSummary = useCallback(async (influencerData: any): Promise<string | null> => {
    setSummaryLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: { type: "summarize", data: influencerData },
      });
      if (error) throw error;
      if (data?.error) { handleError(data); return null; }
      return data?.summary || null;
    } catch (err: any) {
      handleError(err);
      return null;
    } finally {
      setSummaryLoading(false);
    }
  }, [handleError]);

  const runFraudCheck = useCallback(async (influencerData: any): Promise<FraudCheckResult | null> => {
    setFraudLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: { type: "fraud-check", data: influencerData },
      });
      if (error) throw error;
      if (data?.error) { handleError(data); return null; }
      return { ...data, checked_at: new Date().toISOString() } as FraudCheckResult;
    } catch (err: any) {
      handleError(err);
      return null;
    } finally {
      setFraudLoading(false);
    }
  }, [handleError]);

  const getCampaignRecommendations = useCallback(async (campaignContext: any): Promise<Recommendation[] | null> => {
    setRecommendLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: { type: "recommend", data: campaignContext },
      });
      if (error) throw error;
      if (data?.error) { handleError(data); return null; }
      return data?.recommendations || null;
    } catch (err: any) {
      handleError(err);
      return null;
    } finally {
      setRecommendLoading(false);
    }
  }, [handleError]);

  return {
    generateSummary, summaryLoading,
    runFraudCheck, fraudLoading,
    getCampaignRecommendations, recommendLoading,
  };
}
