import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OutreachEntry {
  id: string;
  campaign_id: string;
  card_id: string;
  username: string;
  platform: string;
  method: string;
  status: string;
  contacted_at: string;
  notes: string | null;
  email_to: string | null;
  email_subject: string | null;
}

export function useOutreachLog(campaignId: string | undefined) {
  const { workspace } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["outreach-log", campaignId];

  const { data: outreachEntries, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!campaignId || !workspace?.workspace_id) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("outreach_log")
        .select("*, campaigns!inner(workspace_id)")
        .eq("campaign_id", campaignId)
        .eq("campaigns.workspace_id", workspace.workspace_id)
        .order("contacted_at", { ascending: false });
      if (error) throw error;
      return data as OutreachEntry[];
    },
    enabled: !!campaignId && !!workspace?.workspace_id,
    staleTime: 2 * 60_000,
  });

  const logOutreach = useMutation({
    mutationFn: async (entry: {
      campaign_id: string;
      card_id: string;
      username: string;
      platform: string;
      method?: string;
      notes?: string;
    }) => {
      if (!workspace?.workspace_id) throw new Error("No workspace");
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("id")
        .eq("id", entry.campaign_id)
        .eq("workspace_id", workspace.workspace_id)
        .single();
      if (!campaign) throw new Error("Campaign not found or access denied");
      const { error } = await supabase.from("outreach_log").insert({
        campaign_id: entry.campaign_id,
        card_id: entry.card_id,
        username: entry.username,
        platform: entry.platform,
        method: entry.method || "manual",
        notes: entry.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const getCardOutreach = (cardId: string) =>
    outreachEntries?.filter((e) => e.card_id === cardId) || [];

  const isContacted = (cardId: string) =>
    outreachEntries?.some((e) => e.card_id === cardId) || false;

  return { outreachEntries, isLoading, logOutreach, getCardOutreach, isContacted };
}
