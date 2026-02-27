import { Users, Eye, TrendingUp, DollarSign, BarChart3, Clock, Megaphone } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

// Hardcoded for demo visualization in the chart
const roiChartData = [
  { day: 1, roi: 30 }, { day: 2, roi: 45 }, { day: 3, roi: 38 }, { day: 4, roi: 52 },
  { day: 5, roi: 60 }, { day: 6, roi: 48 }, { day: 7, roi: 55 }, { day: 8, roi: 70 },
  { day: 9, roi: 65 }, { day: 10, roi: 72 }, { day: 11, roi: 58 }, { day: 12, roi: 68 },
  { day: 13, roi: 75 }, { day: 14, roi: 62 }, { day: 15, roi: 78 }, { day: 16, roi: 85 },
  { day: 17, roi: 72 }, { day: 18, roi: 80 }, { day: 19, roi: 88 }, { day: 20, roi: 76 },
  { day: 21, roi: 82 }, { day: 22, roi: 90 }, { day: 23, roi: 78 }, { day: 24, roi: 86 },
  { day: 25, roi: 92 }, { day: 26, roi: 84 }, { day: 27, roi: 88 }, { day: 28, roi: 95 },
  { day: 29, roi: 90 }, { day: 30, roi: 98 },
];

const activity = [
  { action: "New creator added to Summer Launch", time: "2 min ago" },
  { action: "Campaign ROI updated: +12% from last week", time: "15 min ago" },
  { action: "Maya Kingston accepted collaboration", time: "1 hr ago" },
  { action: "Audience report generated for Q3 Brand Push", time: "3 hrs ago" },
  { action: "New IQ score calculated for 847 creators", time: "6 hrs ago" },
];

export default function Index() {
  const { profile, workspace } = useAuth();
  const wid = workspace?.workspace_id;

  const { data: campaigns } = useQuery({
    queryKey: ["dashboard-campaigns", wid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, status, budget, pipeline_cards(count)")
        .eq("workspace_id", wid!)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!wid,
  });

  const activeCreators = campaigns?.reduce((sum, c) => sum + (c.pipeline_cards?.[0]?.count ?? 0), 0) ?? 0;
  const totalBudget = campaigns?.reduce((sum, c) => sum + (c.budget || 0), 0) ?? 0;
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const metrics = [
    { icon: Users, label: "Active Creators", value: activeCreators.toLocaleString(), change: "+23%", positive: true },
    { icon: Eye, label: "Impressions", value: "4.2M", change: "+18%", positive: true },
    { icon: TrendingUp, label: "Avg. ROI", value: "847%", change: "+12%", positive: true },
    { icon: DollarSign, label: "Revenue", value: `$${(totalBudget / 1000).toFixed(0)}K`, change: "+8%", positive: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome back, {firstName}. Here's your overview.</p>
      </div>

      {/* Asymmetric grid: metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-5 hover:-translate-y-1 hover:shadow-md transition-all duration-300">
            <div className="flex items-center gap-2 mb-2">
              <m.icon size={18} className="text-primary" strokeWidth={1.5} />
              <span className="text-xs text-muted-foreground">{m.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground data-mono">{m.value}</p>
            <p className="text-xs text-green-500 mt-1">{m.change} this month</p>
          </div>
        ))}
      </div>

      {/* Asymmetric grid: ROI chart (col-span-2 row-span-2) + Activity */}
      <div className="grid lg:grid-cols-3 gap-4 auto-rows-[minmax(140px,auto)]">
        {/* ROI Chart - dominant */}
        <div className="lg:col-span-2 lg:row-span-2 bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-foreground">30-Day ROI Trend</p>
            <BarChart3 size={18} className="text-muted-foreground" strokeWidth={1.5} />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={roiChartData}>
              <defs>
                <linearGradient id="dashRoiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{ backgroundColor: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.5)", borderRadius: "12px", backdropFilter: "blur(8px)" }}
                labelStyle={{ color: "#6b7280", fontSize: 12 }}
              />
              <Area type="monotone" dataKey="roi" stroke="#7C3AED" fill="url(#dashRoiGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity */}
        <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-5 lg:row-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-foreground">Recent Activity</p>
            <Clock size={18} className="text-muted-foreground" strokeWidth={1.5} />
          </div>
          <ul className="space-y-3">
            {activity.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-foreground leading-snug">{a.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Campaigns - col-span-full */}
      {campaigns && campaigns.length > 0 && (
        <div className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-foreground">Active Campaigns</p>
            <Megaphone size={18} className="text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {campaigns.map((c) => (
              <Link to={`/campaigns/${c.id}`} key={c.id}>
                <div className="border border-white/50 bg-white/50 rounded-xl p-4 hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-serif text-sm font-medium text-foreground truncate mr-2">{c.name}</h4>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${c.status === "active" ? "bg-primary/10 text-primary" : c.status === "completed" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>{c.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1 data-mono">{c.pipeline_cards?.[0]?.count ?? 0} creators · ${(c.budget || 0).toLocaleString()}</p>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${c.status === 'completed' ? 100 : c.status === 'active' ? 45 : 0}%` }} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
