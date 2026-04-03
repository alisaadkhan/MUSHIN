import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useSearchHistory(limit = 50) {
  const { workspace } = useAuth();

  return useQuery({
    queryKey: ["search-history", workspace?.workspace_id, limit],
    queryFn: async () => {
      if (!workspace) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("search_history")
        .select("*")
        .eq("workspace_id", workspace.workspace_id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
    enabled: !!workspace,
    staleTime: 5 * 60_000,
  });
}
