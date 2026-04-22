import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SupportPermissions = {
  tier: "L1" | "L2" | "admin_support" | null;
  canUserLookup?: boolean;
  canViewTickets?: boolean;
  canAssignTickets?: boolean;
  canWriteInternalNotes?: boolean;
  canViewActivityLogs?: boolean;
  canViewSessions?: boolean;
  canViewBilling?: boolean;
  canApplyCredits?: boolean;
  canImpersonate?: boolean;
};

export function useSupportPermissions() {
  return useQuery<SupportPermissions>({
    queryKey: ["support-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_support_permissions");
      if (error) throw error;
      return (data ?? { tier: null }) as SupportPermissions;
    },
    staleTime: 30_000,
    retry: false,
  });
}

