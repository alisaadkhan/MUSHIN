import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = ["#A855F7", "#C084FC", "#7C3AED", "#6D28D9", "#4C1D95", "#2E1065"];

export interface AnalyticsPlatformData {
  name: string;
  count: number;
  fill: string;
}

export interface AnalyticsCampaignPerformance {
  name: string;
  rate: number;
  total: number;
  confirmed: number;
}

export interface AnalyticsNicheData {
  name: string;
  count: number;
}

export function useAnalyticsData() {
  const { workspace } = useAuth();
  const wid = workspace?.workspace_id;

  // 1. Campaigns Data
  const campaignsQuery = useQuery({
    queryKey: ["analytics-campaigns", wid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*, pipeline_cards(id, platform, primary_niche, data), pipeline_stages(*)")
        .eq("workspace_id", wid!);
      if (error) throw error;
      return data;
    },
    enabled: !!wid,
  });

  // 2. Recent Activity (Credit Usage)
  const activityQuery = useQuery({
    queryKey: ["analytics-activity", wid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credits_usage")
        .select("*")
        .eq("workspace_id", wid!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!wid,
  });

  // 3. Campaign Metrics (via Tracking Links)
  const metricsQuery = useQuery({
    queryKey: ["analytics-metrics", wid],
    queryFn: async () => {
      const { data: workspaceCampaigns } = await supabase
        .from("campaigns")
        .select("id")
        .eq("workspace_id", wid!);

      const campaignIds = workspaceCampaigns?.map(c => c.id) || [];
      if (campaignIds.length === 0) return [];

      const { data: links, error: linksError } = await (supabase as any)
        .from("tracking_links")
        .select("id")
        .in("campaign_id", campaignIds);
      
      if (linksError) throw linksError;

      const linkIds = links?.map((l: any) => l.id) || [];
      if (linkIds.length === 0) return [];

      const { data: metrics, error } = await (supabase as any)
        .from("campaign_metrics")
        .select("*")
        .in("tracking_link_id", linkIds);

      if (error) throw error;
      return metrics || [];
    },
    enabled: !!wid,
  });

  // Data Normalization
  const platformData = useMemo(() => {
    const campaigns = campaignsQuery.data || [];
    const map: Record<string, number> = {};
    campaigns.forEach((c) => {
      (c.pipeline_cards || []).forEach((card: any) => {
        const p = card.platform || "Other";
        map[p] = (map[p] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(([name, count], i) => ({ 
        name, 
        count, 
        fill: COLORS[i % COLORS.length] 
      }))
      .sort((a, b) => b.count - a.count);
  }, [campaignsQuery.data]);

  const nicheData = useMemo(() => {
    const campaigns = campaignsQuery.data || [];
    const map: Record<string, number> = {};
    campaigns.forEach((c) => {
      (c.pipeline_cards || []).forEach((card: any) => {
        const niche = card.data?.niche || card.primary_niche || "Other";
        map[niche] = (map[niche] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [campaignsQuery.data]);

  const campaignPerformance = useMemo(() => {
    const campaigns = campaignsQuery.data || [];
    return campaigns.map((c) => {
      const cards = c.pipeline_cards || [];
      const stages = c.pipeline_stages || [];
      const lastStage = stages.sort((a: any, b: any) => b.position - a.position)[0];
      const confirmed = lastStage ? cards.filter((card: any) => card.stage_id === lastStage.id).length : 0;
      const rate = cards.length > 0 ? Math.round((confirmed / cards.length) * 100) : 0;
      return { 
        name: c.name, 
        rate, 
        total: cards.length, 
        confirmed 
      };
    }).sort((a, b) => b.rate - a.rate);
  }, [campaignsQuery.data]);

  const roiMetrics = useMemo(() => {
    const metrics = metricsQuery.data || [];
    const totalClicks = metrics.reduce((sum: number, m: any) => sum + (m.clicks || 0), 0);
    const totalRevenue = metrics.reduce((sum: number, m: any) => sum + Number(m.revenue_generated || 0), 0);
    
    // Assumed estimation of $500 per campaign as baseline for demo scaling
    const estimatedCost = (campaignsQuery.data?.length || 1) * 500;
    const roi = estimatedCost > 0 ? ((totalRevenue - estimatedCost) / estimatedCost) * 100 : 0;

    return { totalClicks, totalRevenue, roi };
  }, [metricsQuery.data, campaignsQuery.data]);

  const isLoading = campaignsQuery.isLoading || activityQuery.isLoading || metricsQuery.isLoading;
  const isError = campaignsQuery.isError || activityQuery.isError || metricsQuery.isError;

  return {
    campaigns: campaignsQuery.data || [],
    creditsUsage: activityQuery.data || [],
    platformData,
    campaignPerformance,
    nicheData,
    roiMetrics,
    isLoading,
    isError,
    refetch: () => {
      campaignsQuery.refetch();
      activityQuery.refetch();
      metricsQuery.refetch();
    }
  };
}
