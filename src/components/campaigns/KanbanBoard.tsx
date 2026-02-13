import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Users, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { KanbanCard } from "./KanbanCard";
import { CardDetailDialog } from "./CardDetailDialog";
import { usePipelineStages, usePipelineCards } from "@/hooks/usePipelineCards";
import { useToast } from "@/hooks/use-toast";

interface KanbanBoardProps {
  campaignId: string;
}

export function KanbanBoard({ campaignId }: KanbanBoardProps) {
  const { data: stages, addStage, updateStage, deleteStage } = usePipelineStages(campaignId);
  const { data: cards, moveCard, updateCard, removeCard } = usePipelineCards(campaignId);
  const [editingCard, setEditingCard] = useState<any>(null);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [renamingStageId, setRenamingStageId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmStageId, setDeleteConfirmStageId] = useState<string | null>(null);
  const [showAddStage, setShowAddStage] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const cardsByStage = useCallback(
    (stageId: string) => cards?.filter((c) => c.stage_id === stageId) || [],
    [cards]
  );

  const handleDrop = async (stageId: string, e: React.DragEvent) => {
    e.preventDefault();
    if (!dragCardId) return;
    const stageCards = cardsByStage(stageId);
    try {
      await moveCard.mutateAsync({ cardId: dragCardId, stageId, position: stageCards.length });
    } catch {
      toast({ title: "Failed to move card", variant: "destructive" });
    }
    setDragCardId(null);
  };

  const handleSaveCard = async (id: string, values: { notes?: string; agreed_rate?: number }) => {
    try {
      await updateCard.mutateAsync({ id, ...values });
      toast({ title: "Card updated" });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleRemoveCard = async (id: string) => {
    try {
      await removeCard.mutateAsync(id);
      toast({ title: "Removed from pipeline" });
    } catch {
      toast({ title: "Failed to remove", variant: "destructive" });
    }
  };

  const handleRenameStage = async (stageId: string) => {
    if (!renameValue.trim()) {
      setRenamingStageId(null);
      return;
    }
    try {
      await updateStage.mutateAsync({ id: stageId, name: renameValue.trim() });
      toast({ title: "Stage renamed" });
    } catch {
      toast({ title: "Failed to rename", variant: "destructive" });
    }
    setRenamingStageId(null);
  };

  const handleDeleteStage = async () => {
    if (!deleteConfirmStageId) return;
    const stageCards = cardsByStage(deleteConfirmStageId);
    if (stageCards.length > 0) {
      toast({ title: "Cannot delete", description: "Remove all cards from this stage first.", variant: "destructive" });
      setDeleteConfirmStageId(null);
      return;
    }
    try {
      await deleteStage.mutateAsync(deleteConfirmStageId);
      toast({ title: "Stage deleted" });
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
      setNewStageName("");
      setShowAddStage(false);
    } catch {
      toast({ title: "Failed to add stage", variant: "destructive" });
    }
  };

  if (!stages) return null;

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max">
          {stages.map((stage) => {
            const stageCards = cardsByStage(stage.id);
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
                    <div className="flex items-center gap-2 min-w-0 flex-1">
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
                        draggable
                        onDragStart={() => setDragCardId(card.id)}
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

      <CardDetailDialog
        card={editingCard}
        open={!!editingCard}
        onOpenChange={(open) => !open && setEditingCard(null)}
        onSave={handleSaveCard}
        onRemove={handleRemoveCard}
      />

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
    </>
  );
}
