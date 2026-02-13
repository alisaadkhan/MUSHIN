import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useWorkspaceCredits() {
  const { workspace } = useAuth();

  return useQuery({
    queryKey: ["workspace-credits", workspace?.workspace_id],
    queryFn: async () => {
      if (!workspace) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("workspaces")
        .select("search_credits_remaining, enrichment_credits_remaining, credits_reset_at")
        .eq("id", workspace.workspace_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!workspace,
  });
}
