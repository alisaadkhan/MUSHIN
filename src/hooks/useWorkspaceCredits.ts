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
        .select("search_credits_remaining, enrichment_credits_remaining, credits_reset_at, plan, email_sends_remaining, ai_credits_remaining")
        .eq("id", workspace.workspace_id)
        .single();
      if (error) throw error;
      return data as {
        search_credits_remaining: number;
        enrichment_credits_remaining: number;
        credits_reset_at: string;
        plan: string;
        email_sends_remaining: number;
        ai_credits_remaining: number;
      };
    },
    enabled: !!workspace,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
