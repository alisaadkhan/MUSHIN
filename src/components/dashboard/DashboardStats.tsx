import { motion } from "framer-motion";
import { Users, Eye, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

interface DashboardStatsProps {
  activeCreators: number;
  totalBudget: number;
}

export function DashboardStats({ activeCreators, totalBudget }: DashboardStatsProps) {
  const stats = [
    { label: "Active Creators", value: activeCreators.toLocaleString(), icon: Users, trend: "+23%" },
    { label: "Impressions", value: "4.2M", icon: Eye, trend: "+18%" },
    { label: "Avg. ROI", value: "847%", icon: TrendingUp, trend: "+12%" },
    { label: "Revenue", value: `$${(totalBudget / 1000).toFixed(0)}K`, icon: DollarSign, trend: "+8%" },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <motion.div key={stat.label} variants={item}>
          <Card className="glass-card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold data-mono">{stat.value}</p>
                <span className="text-xs font-medium text-green-500 dark:text-green-400 mb-0.5">{stat.trend}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
