import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePipelineStages(campaignId: string | undefined) {
  const qc = useQueryClient();

  const stagesQuery = useQuery({
    queryKey: ["pipeline-stages", campaignId],
    queryFn: async () => {
      if (!campaignId) throw new Error("No campaign id");
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  const addStage = useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      if (!campaignId) throw new Error("No campaign id");
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
      const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-stages", campaignId] }),
  });

  const reorderStages = useMutation({
    mutationFn: async (orderedIds: string[]) => {
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
  const qc = useQueryClient();

  const cardsQuery = useQuery({
    queryKey: ["pipeline-cards", campaignId],
    queryFn: async () => {
      if (!campaignId) throw new Error("No campaign id");
      const { data, error } = await supabase
        .from("pipeline_cards")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("position");
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  const addCard = useMutation({
    mutationFn: async (card: { stage_id: string; campaign_id: string; username: string; platform: string; data?: any; notes?: string }) => {
      const { data, error } = await supabase.from("pipeline_cards").insert({ ...card, position: 0 }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-cards", campaignId] }),
  });

  const moveCard = useMutation({
    mutationFn: async ({ cardId, stageId, position }: { cardId: string; stageId: string; position: number }) => {
      const { error } = await supabase
        .from("pipeline_cards")
        .update({ stage_id: stageId, position })
        .eq("id", cardId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-cards", campaignId] }),
  });

  const updateCard = useMutation({
    mutationFn: async ({ id, ...values }: { id: string; notes?: string; agreed_rate?: number }) => {
      const { error } = await supabase.from("pipeline_cards").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-cards", campaignId] }),
  });

  const removeCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pipeline_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-cards", campaignId] }),
  });

  return { ...cardsQuery, addCard, moveCard, updateCard, removeCard };
}
