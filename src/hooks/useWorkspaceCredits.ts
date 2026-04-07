import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { trackEvent } from "@/lib/analytics";
import { useEffect, useRef } from "react";

export function useWorkspaceCredits() {
  const { workspace } = useAuth();
  const previousCredits = useRef<number | null>(null);

  const query = useQuery({
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

  // Track when credits drop significantly (indicating usage)
  useEffect(() => {
    if (query.data && previousCredits.current !== null) {
      const current = query.data.search_credits_remaining;
      const previous = previousCredits.current;
      
      // If credits dropped by more than 10%, track it
      if (current < previous * 0.9) {
        trackEvent("credits_used", {
          creditsRemaining: current,
          creditsUsed: previous - current,
          plan: query.data.plan
        });
      }
    }
    
    if (query.data) {
      previousCredits.current = query.data.search_credits_remaining;
    }
  }, [query.data]);

  return query;
}
