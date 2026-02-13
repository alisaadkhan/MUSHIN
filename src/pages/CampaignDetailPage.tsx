import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, Users, Pencil, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { CampaignStats } from "@/components/campaigns/CampaignStats";
import { CampaignTimeline } from "@/components/campaigns/CampaignTimeline";
import { CampaignAnalytics } from "@/components/campaigns/CampaignAnalytics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInfluencerLists, useListItems } from "@/hooks/useInfluencerLists";
import { usePipelineStages, usePipelineCards } from "@/hooks/usePipelineCards";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useCampaignActivity } from "@/hooks/useCampaignActivity";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  archived: "bg-muted text-muted-foreground",
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { updateCampaign } = useCampaigns();
  const { logActivity } = useCampaignActivity(id);
  const [showAddFromList, setShowAddFromList] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editStartDate, setEditStartDate] = useState<Date | undefined>();
  const [editEndDate, setEditEndDate] = useState<Date | undefined>();

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
  const { data: cards, addCard } = usePipelineCards(id);

  const openEditDialog = () => {
    if (!campaign) return;
    setEditName(campaign.name);
    setEditDescription(campaign.description || "");
    setEditBudget(campaign.budget != null ? String(campaign.budget) : "");
    setEditStartDate(campaign.start_date ? new Date(campaign.start_date) : undefined);
    setEditEndDate(campaign.end_date ? new Date(campaign.end_date) : undefined);
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !id) return;
    try {
      await updateCampaign.mutateAsync({
        id,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        budget: editBudget ? Number(editBudget) : undefined,
        start_date: editStartDate ? format(editStartDate, "yyyy-MM-dd") : undefined,
        end_date: editEndDate ? format(editEndDate, "yyyy-MM-dd") : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["campaign-detail", id] });
      toast({ title: "Campaign updated" });
      setShowEdit(false);
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleAddFromList = async () => {
    if (!listItems || !stages || stages.length === 0 || !id) return;
    const firstStage = stages[0];

    // 3.4 Duplicate detection
    const { data: existingCards } = await supabase
      .from("pipeline_cards")
      .select("username, platform")
      .eq("campaign_id", id);
    const existingSet = new Set(
      (existingCards || []).map((c) => `${c.username}::${c.platform}`)
    );

    let added = 0;
    let skipped = 0;
    for (const item of listItems) {
      const key = `${item.username}::${item.platform}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }
      try {
        await addCard.mutateAsync({
          stage_id: firstStage.id,
          campaign_id: id,
          username: item.username,
          platform: item.platform,
          data: item.data,
        });
        added++;
        existingSet.add(key);
      } catch {
        // skip errors
      }
    }

    const parts = [`Added ${added} influencer${added !== 1 ? "s" : ""}`];
    if (skipped > 0) parts.push(`skipped ${skipped} duplicate${skipped !== 1 ? "s" : ""}`);
    toast({ title: parts.join(", ") });

    if (added > 0) {
      logActivity.mutate({ action: "influencers_added", details: { count: added, source: "list" } });
    }

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
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openEditDialog}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {campaign?.status && (
                <Select
                  value={campaign.status}
                  onValueChange={async (value: "draft" | "active" | "completed" | "archived") => {
                    try {
                      const oldStatus = campaign.status;
                      await updateCampaign.mutateAsync({ id: id!, status: value });
                      queryClient.invalidateQueries({ queryKey: ["campaign-detail", id] });
                      toast({ title: `Status changed to ${value}` });
                      logActivity.mutate({ action: "status_changed", details: { from: oldStatus, to: value } });
                    } catch {
                      toast({ title: "Failed to update status", variant: "destructive" });
                    }
                  }}
                >
                  <SelectTrigger className={`h-7 w-auto gap-1 text-[10px] font-medium border ${statusColors[campaign.status] || ""}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["draft", "active", "completed", "archived"] as const).map((s) => (
                      <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      {id && campaign && stages && cards && (
        <CampaignStats stages={stages} cards={cards} campaign={campaign} />
      )}

      {id && <KanbanBoard campaignId={id} />}

      {id && campaign && stages && cards && (
        <CampaignAnalytics stages={stages} cards={cards} campaign={campaign} />
      )}

      {id && <CampaignTimeline campaignId={id} />}

      {/* Add from List Dialog */}
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

      {/* Edit Campaign Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} />
            </div>
            <div>
              <Label className="text-xs">Budget ($)</Label>
              <Input type="number" value={editBudget} onChange={(e) => setEditBudget(e.target.value)} placeholder="e.g. 10000" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10", !editStartDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editStartDate ? format(editStartDate, "MMM d, yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={editStartDate} onSelect={setEditStartDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10", !editEndDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editEndDate ? format(editEndDate, "MMM d, yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={editEndDate} onSelect={setEditEndDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
