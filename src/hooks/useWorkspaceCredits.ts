import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useWorkspaceCredits() {
  const { workspace } = useAuth();

  const query = useQuery({
    queryKey: ["workspace-credits", workspace?.workspace_id],
    queryFn: async () => {
      if (!workspace) throw new Error("No workspace");
      // Legacy hook name preserved, but credits are now ledger-based.
      // Return the same shape as before so existing screens don't explode
      // while we migrate them, but the values come from the ledger.
      const { data, error } = await supabase.rpc("get_my_credit_balances", {
        p_workspace_id: workspace.workspace_id,
      });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const get = (t: string) => Number(rows.find((r) => r.credit_type === t)?.balance ?? 0);
      return {
        search_credits_remaining: get("search"),
        enrichment_credits_remaining: get("enrichment"),
        email_sends_remaining: get("email"),
        ai_credits_remaining: get("ai"),
        credits_reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        plan: "ledger",
      };
    },
    enabled: !!workspace,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  return query;
}
