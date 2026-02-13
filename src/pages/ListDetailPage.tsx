import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Trash2, ExternalLink, Instagram, Youtube, SlidersHorizontal, Search, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { useListItems } from "@/hooks/useInfluencerLists";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const platformColors: Record<string, string> = {
  instagram: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  tiktok: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  youtube: "bg-red-500/10 text-red-500 border-red-500/20",
};

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  tiktok: SlidersHorizontal,
  youtube: Youtube,
};

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: items, isLoading, removeItem, updateNotes } = useListItems(id);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const { toast } = useToast();

  const { data: list } = useQuery({
    queryKey: ["list-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("influencer_lists")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleDelete = async () => {
    if (!deleteItemId) return;
    try {
      await removeItem.mutateAsync(deleteItemId);
      toast({ title: "Removed from list" });
    } catch {
      toast({ title: "Failed to remove", variant: "destructive" });
    }
    setDeleteItemId(null);
  };

  const handleSaveNotes = async (itemId: string) => {
    try {
      await updateNotes.mutateAsync({ id: itemId, notes: notesValue });
      toast({ title: "Notes updated" });
    } catch {
      toast({ title: "Failed to update notes", variant: "destructive" });
    }
    setEditingNotes(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/lists">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{list?.name || "List"}</h1>
          <p className="text-muted-foreground mt-1">
            {items?.length ?? 0} influencer{(items?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="glass-card animate-pulse">
              <CardContent className="p-5 h-20" />
            </Card>
          ))}
        </div>
      )}

      {!isLoading && items && items.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {items.map((item, i) => {
            const itemData = item.data as any;
            const PlatformIcon = platformIcons[item.platform] || Search;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="glass-card">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                          <PlatformIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{itemData?.title || item.username}</p>
                          <p className="text-sm text-muted-foreground">{item.username}</p>
                          {editingNotes === item.id ? (
                            <div className="flex items-center gap-2 mt-2">
                              <Input
                                value={notesValue}
                                onChange={(e) => setNotesValue(e.target.value)}
                                placeholder="Add notes…"
                                className="h-8 text-xs"
                              />
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleSaveNotes(item.id)}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingNotes(null)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <p
                              className="text-xs text-muted-foreground mt-1 cursor-pointer hover:text-foreground"
                              onClick={() => { setEditingNotes(item.id); setNotesValue(item.notes || ""); }}
                            >
                              {item.notes || (
                                <span className="flex items-center gap-1 italic">
                                  <Edit2 className="h-3 w-3" /> Add notes
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-[10px] ${platformColors[item.platform] || ""}`}>
                          {item.platform}
                        </Badge>
                        {itemData?.link && (
                          <Button variant="outline" size="sm" className="text-xs gap-1.5" asChild>
                            <a href={itemData.link} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                              View
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteItemId(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {!isLoading && (!items || items.length === 0) && (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-1">No Influencers Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Search for influencers and add them to this list.
            </p>
            <Link to="/search" className="mt-4">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Search Influencers
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from list</AlertDialogTitle>
            <AlertDialogDescription>Remove this influencer from the list?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
