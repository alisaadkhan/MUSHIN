import { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Users, MoreHorizontal, Trash2, Pencil, GripVertical, Palette, Search, Instagram, Youtube, SlidersHorizontal, CheckSquare, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { KanbanCard } from "./KanbanCard";
import { CardDetailDialog } from "./CardDetailDialog";
import { SendEmailDialog } from "./SendEmailDialog";
import { usePipelineStages, usePipelineCards } from "@/hooks/usePipelineCards";
import { useCampaignActivity } from "@/hooks/useCampaignActivity";
import { useOutreachLog } from "@/hooks/useOutreachLog";
import { useToast } from "@/hooks/use-toast";

const STAGE_COLORS = [
  "#6366f1", "#f59e0b", "#3b82f6", "#22c55e",
  "#a855f7", "#ec4899", "#ef4444", "#06b6d4",
  "#f97316", "#6b7280",
];

const PLATFORM_FILTERS = [
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "tiktok", label: "TikTok", icon: SlidersHorizontal },
  { key: "youtube", label: "YouTube", icon: Youtube },
];

interface KanbanBoardProps {
  campaignId: string;
  campaignName?: string;
  workspaceSettings?: any;
}

export function KanbanBoard({ campaignId, campaignName, workspaceSettings }: KanbanBoardProps) {
  const { data: stages, addStage, updateStage, deleteStage, reorderStages } = usePipelineStages(campaignId);
  const { data: cards, moveCard, updateCard, removeCard } = usePipelineCards(campaignId);
  const { logActivity } = useCampaignActivity(campaignId);
  const { outreachEntries, logOutreach, isContacted } = useOutreachLog(campaignId);
  const [editingCard, setEditingCard] = useState<any>(null);
  const [emailCard, setEmailCard] = useState<any>(null);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragStageId, setDragStageId] = useState<string | null>(null);
  const [renamingStageId, setRenamingStageId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmStageId, setDeleteConfirmStageId] = useState<string | null>(null);
  const [colorPickerStageId, setColorPickerStageId] = useState<string | null>(null);
  const [showAddStage, setShowAddStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // 3.5 Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilters, setPlatformFilters] = useState<Set<string>>(new Set());

  // 3.6 Bulk select
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [bulkMoveStageId, setBulkMoveStageId] = useState<string>("");

  const togglePlatformFilter = (platform: string) => {
    setPlatformFilters((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  };

  const filteredCardsByStage = useCallback(
    (stageId: string) => {
      let stageCards = cards?.filter((c) => c.stage_id === stageId) || [];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        stageCards = stageCards.filter((c) => {
          const d = c.data as any;
          return c.username.toLowerCase().includes(q) || (d?.title && d.title.toLowerCase().includes(q));
        });
      }
      if (platformFilters.size > 0) {
        stageCards = stageCards.filter((c) => platformFilters.has(c.platform));
      }
      return stageCards;
    },
    [cards, searchQuery, platformFilters]
  );

  const totalCards = cards?.length || 0;
  const filteredTotal = useMemo(() => {
    if (!stages) return 0;
    return stages.reduce((sum, s) => sum + filteredCardsByStage(s.id).length, 0);
  }, [stages, filteredCardsByStage]);

  const isFiltering = searchQuery || platformFilters.size > 0;

  const toggleCardSelect = (id: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDrop = async (stageId: string, e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("drag-type");
    if (type === "stage") {
      if (!dragStageId || !stages) return;
      const fromIdx = stages.findIndex((s) => s.id === dragStageId);
      const toIdx = stages.findIndex((s) => s.id === stageId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
        setDragStageId(null);
        return;
      }
      const reordered = [...stages];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      try {
        await reorderStages.mutateAsync(reordered.map((s) => s.id));
      } catch {
        toast({ title: "Failed to reorder stages", variant: "destructive" });
      }
      setDragStageId(null);
      return;
    }
    if (!dragCardId) return;
    const stageCards = filteredCardsByStage(stageId);
    const card = cards?.find((c) => c.id === dragCardId);
    const fromStage = stages?.find((s) => s.id === card?.stage_id);
    const toStage = stages?.find((s) => s.id === stageId);
    try {
      await moveCard.mutateAsync({ cardId: dragCardId, stageId, position: stageCards.length });
      if (fromStage && toStage && fromStage.id !== toStage.id) {
        logActivity.mutate({ action: "card_moved", details: { username: card?.username, from_stage: fromStage.name, to_stage: toStage.name } });
        // Auto-log outreach when moved to "Contacted" stage
        if (toStage.name.toLowerCase() === "contacted" && card) {
          logOutreach.mutate({ campaign_id: campaignId, card_id: card.id, username: card.username, platform: card.platform });
          logActivity.mutate({ action: "influencer_contacted", details: { username: card.username } });
        }
      }
    } catch {
      toast({ title: "Failed to move card", variant: "destructive" });
    }
    setDragCardId(null);
  };

  const handleMoveCard = async (cardId: string, stageId: string) => {
    const card = cards?.find((c) => c.id === cardId);
    const fromStage = stages?.find((s) => s.id === card?.stage_id);
    const toStage = stages?.find((s) => s.id === stageId);
    try {
      await moveCard.mutateAsync({ cardId, stageId, position: 0 });
      if (fromStage && toStage && fromStage.id !== toStage.id) {
        logActivity.mutate({ action: "card_moved", details: { username: card?.username, from_stage: fromStage.name, to_stage: toStage.name } });
        if (toStage.name.toLowerCase() === "contacted" && card) {
          logOutreach.mutate({ campaign_id: campaignId, card_id: card.id, username: card.username, platform: card.platform });
          logActivity.mutate({ action: "influencer_contacted", details: { username: card.username } });
        }
      }
      toast({ title: "Card moved" });
    } catch {
      toast({ title: "Failed to move", variant: "destructive" });
    }
  };

  const handleSaveCard = async (id: string, values: { notes?: string; agreed_rate?: number }) => {
    try {
      await updateCard.mutateAsync({ id, ...values });
      toast({ title: "Card updated" });
      const card = cards?.find((c) => c.id === id);
      logActivity.mutate({ action: "card_updated", details: { username: card?.username } });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleRemoveCard = async (id: string) => {
    const card = cards?.find((c) => c.id === id);
    try {
      await removeCard.mutateAsync(id);
      toast({ title: "Removed from pipeline" });
      logActivity.mutate({ action: "card_removed", details: { username: card?.username } });
    } catch {
      toast({ title: "Failed to remove", variant: "destructive" });
    }
  };

  const handleRenameStage = async (stageId: string) => {
    if (!renameValue.trim()) {
      setRenamingStageId(null);
      return;
    }
    const stage = stages?.find((s) => s.id === stageId);
    try {
      await updateStage.mutateAsync({ id: stageId, name: renameValue.trim() });
      toast({ title: "Stage renamed" });
      logActivity.mutate({ action: "stage_renamed", details: { from: stage?.name, to: renameValue.trim() } });
    } catch {
      toast({ title: "Failed to rename", variant: "destructive" });
    }
    setRenamingStageId(null);
  };

  const handleDeleteStage = async () => {
    if (!deleteConfirmStageId) return;
    const rawCards = cards?.filter((c) => c.stage_id === deleteConfirmStageId) || [];
    if (rawCards.length > 0) {
      toast({ title: "Cannot delete", description: "Remove all cards from this stage first.", variant: "destructive" });
      setDeleteConfirmStageId(null);
      return;
    }
    const stage = stages?.find((s) => s.id === deleteConfirmStageId);
    try {
      await deleteStage.mutateAsync(deleteConfirmStageId);
      toast({ title: "Stage deleted" });
      logActivity.mutate({ action: "stage_deleted", details: { name: stage?.name } });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
    setDeleteConfirmStageId(null);
  };

  const handleAddStage = async () => {
    if (!newStageName.trim()) return;
    try {
      await addStage.mutateAsync({ name: newStageName.trim() });
      toast({ title: "Stage added" });
      logActivity.mutate({ action: "stage_created", details: { name: newStageName.trim() } });
      setNewStageName("");
      setShowAddStage(false);
    } catch {
      toast({ title: "Failed to add stage", variant: "destructive" });
    }
  };

  // 3.6 Bulk actions
  const handleBulkMove = async () => {
    if (!bulkMoveStageId || selectedCardIds.size === 0) return;
    let moved = 0;
    for (const cardId of selectedCardIds) {
      try {
        await moveCard.mutateAsync({ cardId, stageId: bulkMoveStageId, position: moved });
        moved++;
      } catch {
        // skip
      }
    }
    const toStage = stages?.find((s) => s.id === bulkMoveStageId);
    toast({ title: `Moved ${moved} card${moved !== 1 ? "s" : ""} to ${toStage?.name}` });
    logActivity.mutate({ action: "bulk_move", details: { count: moved, to_stage: toStage?.name } });
    setSelectedCardIds(new Set());
    setBulkMoveStageId("");
  };

  const handleBulkRemove = async () => {
    let removed = 0;
    for (const cardId of selectedCardIds) {
      try {
        await removeCard.mutateAsync(cardId);
        removed++;
      } catch {
        // skip
      }
    }
    toast({ title: `Removed ${removed} card${removed !== 1 ? "s" : ""}` });
    logActivity.mutate({ action: "bulk_remove", details: { count: removed } });
    setSelectedCardIds(new Set());
  };

  if (!stages) return null;

  return (
    <>
      {/* 3.5 Filter Toolbar */}
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search influencers…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          {PLATFORM_FILTERS.map(({ key, label, icon: Icon }) => (
            <Toggle
              key={key}
              size="sm"
              pressed={platformFilters.has(key)}
              onPressedChange={() => togglePlatformFilter(key)}
              className="h-8 px-2.5 text-xs gap-1"
            >
              <Icon className="h-3 w-3" />
              {label}
            </Toggle>
          ))}
        </div>
        {isFiltering && (
          <span className="text-xs text-muted-foreground">
            {filteredTotal} of {totalCards} influencers
          </span>
        )}
        <div className="ml-auto">
          <Toggle
            size="sm"
            pressed={selectMode}
            onPressedChange={(pressed) => {
              setSelectMode(pressed);
              if (!pressed) setSelectedCardIds(new Set());
            }}
            className="h-8 px-2.5 text-xs gap-1"
          >
            <CheckSquare className="h-3 w-3" />
            Select
          </Toggle>
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max">
          {stages.map((stage) => {
            const stageCards = filteredCardsByStage(stage.id);
            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-72 shrink-0"
              >
                <div
                  className="rounded-lg border border-border bg-muted/30 p-3 min-h-[400px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(stage.id, e)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <div
                        className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("drag-type", "stage");
                          setDragStageId(stage.id);
                        }}
                        onDragEnd={() => setDragStageId(null)}
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                      </div>
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                      {renamingStageId === stage.id ? (
                        <Input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameStage(stage.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameStage(stage.id);
                            if (e.key === "Escape") setRenamingStageId(null);
                          }}
                          className="h-6 text-sm font-semibold px-1"
                          autoFocus
                        />
                      ) : (
                        <h3 className="text-sm font-semibold truncate">{stage.name}</h3>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {stageCards.length}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setRenamingStageId(stage.id);
                            setRenameValue(stage.name);
                          }}>
                            <Pencil className="h-3 w-3 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setColorPickerStageId(stage.id)}>
                            <Palette className="h-3 w-3 mr-2" />
                            Change Color
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteConfirmStageId(stage.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {stageCards.map((card) => (
                      <KanbanCard
                        key={card.id}
                        card={card}
                        onEdit={() => setEditingCard(card)}
                        draggable={!selectMode}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("drag-type", "card");
                          setDragCardId(card.id);
                        }}
                        selectable={selectMode}
                        selected={selectedCardIds.has(card.id)}
                        onSelect={toggleCardSelect}
                        contacted={isContacted(card.id)}
                        onSendEmail={() => setEmailCard(card)}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Add Stage Column */}
          <div className="w-72 shrink-0">
            {showAddStage ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/10 p-3 space-y-2">
                <Input
                  placeholder="Stage name"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddStage();
                    if (e.key === "Escape") { setShowAddStage(false); setNewStageName(""); }
                  }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddStage} disabled={!newStageName.trim()}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowAddStage(false); setNewStageName(""); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-12 border-dashed gap-2 text-muted-foreground"
                onClick={() => setShowAddStage(true)}
              >
                <Plus className="h-4 w-4" />
                Add Stage
              </Button>
            )}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* 3.6 Bulk action bar */}
      <AnimatePresence>
        {selectMode && selectedCardIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <Card className="shadow-lg border-primary/20">
              <CardContent className="flex items-center gap-3 p-3">
                <span className="text-sm font-medium px-2">{selectedCardIds.size} selected</span>
                <Select value={bulkMoveStageId} onValueChange={setBulkMoveStageId}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue placeholder="Move to…" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="text-xs gap-1" disabled={!bulkMoveStageId} onClick={handleBulkMove}>
                  <ArrowRight className="h-3 w-3" />
                  Move
                </Button>
                <Button variant="destructive" size="sm" className="text-xs gap-1" onClick={handleBulkRemove}>
                  <Trash2 className="h-3 w-3" />
                  Remove
                </Button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedCardIds(new Set())}>
                  <X className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <CardDetailDialog
        card={editingCard}
        open={!!editingCard}
        onOpenChange={(open) => !open && setEditingCard(null)}
        onSave={handleSaveCard}
        onRemove={handleRemoveCard}
        stages={stages}
        onMove={handleMoveCard}
        outreachEntries={outreachEntries}
        campaignId={campaignId}
        campaignName={campaignName}
        defaultFromName={workspaceSettings?.default_from_name}
        defaultReplyTo={workspaceSettings?.default_reply_to}
      />

      {emailCard && (
        <SendEmailDialog
          open={!!emailCard}
          onOpenChange={(open) => !open && setEmailCard(null)}
          card={emailCard}
          campaignId={campaignId}
          campaignName={campaignName}
          defaultFromName={workspaceSettings?.default_from_name}
          defaultReplyTo={workspaceSettings?.default_reply_to}
        />
      )}

      <AlertDialog open={!!deleteConfirmStageId} onOpenChange={(open) => !open && setDeleteConfirmStageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage?</AlertDialogTitle>
            <AlertDialogDescription>
              This stage will be permanently removed. Cards must be moved or removed first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStage}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stage Color Picker */}
      <Popover open={!!colorPickerStageId} onOpenChange={(open) => !open && setColorPickerStageId(null)}>
        <PopoverTrigger asChild>
          <span className="hidden" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="center" side="bottom">
          <p className="text-xs font-medium mb-2 text-muted-foreground">Pick a color</p>
          <div className="grid grid-cols-5 gap-2">
            {STAGE_COLORS.map((color) => (
              <button
                key={color}
                className="h-7 w-7 rounded-full border-2 border-transparent hover:border-foreground/30 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                style={{ backgroundColor: color }}
                onClick={async () => {
                  if (!colorPickerStageId) return;
                  const stage = stages?.find((s) => s.id === colorPickerStageId);
                  try {
                    await updateStage.mutateAsync({ id: colorPickerStageId, color });
                    toast({ title: "Color updated" });
                    logActivity.mutate({ action: "stage_color_changed", details: { name: stage?.name, color } });
                  } catch {
                    toast({ title: "Failed to update color", variant: "destructive" });
                  }
                  setColorPickerStageId(null);
                }}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
