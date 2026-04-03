import { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Search, Play, Eye, ExternalLink, UserPlus, Megaphone, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ActivityItem {
  id: string;
  type: "search" | "campaign_event";
  description: string;
  icon: any;
  timestamp: string;
  meta?: { query?: string; platform?: string; location?: string };
}

const activityIcons: Record<string, any> = {
  search: Search,
  viewed_profile: Eye,
  added_to_list: UserPlus,
  campaign_created: Megaphone,
  report_exported: FileText,
  campaign_event: Megaphone,
};

export default function HistoryPage() {
  const { data: history, isLoading: historyLoading } = useSearchHistory();
  const { workspace } = useAuth();
  const navigate = useNavigate();

  const { data: campaignActivity, isLoading: activityLoading } = useQuery({
    queryKey: ["all-campaign-activity", workspace?.workspace_id],
    queryFn: async () => {
      if (!workspace) throw new Error("No workspace");
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id")
        .eq("workspace_id", workspace.workspace_id);
      if (!campaigns || campaigns.length === 0) return [];
      const ids = campaigns.map(c => c.id);
      const { data, error } = await supabase
        .from("campaign_activity")
        .select("*")
        .in("campaign_id", ids)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!workspace,
  });

  const isLoading = historyLoading || activityLoading;

  const timeline = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    // Search history
    (history || []).forEach(entry => {
      items.push({
        id: `search-${entry.id}`,
        type: "search",
        description: `Searched for '${entry.query}'`,
        icon: Search,
        timestamp: entry.created_at,
        meta: { query: entry.query, platform: entry.platform, location: entry.location || undefined }, // Added platform mappings
      });
    });

    // Campaign activity
    (campaignActivity || []).forEach(event => {
      items.push({
        id: `activity-${event.id}`,
        type: "campaign_event",
        description: event.action,
        icon: activityIcons[event.action] || Megaphone,
        timestamp: event.created_at,
      });
    });

    // Sort by timestamp descending
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.slice(0, 50);
  }, [history, campaignActivity]);

  const handleRerun = (item: ActivityItem) => {
    if (item.type !== "search" || !item.meta) return;
    const params = new URLSearchParams();
    if (item.meta.query) params.set("q", item.meta.query);
    if (item.meta.platform) params.set("platform", item.meta.platform);
    if (item.meta.location) params.set("city", item.meta.location);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">History</h1>
        <p className="text-sm text-muted-foreground mt-1">Your recent activity timeline</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-muted/10 animate-pulse h-16" />
          ))}
        </div>
      )}

      {!isLoading && timeline.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
          {timeline.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-start sm:items-center gap-4 p-4 rounded-xl hover:bg-muted/30 transition-colors group relative"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 sm:mt-0">
                  <Icon size={16} className="text-primary" strokeWidth={1.5} />
                </div>

                <div className="flex-1 min-w-0 pr-12 sm:pr-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
                  {item.meta?.platform && (
                    <p className="text-xs text-muted-foreground truncate capitalize">{item.meta.platform}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 absolute right-4 top-4 sm:static sm:right-auto sm:top-auto">
                  <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={12} strokeWidth={1.5} />
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </span>

                  {item.type === "search" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRerun(item)}
                    >
                      <Play size={14} strokeWidth={1.5} className="text-muted-foreground" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" disabled>
                      <ExternalLink size={14} strokeWidth={1.5} className="text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {!isLoading && timeline.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div className="flex flex-col items-center justify-center py-20 text-center bg-card/50 backdrop-blur-sm border border-white/50 shadow-sm rounded-2xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-foreground mb-1">No Activity Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Your activity timeline will appear here as you search, create campaigns, and manage lists.
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-1.5 rounded-lg" onClick={() => navigate("/search")}>
              <Search className="h-3.5 w-3.5" />
              Start Searching
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
