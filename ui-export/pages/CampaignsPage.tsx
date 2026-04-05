import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Megaphone, Trash2, Users, CalendarIcon, BarChart3, DollarSign, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCampaigns } from "@/hooks/useCampaigns";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type CampaignStatus = "draft" | "active" | "completed";

const KANBAN_COLUMNS: { status: CampaignStatus; label: string; color: string }[] = [
  { status: "draft", label: "Draft", color: "bg-muted" },
  { status: "active", label: "Active", color: "bg-primary/20" },
  { status: "completed", label: "Completed", color: "bg-emerald-500/20" },
];

export default function CampaignsPage() {
  const { data: campaigns, isLoading, createCampaign, deleteCampaign } = useCampaigns();
  const { canCreateCampaign, campaignLimit } = usePlanLimits();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const resetForm = () => {
    setName("");
    setDescription("");
    setBudget("");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    if (startDate && endDate && endDate < startDate) {
      toast({ title: "Invalid dates", description: "End date must be after start date.", variant: "destructive" });
      return;
    }
    try {
      await createCampaign.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        budget: budget ? Number(budget) : undefined,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : undefined,
      });
      toast({ title: "Campaign created" });
      setShowCreate(false);
      resetForm();
    } catch {
      toast({ title: "Failed to create", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCampaign.mutateAsync(deleteId);
      toast({ title: "Campaign deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
    setDeleteId(null);
  };

  const grouped = useMemo(() => {
    const map: Record<CampaignStatus, typeof campaigns> = { draft: [], active: [], completed: [] };
    (campaigns || []).forEach(c => {
      const s = c.status as CampaignStatus;
      if (map[s]) map[s]!.push(c);
      else map.draft!.push(c); // archived -> draft column
    });
    return map;
  }, [campaigns]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your influencer campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-lg h-9" asChild>
            <Link to="/campaigns/compare">Compare</Link>
          </Button>
          <Button
            className="rounded-lg h-9 btn-shine"
            onClick={() => {
              if (!canCreateCampaign()) {
                toast({ title: "Campaign limit reached", description: `Your plan allows ${campaignLimit} campaigns. Upgrade to create more.`, variant: "destructive" });
                return;
              }
              setShowCreate(true);
            }}
          >
            <Plus size={16} strokeWidth={1.5} className="mr-1" /> New Campaign
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 h-48 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && campaigns && campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {KANBAN_COLUMNS.map(col => (
            <div key={col.status} className="space-y-3">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`w-2 h-2 rounded-full ${col.color}`} />
                <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                <span className="text-xs text-muted-foreground">({grouped[col.status]?.length || 0})</span>
              </div>

              <div className="space-y-3 min-h-[200px] rounded-2xl border border-dashed border-border/50 p-3 bg-muted/5">
                {(grouped[col.status] || []).map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link to={`/campaigns/${c.id}`} className="block bg-background/80 backdrop-blur-md border border-white/50 rounded-xl p-4 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200 group relative">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-foreground pr-6 truncate">{c.name}</h4>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 absolute right-2 top-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteId(c.id); }}
                        >
                          <Trash2 size={14} strokeWidth={1.5} />
                        </Button>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {(c as any).pipeline_cards?.[0]?.count || 0} creators
                        </span>
                        {c.budget && (
                          <span>
                            · ${Number(c.budget).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
                {(!grouped[col.status] || grouped[col.status]!.length === 0) && (
                  <div className="flex flex-col items-center justify-center h-24 text-center">
                    <p className="text-xs text-muted-foreground">No campaigns</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && (!campaigns || campaigns.length === 0) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div className="flex flex-col items-center justify-center py-20 text-center bg-card/50 backdrop-blur-sm border border-white/50 shadow-sm rounded-2xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Megaphone className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-foreground mb-1">No Campaigns Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Create a campaign to start managing your influencer pipeline.
            </p>
            <Button className="mt-4 gap-2 rounded-lg btn-shine" onClick={() => setShowCreate(true)}>
              <Plus size={16} strokeWidth={1.5} />
              Create Campaign
            </Button>
          </div>
        </motion.div>
      )}

      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) resetForm(); setShowCreate(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
          <div className="space-y-4 my-2">
            <div>
              <Label className="text-xs font-medium text-foreground mb-1 block">Name</Label>
              <Input placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
            </div>
            <div>
              <Label className="text-xs font-medium text-foreground mb-1 block">Description</Label>
              <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div>
              <Label className="text-xs font-medium text-foreground mb-1 block">Budget ($)</Label>
              <Input type="number" placeholder="e.g. 10000" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-foreground mb-1 block">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10 rounded-lg", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "MMM d, yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs font-medium text-foreground mb-1 block">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10 rounded-lg", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "MMM d, yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the campaign and all its pipeline data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
