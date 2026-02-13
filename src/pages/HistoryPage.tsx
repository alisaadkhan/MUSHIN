import { motion } from "framer-motion";
import { Clock, Search, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

export default function HistoryPage() {
  const { data: history, isLoading } = useSearchHistory();
  const navigate = useNavigate();

  const handleRerun = (entry: any) => {
    const params = new URLSearchParams();
    if (entry.query) params.set("q", entry.query);
    if (entry.platform) params.set("platform", entry.platform);
    if (entry.location) params.set("location", entry.location);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search History</h1>
        <p className="text-muted-foreground mt-1">View and re-run your past searches</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="glass-card animate-pulse">
              <CardContent className="p-5 h-16" />
            </Card>
          ))}
        </div>
      )}

      {!isLoading && history && history.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {history.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="glass-card hover:border-primary/30 transition-colors">
                <CardContent className="p-5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{entry.query}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{entry.platform}</Badge>
                      {entry.location && <Badge variant="secondary" className="text-xs">{entry.location}</Badge>}
                      <span className="text-xs text-muted-foreground">
                        {entry.result_count} result{entry.result_count !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5 shrink-0" onClick={() => handleRerun(entry)}>
                    <Play className="h-3 w-3" />
                    Re-run
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {!isLoading && (!history || history.length === 0) && (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl aurora-gradient mb-4">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No Search History</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Your search history will appear here after you run your first search.
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => navigate("/search")}>
              <Search className="h-3.5 w-3.5" />
              Start Searching
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
