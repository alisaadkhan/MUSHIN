import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function usePipelineStages(campaignId: string | undefined) {
  const { workspace } = useAuth();
  const qc = useQueryClient();

  const stagesQuery = useQuery({
    queryKey: ["pipeline-stages", campaignId],
    queryFn: async () => {
      if (!campaignId || !workspace?.workspace_id) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*, campaigns!inner(workspace_id)")
        .eq("campaign_id", campaignId)
        .eq("campaigns.workspace_id", workspace.workspace_id)
        .order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId && !!workspace?.workspace_id,
  });

  const addStage = useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      if (!campaignId || !workspace?.workspace_id) throw new Error("No workspace");
      const { data: existing } = await supabase
        .from("campaigns")
        .select("id")
        .eq("id", campaignId)
        .eq("workspace_id", workspace.workspace_id)
        .single();
      if (!existing) throw new Error("Campaign not found or access denied");
      const stages = stagesQuery.data || [];
      const { data, error } = await supabase
        .from("pipeline_stages")
        .insert({ campaign_id: campaignId, name, color: color || "#6b7280", position: stages.length })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages", campaignId] }),
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      if (!workspace?.workspace_id) throw new Error("No workspace");
      const { data: stage } = await supabase
        .from("pipeline_stages")
        .select("campaigns!inner(workspace_id)")
        .eq("id", id)
        .single();
      if (!stage || stage.campaigns?.workspace_id !== workspace.workspace_id) {
        throw new Error("Stage not found or access denied");
      }
      const updates: Record<string, string> = {};
      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;
      const { error } = await supabase.from("pipeline_stages").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages", campaignId] }),
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      if (!workspace?.workspace_id) throw new Error("No workspace");
      const { data: stage } = await supabase
        .from("pipeline_stages")
        .select("campaigns!inner(workspace_id)")
        .eq("id", id)
        .single();
      if (!stage || stage.campaigns?.workspace_id !== workspace.workspace_id) {
        throw new Error("Stage not found or access denied");
      }
      const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages", campaignId] }),
  });

  const reorderStages = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!workspace?.workspace_id) throw new Error("No workspace");
      for (const id of orderedIds) {
        const { data: stage } = await supabase
          .from("pipeline_stages")
          .select("campaigns!inner(workspace_id)")
          .eq("id", id)
          .single();
        if (!stage || stage.campaigns?.workspace_id !== workspace.workspace_id) {
          throw new Error("Stage not found or access denied");
        }
      }
      const updates = orderedIds.map((id, index) =>
        supabase.from("pipeline_stages").update({ position: index }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages", campaignId] }),
  });

  return { ...stagesQuery, addStage, updateStage, deleteStage, reorderStages };
}

export function usePipelineCards(campaignId: string | undefined) {
  const { workspace } = useAuth();
  const qc = useQueryClient();

  const cardsQuery = useQuery({
    queryKey: ["pipeline-cards", campaignId],
    queryFn: async () => {
      if (!campaignId || !workspace?.workspace_id) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("pipeline_cards")
        .select("*, campaigns!inner(workspace_id)")
        .eq("campaign_id", campaignId)
        .eq("campaigns.workspace_id", workspace.workspace_id)
        .order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId && !!workspace?.workspace_id,
  });

  const addCard = useMutation({
    mutationFn: async (card: { stage_id: string; campaign_id: string; username: string; platform: string; data?: any; notes?: string }) => {
      if (!workspace?.workspace_id) throw new Error("No workspace");
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("id")
        .eq("id", card.campaign_id)
        .eq("workspace_id", workspace.workspace_id)
        .single();
      if (!campaign) throw new Error("Campaign not found or access denied");
      const { data, error } = await supabase.from("pipeline_cards").insert({ ...card, position: 0 }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-cards", campaignId] }),
  });

  const moveCard = useMutation({
    mutationFn: async ({ cardId, stageId, position }: { cardId: string; stageId: string; position: number }) => {
      if (!workspace?.workspace_id) throw new Error("No workspace");
      const { data: card } = await supabase
        .from("pipeline_cards")
        .select("campaigns!inner(workspace_id)")
        .eq("id", cardId)
        .single();
      if (!card || card.campaigns?.workspace_id !== workspace.workspace_id) {
        throw new Error("Card not found or access denied");
      }
      const { error } = await supabase
        .from("pipeline_cards")
        .update({ stage_id: stageId, position })
        .eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-cards", campaignId] }),
  });

  const updateCard = useMutation({
    mutationFn: async ({ id, ...values }: { id: string; notes?: string; agreed_rate?: number; data?: any }) => {
      if (!workspace?.workspace_id) throw new Error("No workspace");
      const { data: card } = await supabase
        .from("pipeline_cards")
        .select("campaigns!inner(workspace_id)")
        .eq("id", id)
        .single();
      if (!card || card.campaigns?.workspace_id !== workspace.workspace_id) {
        throw new Error("Card not found or access denied");
      }
      const { error } = await supabase.from("pipeline_cards").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-cards", campaignId] }),
  });

  const removeCard = useMutation({
    mutationFn: async (id: string) => {
      if (!workspace?.workspace_id) throw new Error("No workspace");
      const { data: card } = await supabase
        .from("pipeline_cards")
        .select("campaigns!inner(workspace_id)")
        .eq("id", id)
        .single();
      if (!card || card.campaigns?.workspace_id !== workspace.workspace_id) {
        throw new Error("Card not found or access denied");
      }
      const { error } = await supabase.from("pipeline_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-cards", campaignId] }),
  });

  return { ...cardsQuery, addCard, moveCard, updateCard, removeCard };
}
