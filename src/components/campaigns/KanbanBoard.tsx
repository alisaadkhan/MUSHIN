import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { KanbanCard } from "./KanbanCard";
import { CardDetailDialog } from "./CardDetailDialog";
import { usePipelineStages, usePipelineCards } from "@/hooks/usePipelineCards";
import { useToast } from "@/hooks/use-toast";

interface KanbanBoardProps {
  campaignId: string;
}

export function KanbanBoard({ campaignId }: KanbanBoardProps) {
  const { data: stages } = usePipelineStages(campaignId);
  const { data: cards, moveCard, updateCard, removeCard } = usePipelineCards(campaignId);
  const [editingCard, setEditingCard] = useState<any>(null);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
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
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      <h3 className="text-sm font-semibold">{stage.name}</h3>
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {stageCards.length}
                    </span>
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
    </>
  );
}
