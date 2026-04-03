import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";
import { PLANS, PlanKey } from "@/lib/plans";

interface SubscriptionData {
  subscribed: boolean;
  plan: PlanKey;
  product_id?: string;
  subscription_end?: string;
  cancel_at_period_end?: boolean;
}

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async (): Promise<SubscriptionData> => {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return {
        subscribed: data.subscribed ?? false,
        plan: (data.plan as PlanKey) || "free",
        product_id: data.product_id,
        subscription_end: data.subscription_end,
        cancel_at_period_end: data.cancel_at_period_end,
      };
    },
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const checkout = useCallback(async (priceId: string) => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (data?.url) window.open(data.url, "_blank", "noopener,noreferrer");
  }, []);

  const openPortal = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("customer-portal");
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (data?.url) window.open(data.url, "_blank", "noopener,noreferrer");
  }, []);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["subscription"] });
  }, [queryClient]);

  const plan = query.data?.plan || "free";
  const planConfig = PLANS[plan] || PLANS.free;

  return {
    ...query,
    plan,
    planConfig,
    subscribed: query.data?.subscribed ?? false,
    subscriptionEnd: query.data?.subscription_end,
    cancelAtPeriodEnd: query.data?.cancel_at_period_end,
    isPro: plan === "pro" || plan === "business",
    isBusiness: plan === "business",
    checkout,
    openPortal,
    refresh,
  };
}
