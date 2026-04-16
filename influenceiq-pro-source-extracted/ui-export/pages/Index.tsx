import { useMemo } from "react";
import { Users, Eye, TrendingUp, DollarSign } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const S = { surface:"rgba(255,255,255,0.03)", border:"rgba(255,255,255,0.08)", borderStrong:"rgba(168,85,247,0.35)", purple:"#A855F7", purpleDim:"rgba(168,85,247,0.12)", purpleGlow:"0 0 28px rgba(168,85,247,0.22)", text:"rgba(255,255,255,0.92)", muted:"rgba(255,255,255,0.38)", green:"#22C55E" };
const card = { background: S.surface, border: `1px solid ${S.border}`, borderRadius: 16 };

export default function Index() {
  const { profile, workspace } = useAuth();
  const wid = workspace?.workspace_id;

  const { data: campaigns } = useQuery({
    queryKey: ["dashboard-campaigns", wid],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("id,name,status,budget,pipeline_cards(count)").eq("workspace_id", wid!).order("updated_at", { ascending: false }).limit(10);
      if (error) throw error; return data;
    },
    enabled: !!wid,
  });

  const { data: recentActivity } = useQuery({
    queryKey: ["dashboard-activity", wid],
    queryFn: async () => {
      const { data } = await supabase.from("credits_usage").select("action_type, amount, created_at").eq("workspace_id", wid!).order("created_at", { ascending: false }).limit(8);
      return data || [];
    },
    enabled: !!wid,
  });

  const { data: creditsUsage } = useQuery({
    queryKey: ["dashboard-credits-trend", wid],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { data } = await supabase.from("credits_usage").select("amount, created_at").eq("workspace_id", wid!).gte("created_at", since.toISOString()).order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!wid,
  });

  const activeCreators = campaigns?.reduce((sum, c) => sum + (c.pipeline_cards?.[0]?.count ?? 0), 0) ?? 0;
  const totalBudget = campaigns?.reduce((sum, c) => sum + (c.budget || 0), 0) ?? 0;
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const activityTrend = useMemo(() => {
    const map: Record<number, number> = {};
    (creditsUsage || []).forEach((row) => {
      const key = new Date(row.created_at).getDate();
      map[key] = (map[key] || 0) + Math.abs(row.amount);
    });
    return Array.from({ length: 30 }, (_, i) => ({ day: i + 1, activity: map[i + 1] || 0 }));
  }, [creditsUsage]);

  const hasActivity = activityTrend.some((d) => d.activity > 0);
  const totalEvents = creditsUsage?.length ?? 0;

  const metrics = [
    { icon: Users, label: "Active Creators", value: activeCreators > 0 ? activeCreators.toLocaleString() : "—", glow: true },
    { icon: DollarSign, label: "Campaign Budget", value: totalBudget > 0 ? `$${(totalBudget / 1000).toFixed(1)}K` : "—", glow: false },
    { icon: TrendingUp, label: "Campaigns", value: campaigns ? campaigns.length.toString() : "—", glow: false },
    { icon: Eye, label: "Credit Events (30d)", value: totalEvents > 0 ? totalEvents.toString() : "—", glow: false },
  ];
  const sClr: Record<string, string> = { active: "#22C55E", draft: "#F59E0B", completed: "#3B82F6" };
  const sBg: Record<string, string> = { active: "rgba(34,197,94,0.1)", draft: "rgba(245,158,11,0.1)", completed: "rgba(59,130,246,0.1)" };

  function formatAction(type: string) {
    const map: Record<string, string> = { search: "Search performed", enrich: "Creator enriched", ai_insight: "AI insight generated", email_send: "Outreach email sent", evaluate: "Creator evaluated" };
    return map[type] || type.replace(/_/g, " ");
  }
  function timeAgo(iso: string) {
    const d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 60) return `${Math.round(d)}s ago`;
    if (d < 3600) return `${Math.round(d / 60)}m ago`;
    if (d < 86400) return `${Math.round(d / 3600)}h ago`;
    return `${Math.round(d / 86400)}d ago`;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:21, fontWeight:800, color:S.text, letterSpacing:"-0.01em" }}>Dashboard</h1>
          <p style={{ fontSize:13, color:S.muted, marginTop:2 }}>Welcome back, {firstName}. Here's your overview.</p>
        </div>
        <Link to="/search"><button style={{ padding:"8px 16px", background:S.purple, border:"none", borderRadius:9, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:"0 0 16px rgba(168,85,247,0.3)" }}>+ Discover Creators</button></Link>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div key={m.label} style={{ ...card, padding: "20px 22px", boxShadow: m.glow ? S.purpleGlow : "none", border: m.glow ? `1px solid ${S.borderStrong}` : `1px solid ${S.border}`, position: "relative", overflow: "hidden" }}>
            {m.glow && <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: "radial-gradient(circle, rgba(168,85,247,0.18), transparent 70%)", pointerEvents: "none" }} />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: S.muted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.07em" }}>{m.label}</span>
              <m.icon size={15} style={{ color: m.glow ? S.purple : S.muted, opacity: m.glow ? 1 : 0.5 }} strokeWidth={1.5} />
            </div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, color: S.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Activity chart + Recent events */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div style={{ ...card, padding: "20px 22px" }} className="lg:col-span-2">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div><div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>Platform Activity</div><div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>Credit events · last 30 days</div></div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: S.purple }}>{totalEvents}</div>
          </div>
          {hasActivity ? (
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={activityTrend} margin={{ top: 4, right: 4, bottom: 0, left: -30 }}>
                <defs><linearGradient id="actg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#A855F7" stopOpacity={0.25} /><stop offset="95%" stopColor="#A855F7" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="activity" stroke="#A855F7" strokeWidth={1.8} fill="url(#actg)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, color: S.muted }}>No activity yet — start searching to see data here</span>
            </div>
          )}
        </div>
        <div style={{ ...card, padding: "20px 22px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 16 }}>Recent Activity</div>
          <div className="space-y-3.5">
            {recentActivity && recentActivity.length > 0 ? recentActivity.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: S.purple, marginTop: 6, flexShrink: 0 }} />
                <div><div style={{ fontSize: 11, color: S.text, lineHeight: 1.4 }}>{formatAction(a.action_type)}</div><div style={{ fontSize: 10, color: S.muted, marginTop: 1 }}>{timeAgo(a.created_at)}</div></div>
              </div>
            )) : <div style={{ fontSize: 11, color: S.muted, textAlign: "center", paddingTop: 16 }}>No recent activity yet</div>}
          </div>
        </div>
      </div>

      {/* Campaigns table */}
      {campaigns && campaigns.length > 0 && (
        <div style={{ ...card, overflow:"hidden" }}>
          <div style={{ padding:"16px 20px", borderBottom:`1px solid ${S.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:13, fontWeight:600, color:S.text }}>Active Campaigns</span>
            <Link to="/campaigns"><button style={{ padding:"6px 14px", background:S.purple, border:"none", borderRadius:8, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>+ New Campaign</button></Link>
          </div>
          <div className="overflow-x-auto">
            <div style={{ minWidth: 340 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 80px 90px", padding: "8px 20px", fontSize:9, fontWeight:700, color:S.muted, textTransform:"uppercase", letterSpacing:"0.08em", borderBottom:`1px solid ${S.border}` }}>
                <span>Campaign</span><span>Status</span><span>Creators</span><span>Budget</span>
              </div>
              {campaigns.map((c,i) => (
                <Link to={`/campaigns/${c.id}`} key={c.id}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 80px 90px", padding: "11px 20px", alignItems:"center", borderBottom: i < campaigns.length-1 ? `1px solid ${S.border}` : "none", fontSize:13, cursor:"pointer" }}>
                    <span style={{ color:S.text, fontWeight:500 }}>{c.name}</span>
                    <span><span style={{ padding:"2px 8px", borderRadius:6, fontSize:9, fontWeight:700, background: sBg[c.status as keyof typeof sBg] || S.surface, color: sClr[c.status as keyof typeof sClr] || S.muted }}>{c.status}</span></span>
                    <span style={{ color:S.muted }}>{c.pipeline_cards?.[0]?.count ?? 0}</span>
                    <span style={{ color: S.muted }}>${((c.budget || 0) / 1000).toFixed(1)}K</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
