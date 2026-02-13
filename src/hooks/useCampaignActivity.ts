import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const PAGE_SIZE = 20;

export function useCampaignActivity(campaignId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const activityQuery = useInfiniteQuery({
    queryKey: ["campaign-activity", campaignId],
    queryFn: async ({ pageParam = 0 }) => {
      if (!campaignId) throw new Error("No campaign id");
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("campaign_activity")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return data;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
    initialPageParam: 0,
    enabled: !!campaignId,
  });

  const logActivity = useMutation({
    mutationFn: async ({ action, details }: { action: string; details?: Record<string, any> }) => {
      if (!campaignId || !user) return;
      const { error } = await supabase
        .from("campaign_activity")
        .insert({
          campaign_id: campaignId,
          user_id: user.id,
          action,
          details: details || {},
        });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign-activity", campaignId] }),
  });

  return { ...activityQuery, logActivity };
}
