import { useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, Trash2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSavedSearches } from "@/hooks/useSavedSearches";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

export default function SavedSearchesPage() {
  const { data: searches, isLoading, deleteSavedSearch } = useSavedSearches();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSavedSearch.mutateAsync(deleteId);
      toast({ title: "Saved search deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
    setDeleteId(null);
  };

  const handleRerun = (filters: any) => {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.platform) params.set("platform", filters.platform);
    if (filters.location) params.set("location", filters.location);
    navigate(`/search?${params.toString()}`);
  };

  const formatFilterDescription = (filters: any) => {
    const parts: string[] = [];
    if (filters?.platform) parts.push(filters.platform.charAt(0).toUpperCase() + filters.platform.slice(1));
    if (filters?.query) parts.push(filters.query);
    if (filters?.location && filters.location !== "All Pakistan") parts.push(filters.location);
    return parts.join(" · ") || "No filters";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Saved Searches</h1>
        <p className="text-muted-foreground mt-1">Quickly re-run your favorite searches</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="glass-card animate-pulse">
              <CardContent className="p-5 h-16" />
            </Card>
          ))}
        </div>
      )}

      {!isLoading && searches && searches.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {searches.map((s, i) => {
            const filters = s.filters as any;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="glass-card hover:border-primary/30 transition-colors">
                  <CardContent className="p-5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatFilterDescription(filters)}</p>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => handleRerun(filters)}>
                        <Play className="h-3 w-3" />
                        Run
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {!isLoading && (!searches || searches.length === 0) && (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl aurora-gradient mb-4">
              <Bookmark className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No Saved Searches</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              After searching for influencers, save your search to quickly re-run it later.
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Saved Search</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
