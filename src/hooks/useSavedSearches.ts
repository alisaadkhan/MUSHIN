import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useSavedSearches() {
  const { workspace } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["saved-searches", workspace?.workspace_id],
    queryFn: async () => {
      if (!workspace) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("saved_searches")
        .select("*")
        .eq("workspace_id", workspace.workspace_id)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Saved searches fetch error:", error);
        throw error;
      }
      return data;
    },
    enabled: !!workspace,
    staleTime: 5 * 60_000,
  });

  const saveSearch = useMutation({
    mutationFn: async ({ name, filters }: { name: string; filters: any }) => {
      if (!workspace) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("saved_searches")
        .insert({ name, filters, workspace_id: workspace.workspace_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches", workspace?.workspace_id] }),
  });

  const deleteSavedSearch = useMutation({
    mutationFn: async (id: string) => {
      if (!workspace) throw new Error("No workspace");
      const { error } = await supabase
        .from("saved_searches")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspace.workspace_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches", workspace?.workspace_id] }),
  });

  return { ...query, saveSearch, deleteSavedSearch };
}
