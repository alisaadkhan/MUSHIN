import { useQuery } from "@tanstack/react-query";
import { invokeEdgeAuthed } from "@/lib/edge";

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
      const { data, error } = await invokeEdgeAuthed<{ permissions: SupportPermissions }>("support-permissions", {
        body: {},
      } as any);
      if (error) throw error;
      return ((data as any)?.permissions ?? { tier: null }) as SupportPermissions;
    },
    staleTime: 30_000,
    retry: false,
  });
}

