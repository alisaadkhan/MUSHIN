import { useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, Trash2, Play, Clock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        <h1 className="font-serif text-2xl font-bold text-foreground">Saved Searches</h1>
        <p className="text-sm text-muted-foreground mt-1">Quickly re-run your favorite searches</p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white/50 backdrop-blur-sm border border-border/50 rounded-2xl p-5 h-20 animate-pulse" />
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
                className="bg-white/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-5 hover:-translate-y-1 hover:shadow-md transition-all duration-300 flex items-center gap-4"
              >
                <Bookmark size={18} className="text-primary flex-shrink-0" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{formatFilterDescription(filters)}</p>
                </div>
                <div className="flex items-center gap-2 lg:gap-4 flex-shrink-0">
                  <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={12} strokeWidth={1.5} />
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                  </div>
                  <Button variant="outline" size="sm" className="rounded-lg h-8" onClick={() => handleRerun(filters)}>
                    <Play size={14} strokeWidth={1.5} className="mr-1 hidden sm:inline-block" />
                    Run
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteId(s.id)}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {!isLoading && (!searches || searches.length === 0) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white/50 backdrop-blur-sm border border-white/50 shadow-sm rounded-2xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Bookmark className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-foreground mb-1">No Saved Searches</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              After searching for influencers, save your search to quickly re-run it later.
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-1.5 rounded-lg" onClick={() => navigate("/search")}>
              <Search className="h-3.5 w-3.5" />
              Start Searching
            </Button>
          </div>
        </motion.div>
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
