import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KanbanBoard } from "@/components/campaigns/KanbanBoard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInfluencerLists, useListItems } from "@/hooks/useInfluencerLists";
import { usePipelineStages, usePipelineCards } from "@/hooks/usePipelineCards";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  archived: "bg-muted text-muted-foreground",
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [showAddFromList, setShowAddFromList] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>("");

  const { data: campaign } = useQuery({
    queryKey: ["campaign-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: lists } = useInfluencerLists();
  const { data: listItems } = useListItems(selectedListId || undefined);
  const { data: stages } = usePipelineStages(id);
  const { addCard } = usePipelineCards(id);

  const handleAddFromList = async () => {
    if (!listItems || !stages || stages.length === 0 || !id) return;
    const firstStage = stages[0];
    let added = 0;
    for (const item of listItems) {
      try {
        await addCard.mutateAsync({
          stage_id: firstStage.id,
          campaign_id: id,
          username: item.username,
          platform: item.platform,
          data: item.data,
        });
        added++;
      } catch {
        // skip duplicates or errors
      }
    }
    toast({ title: `Added ${added} influencer${added !== 1 ? "s" : ""} to pipeline` });
    setShowAddFromList(false);
    setSelectedListId("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/campaigns">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{campaign?.name || "Campaign"}</h1>
              {campaign?.status && (
                <Badge variant="outline" className={`text-[10px] ${statusColors[campaign.status] || ""}`}>
                  {campaign.status}
                </Badge>
              )}
            </div>
            {campaign?.description && (
              <p className="text-muted-foreground mt-1">{campaign.description}</p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddFromList(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add from List
        </Button>
      </div>

      {id && <KanbanBoard campaignId={id} />}

      <Dialog open={showAddFromList} onOpenChange={setShowAddFromList}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Influencers from List</DialogTitle></DialogHeader>
          <Select value={selectedListId} onValueChange={setSelectedListId}>
            <SelectTrigger><SelectValue placeholder="Select a list" /></SelectTrigger>
            <SelectContent>
              {lists?.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  <span className="flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    {l.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedListId && listItems && (
            <p className="text-sm text-muted-foreground">{listItems.length} influencer{listItems.length !== 1 ? "s" : ""} will be added to the first stage</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFromList(false)}>Cancel</Button>
            <Button onClick={handleAddFromList} disabled={!selectedListId || !listItems?.length}>
              Add to Pipeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
