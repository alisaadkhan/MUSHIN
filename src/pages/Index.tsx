import { motion } from "framer-motion";
import { Search, Users, Bookmark, TrendingUp, ArrowRight, Zap, Clock, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router-dom";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useInfluencerLists } from "@/hooks/useInfluencerLists";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { formatDistanceToNow } from "date-fns";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function Index() {
  const { data: credits } = useWorkspaceCredits();
  const { data: history } = useSearchHistory(5);
  const { data: lists } = useInfluencerLists();
  const { data: savedSearches } = useSavedSearches();
  const navigate = useNavigate();

  const searchesThisMonth = history?.length ?? 0;
  const listsCount = lists?.length ?? 0;
  const savedSearchCount = savedSearches?.length ?? 0;
  const searchCredits = credits?.search_credits_remaining ?? 50;
  const enrichCredits = credits?.enrichment_credits_remaining ?? 10;
  const searchPct = ((50 - searchCredits) / 50) * 100;
  const enrichPct = ((10 - enrichCredits) / 10) * 100;

  const stats = [
    { label: "Searches This Month", value: String(searchesThisMonth), icon: Search },
    { label: "Profiles Enriched", value: "0", icon: Users },
    { label: "Lists Created", value: String(listsCount), icon: Users },
    { label: "Saved Searches", value: String(savedSearchCount), icon: Bookmark },
  ];

  const handleRerun = (entry: any) => {
    const params = new URLSearchParams();
    if (entry.query) params.set("q", entry.query);
    if (entry.platform) params.set("platform", entry.platform);
    if (entry.location) params.set("location", entry.location);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Find real influencers. Instantly.</p>
        </div>
        <Link to="/search">
          <Button className="btn-shine gap-2">
            <Search className="h-4 w-4" />
            New Search
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Card className="glass-card-hover">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold data-mono">{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Credits & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={item} initial="hidden" animate="show">
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Credit Usage</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Searches</span>
                    <span className="data-mono">{50 - searchCredits} / 50</span>
                  </div>
                  <Progress value={searchPct} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Enrichments</span>
                    <span className="data-mono">{10 - enrichCredits} / 10</span>
                  </div>
                  <Progress value={enrichPct} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item} initial="hidden" animate="show" className="lg:col-span-2">
          <Card className="glass-card overflow-hidden">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Quick Start</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link to="/search">
                  <div className="group flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/30 hover:bg-primary/5 cursor-pointer">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg aurora-gradient">
                      <Search className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Search Influencers</p>
                      <p className="text-xs text-muted-foreground">Discover creators by niche & city</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
                <Link to="/search?sample=true">
                  <div className="group flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:border-accent/30 hover:bg-accent/5 cursor-pointer">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                      <TrendingUp className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Try Sample Search</p>
                      <p className="text-xs text-muted-foreground">"Fashion blogger" in Karachi</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Searches */}
      <motion.div variants={item} initial="hidden" animate="show">
        <Card className="glass-card">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Recent Searches</h3>
            {history && history.length > 0 ? (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3 hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => handleRerun(entry)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{entry.query}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">{entry.platform}</Badge>
                          {entry.location && <span className="text-xs text-muted-foreground">{entry.location}</span>}
                          <span className="text-xs text-muted-foreground">{entry.result_count} results</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
                      <Play className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No searches yet. Start discovering influencers!</p>
                <Link to="/search" className="mt-3">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Search className="h-3.5 w-3.5" />
                    Run your first search
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
