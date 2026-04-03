import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useInfluencerLists() {
  const { workspace } = useAuth();
  const qc = useQueryClient();

  const listsQuery = useQuery({
    queryKey: ["influencer-lists", workspace?.workspace_id],
    queryFn: async () => {
      if (!workspace) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("influencer_lists")
        .select("*, list_items(count)")
        .eq("workspace_id", workspace.workspace_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!workspace,
    staleTime: 5 * 60_000,
  });

  const createList = useMutation({
    mutationFn: async (name: string) => {
      if (!workspace) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("influencer_lists")
        .insert({ name, workspace_id: workspace.workspace_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["influencer-lists"] }),
  });

  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      // Delete items first, then the list
      await supabase.from("list_items").delete().eq("list_id", id);
      const { error } = await supabase.from("influencer_lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["influencer-lists"] }),
  });

  return { ...listsQuery, createList, deleteList };
}

export function useListItems(listId: string | undefined) {
  const qc = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["list-items", listId],
    queryFn: async () => {
      if (!listId) throw new Error("No list id");
      const { data, error } = await supabase
        .from("list_items")
        .select("*")
        .eq("list_id", listId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!listId,
  });

  const addItem = useMutation({
    mutationFn: async (item: { list_id: string; username: string; platform: string; data: any }) => {
      const { data, error } = await supabase.from("list_items").insert(item).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["list-items", listId] });
      qc.invalidateQueries({ queryKey: ["influencer-lists"] });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("list_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["list-items", listId] });
      qc.invalidateQueries({ queryKey: ["influencer-lists"] });
    },
  });

  const removeItems = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("list_items").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["list-items", listId] });
      qc.invalidateQueries({ queryKey: ["influencer-lists"] });
    },
  });

  const updateNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from("list_items").update({ notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["list-items", listId] }),
  });

  return { ...itemsQuery, addItem, removeItem, removeItems, updateNotes };
}
