import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trash2, ExternalLink, Instagram, Youtube, SlidersHorizontal, Search, Edit2, Check, X, Download, CheckSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useCampaigns } from "@/hooks/useCampaigns";
import { usePipelineStages, usePipelineCards } from "@/hooks/usePipelineCards";
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
  const { data: items, isLoading, removeItem, removeItems, updateNotes } = useListItems(id);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showAddToCampaign, setShowAddToCampaign] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [addingToCampaign, setAddingToCampaign] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: campaigns } = useCampaigns();
  const { data: stages } = usePipelineStages(selectedCampaignId || undefined);
  const { addCard } = usePipelineCards(selectedCampaignId || undefined);

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

  const allSelected = useMemo(
    () => !!items?.length && selectedIds.size === items.length,
    [items, selectedIds]
  );

  const toggleSelect = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items?.map((i) => i.id) || []));
    }
  };

  const handleDelete = async () => {
    if (!deleteItemId) return;
    try {
      await removeItem.mutateAsync(deleteItemId);
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(deleteItemId); return next; });
      toast({ title: "Removed from list" });
    } catch {
      toast({ title: "Failed to remove", variant: "destructive" });
    }
    setDeleteItemId(null);
  };

  const handleBulkDelete = async () => {
    try {
      await removeItems.mutateAsync(Array.from(selectedIds));
      toast({ title: `Removed ${selectedIds.size} influencer${selectedIds.size !== 1 ? "s" : ""}` });
      setSelectedIds(new Set());
    } catch {
      toast({ title: "Failed to remove", variant: "destructive" });
    }
    setShowBulkDelete(false);
  };

  const handleExportCSV = () => {
    if (!items) return;
    const toExport = selectedIds.size > 0 ? items.filter((i) => selectedIds.has(i.id)) : items;
    const headers = ["Username", "Platform", "Notes", "Profile Link", "Date Added"];
    const rows = toExport.map((item) => {
      const d = item.data as any;
      return [
        item.username,
        item.platform,
        (item.notes || "").replace(/"/g, '""'),
        d?.link || "",
        new Date(item.created_at).toLocaleDateString(),
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${list?.name || "list"}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${toExport.length} influencer${toExport.length !== 1 ? "s" : ""}` });
  };

  const handleAddToCampaign = async () => {
    if (!selectedCampaignId || !items || !stages?.length) return;
    setAddingToCampaign(true);
    const firstStage = stages[0];
    const selected = items.filter((i) => selectedIds.has(i.id));

    // 3.4 Duplicate detection
    const { data: existingCards } = await supabase
      .from("pipeline_cards")
      .select("username, platform")
      .eq("campaign_id", selectedCampaignId);
    const existingSet = new Set(
      (existingCards || []).map((c) => `${c.username}::${c.platform}`)
    );

    let added = 0;
    let skipped = 0;
    for (const item of selected) {
      const key = `${item.username}::${item.platform}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }
      try {
        await addCard.mutateAsync({
          stage_id: firstStage.id,
          campaign_id: selectedCampaignId,
          username: item.username,
          platform: item.platform,
          data: item.data,
          notes: item.notes || undefined,
        });
        added++;
        existingSet.add(key);
      } catch {
        // skip errors
      }
    }
    setAddingToCampaign(false);
    setShowAddToCampaign(false);
    setSelectedCampaignId("");
    const parts = [`Added ${added} influencer${added !== 1 ? "s" : ""}`];
    if (skipped > 0) parts.push(`skipped ${skipped} duplicate${skipped !== 1 ? "s" : ""}`);
    toast({ title: parts.join(", ") });
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
      <div className="flex items-center justify-between">
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
        {items && items.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={toggleSelectAll}>
              <CheckSquare className="h-3.5 w-3.5" />
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        )}
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
            const isSelected = selectedIds.has(item.id);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className={`glass-card transition-colors ${isSelected ? "border-primary/50 bg-primary/5" : ""}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(item.id)}
                          className="mt-0.5"
                        />
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

      {/* Floating bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <Card className="shadow-lg border-primary/20">
              <CardContent className="flex items-center gap-3 p-3">
                <span className="text-sm font-medium px-2">{selectedIds.size} selected</span>
                <Button variant="destructive" size="sm" className="text-xs gap-1.5" onClick={() => setShowBulkDelete(true)}>
                  <Trash2 className="h-3 w-3" />
                  Remove Selected
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleExportCSV}>
                  <Download className="h-3 w-3" />
                  Export CSV
                </Button>
                <Button variant="secondary" size="sm" className="text-xs gap-1.5" onClick={() => setShowAddToCampaign(true)}>
                  <Send className="h-3 w-3" />
                  Add to Campaign
                </Button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single delete dialog */}
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

      {/* Bulk delete dialog */}
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedIds.size} influencer{selectedIds.size !== 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to remove the selected influencers from this list?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove {selectedIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add to Campaign dialog */}
      <Dialog open={showAddToCampaign} onOpenChange={setShowAddToCampaign}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Campaign</DialogTitle>
            <DialogDescription>
              Add {selectedIds.size} selected influencer{selectedIds.size !== 1 ? "s" : ""} to a campaign pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCampaignId && stages && stages.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Influencers will be added to the <strong>{stages[0].name}</strong> stage.
              </p>
            )}
            {selectedCampaignId && stages && stages.length === 0 && (
              <p className="text-xs text-destructive">
                This campaign has no stages. Add a stage first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddToCampaign(false)}>Cancel</Button>
            <Button
              onClick={handleAddToCampaign}
              disabled={!selectedCampaignId || !stages?.length || addingToCampaign}
            >
              {addingToCampaign ? "Adding…" : `Add ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
