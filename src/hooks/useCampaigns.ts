import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...values }: { id: string; name?: string; description?: string; status?: "draft" | "active" | "completed" | "archived"; budget?: number; start_date?: string; end_date?: string }) => {
      const { error } = await supabase.from("campaigns").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  return { ...campaignsQuery, createCampaign, updateCampaign, deleteCampaign };
}
