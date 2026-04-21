import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeAuthed } from "@/lib/edge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const PLAN_PRICE_PKR: Record<string, number> = {
  pro: 4999,
  business: 14999,
  enterprise: 39999,
};

type PaddleSubRow = {
  user_id: string;
  plan_name: string;
  status: string;
  current_period_end: string | null;
};

export default function AdminRevenue() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-revenue"],
    queryFn: async () => {
      const [subsRes, userList] = await Promise.all([
        supabase
          .from("paddle_subscriptions")
          .select("user_id,plan_name,status,current_period_end")
          .order("updated_at", { ascending: false }),
        invokeEdgeAuthed<{ users: Array<{ id: string; email: string | null }> }>("admin-list-users"),
      ]);

      if (subsRes.error) throw subsRes.error;
      if (userList.error) throw userList.error;

      const emailByUser: Record<string, string> = {};
      for (const u of userList.data?.users ?? []) {
        if (u?.id && u?.email) emailByUser[u.id] = u.email;
      }

      const subs = (subsRes.data ?? []) as PaddleSubRow[];
      const active = subs.filter((s) => String(s.status).toLowerCase() === "active");

      const byPlan: Record<string, number> = {};
      for (const s of active) {
        const k = String(s.plan_name ?? "unknown").toLowerCase();
        byPlan[k] = (byPlan[k] ?? 0) + 1;
      }

      const mrrPkr = Object.entries(byPlan).reduce((sum, [plan, count]) => {
        const price = PLAN_PRICE_PKR[plan] ?? 0;
        return sum + price * count;
      }, 0);

      return {
        activeCount: active.length,
        byPlan,
        mrrPkr,
        subs: active.map((s) => ({
          ...s,
          email: emailByUser[s.user_id] ?? null,
        })),
      };
    },
    staleTime: 20_000,
    refetchInterval: 20_000,
  });

  const chartData = useMemo(() => {
    const byPlan = data?.byPlan ?? {};
    return Object.entries(byPlan).map(([plan, count]) => ({
      plan,
      count,
      price: PLAN_PRICE_PKR[plan] ?? 0,
      mrr: (PLAN_PRICE_PKR[plan] ?? 0) * count,
    }));
  }, [data]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Revenue</h1>
        <p className="text-muted-foreground">
          Real-time subscription revenue (estimated MRR from active plans)
        </p>
      </div>

      {error ? (
        <div className="glass-card rounded-2xl p-6 text-sm text-red-300">
          {(error as any)?.message ?? "Failed to load revenue"}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl p-6">
              <div className="text-sm text-muted-foreground">Active subscriptions</div>
              <div className="text-3xl font-bold text-foreground mt-2">
                {isLoading ? "—" : data?.activeCount ?? 0}
              </div>
            </div>
            <div className="glass-card rounded-2xl p-6">
              <div className="text-sm text-muted-foreground">Estimated MRR (PKR)</div>
              <div className="text-3xl font-bold text-foreground mt-2">
                {isLoading ? "—" : (data?.mrrPkr ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">Active subs by plan</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="plan" stroke="rgba(255,255,255,0.45)" fontSize={12} />
                  <YAxis stroke="rgba(255,255,255,0.45)" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(0,0,0,0.85)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      color: "white",
                    }}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

