import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MushinCreditType = "search" | "ai" | "enrichment" | "email";

export type CreditBalance = {
  credit_type: MushinCreditType;
  balance: number;
  updated_at?: string | null;
};

export type CreditTransaction = {
  id: string;
  credit_type: MushinCreditType;
  kind: "debit" | "credit";
  amount: number;
  balance_before: number;
  balance_after: number;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type CreditCost = {
  action: string;
  credit_type: MushinCreditType;
  amount: number;
  enabled: boolean;
};

export function useCreditManager() {
  const { user, workspace } = useAuth();

  const balances = useQuery({
    queryKey: ["credits:v2:balances", user?.id, workspace?.workspace_id],
    enabled: !!user?.id && !!workspace?.workspace_id,
    staleTime: 15_000,
    queryFn: async (): Promise<CreditBalance[]> => {
      const { data, error } = await supabase.rpc("get_my_credit_balances", {
        p_workspace_id: workspace!.workspace_id,
      });
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const map = new Map<string, CreditBalance>();
      rows.forEach((r) => {
        map.set(String(r.credit_type), {
          credit_type: r.credit_type,
          balance: Number(r.balance ?? 0),
          updated_at: null,
        });
      });

      const ensure = (t: MushinCreditType) =>
        map.get(t) ?? { credit_type: t, balance: 0, updated_at: null };

      return [ensure("search"), ensure("ai"), ensure("enrichment"), ensure("email")];
    },
  });

  const transactions = useQuery({
    queryKey: ["credits:v2:transactions", user?.id, workspace?.workspace_id],
    enabled: !!user?.id && !!workspace?.workspace_id,
    staleTime: 10_000,
    queryFn: async (): Promise<CreditTransaction[]> => {
      const { data, error } = await supabase
        .from("credit_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("workspace_id", workspace!.workspace_id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const costs = useQuery({
    queryKey: ["credits:v2:costs"],
    staleTime: 60_000,
    queryFn: async (): Promise<CreditCost[]> => {
      const { data, error } = await supabase
        .from("credit_costs")
        .select("action, credit_type, amount, enabled")
        .order("action", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  return { balances, transactions, costs };
}

