import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { ROITrendChart } from "@/components/dashboard/ROITrendChart";
import { ActiveCampaignsTable } from "@/components/dashboard/ActiveCampaignsTable";

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

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

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {firstName}. Here's your overview.</p>
        </div>
        <Link to="/search">
          <Button className="btn-shine gap-2">
            <Search className="h-4 w-4" />
            New Search
          </Button>
        </Link>
      </div>

      <DashboardStats activeCreators={activeCreators} totalBudget={totalBudget} />

      <motion.div variants={item} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity />
        <ROITrendChart />
      </motion.div>

      <motion.div variants={item} initial="hidden" animate="show">
        <ActiveCampaignsTable campaigns={campaigns} />
      </motion.div>
    </div>
  );
}
