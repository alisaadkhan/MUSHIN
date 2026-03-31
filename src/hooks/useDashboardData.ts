import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DashboardMetric {
  label: string;
  value: string | number;
  icon: any;
  glow?: boolean;
}

export interface ActivityTrendItem {
  day: number;
  activity: number;
}

export interface RecentActivity {
  action_type: string;
  amount: number;
  created_at: string;
}

export interface DashboardCampaign {
  id: string;
  name: string;
  status: string;
  budget: number;
  creators_count: number;
}

export function useDashboardData() {
  const { workspace } = useAuth();
  const wid = workspace?.workspace_id;

  // 1. Campaigns Data
  const campaignsQuery = useQuery({
    queryKey: ["dashboard-campaigns", wid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, status, budget, pipeline_cards(count)")
        .eq("workspace_id", wid!)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data.map(c => ({
        ...c,
        creators_count: (c.pipeline_cards as any)?.[0]?.count ?? 0
      })) as DashboardCampaign[];
    },
    enabled: !!wid,
  });

  // 2. Recent Activity (Credit Usage)
  const activityQuery = useQuery({
    queryKey: ["dashboard-activity", wid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credits_usage")
        .select("action_type, amount, created_at")
        .eq("workspace_id", wid!)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as RecentActivity[];
    },
    enabled: !!wid,
  });

  // 3. Trends (Last 30 Days)
  const trendsQuery = useQuery({
    queryKey: ["dashboard-credits-trend", wid],
    queryFn: async () => {
      const since = new Date(); 
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("credits_usage")
        .select("amount, created_at")
        .eq("workspace_id", wid!)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!wid,
  });

  // Normalization logic
  const normalizedTrend = useMemo(() => {
    const data = trendsQuery.data || [];
    const map: Record<number, number> = {};
    data.forEach((row) => {
      const key = new Date(row.created_at).getDate();
      map[key] = (map[key] || 0) + Math.abs(row.amount);
    });
    // Return last 30 days based on current date for consistent mapping
    return Array.from({ length: 30 }, (_, i) => ({ 
      day: i + 1, 
      activity: map[i + 1] || 0 
    }));
  }, [trendsQuery.data]);

  const stats = useMemo(() => {
    const campaigns = campaignsQuery.data || [];
    const activeCreators = campaigns.reduce((sum, c) => sum + c.creators_count, 0);
    const totalBudget = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0);
    const totalEvents = trendsQuery.data?.length ?? 0;

    return {
      activeCreators,
      totalBudget,
      totalEvents,
    };
  }, [campaignsQuery.data, trendsQuery.data]);

  const isLoading = campaignsQuery.isLoading || activityQuery.isLoading || trendsQuery.isLoading;
  const isError = campaignsQuery.isError || activityQuery.isError || trendsQuery.isError;
  const isEmpty = !isLoading && (campaignsQuery.data?.length === 0 && activityQuery.data?.length === 0);

  return {
    campaigns: campaignsQuery.data || [],
    recentActivity: activityQuery.data || [],
    activityTrend: normalizedTrend,
    stats,
    isLoading,
    isError,
    isEmpty,
    refetch: () => {
      campaignsQuery.refetch();
      activityQuery.refetch();
      trendsQuery.refetch();
    }
  };
}
