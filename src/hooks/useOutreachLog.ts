import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const queryClient = useQueryClient();
  const queryKey = ["outreach-log", campaignId];

  const { data: outreachEntries, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_log")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("contacted_at", { ascending: false });
      if (error) throw error;
      return data as OutreachEntry[];
    },
    enabled: !!campaignId,
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
