import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { notifyIntegrations } from "@/lib/integrations";

export function useCampaigns() {
  const { workspace } = useAuth();
  const qc = useQueryClient();

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", workspace?.workspace_id],
    queryFn: async () => {
      if (!workspace) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("campaigns")
        .select("*, pipeline_cards(count)")
        .eq("workspace_id", workspace.workspace_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!workspace,
    staleTime: 5 * 60_000,
  });

  const createCampaign = useMutation({
    mutationFn: async (values: { name: string; description?: string; budget?: number; start_date?: string; end_date?: string }) => {
      if (!workspace) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("campaigns")
        .insert({ ...values, workspace_id: workspace.workspace_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns", workspace?.workspace_id] }),
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Record<string, unknown>) => {
      if (!workspace) throw new Error("No workspace");
      const { error } = await supabase
        .from("campaigns")
        .update(values)
        .eq("id", id)
        .eq("workspace_id", workspace.workspace_id);
      if (error) throw error;

      // Fire webhook on status change (fire-and-forget, log rejection)
      if (values.status && workspace) {
        notifyIntegrations(workspace.workspace_id, "campaign_status_changed", {
          campaign_id: id,
          new_status: values.status,
        }).catch((e: unknown) => console.warn("[campaigns] notifyIntegrations failed:", e));
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns", workspace?.workspace_id] }),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      if (!workspace) throw new Error("No workspace");
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspace.workspace_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns", workspace?.workspace_id] }),
  });

  return { ...campaignsQuery, createCampaign, updateCampaign, deleteCampaign };
}
