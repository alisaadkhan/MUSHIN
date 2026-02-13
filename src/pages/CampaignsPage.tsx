import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Megaphone, Trash2, Users, CalendarIcon, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  archived: "bg-muted text-muted-foreground",
};

export default function CampaignsPage() {
  const { data: campaigns, isLoading, createCampaign, deleteCampaign } = useCampaigns();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Manage your influencer campaigns</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/campaigns/compare">
            <Button variant="outline" size="sm" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Compare
            </Button>
          </Link>
          <Button className="btn-shine gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="glass-card animate-pulse">
              <CardContent className="p-6 h-32" />
            </Card>
          ))}
        </div>
      )}

      {!isLoading && campaigns && campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link to={`/campaigns/${c.id}`}>
                <Card className="glass-card hover:border-primary/30 transition-colors cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Megaphone className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${statusColors[c.status] || ""}`}>
                          {c.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.preventDefault(); setDeleteId(c.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <h3 className="font-semibold truncate">{c.name}</h3>
                    {c.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                    )}
                    {(c.start_date || c.end_date) && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {c.start_date ? format(new Date(c.start_date), "MMM d") : "—"}
                        {" – "}
                        {c.end_date ? format(new Date(c.end_date), "MMM d") : "—"}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {(c as any).pipeline_cards?.[0]?.count || 0} influencers
                      </span>
                      {c.budget && <span>${Number(c.budget).toLocaleString()} budget</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && (!campaigns || campaigns.length === 0) && (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-1">No Campaigns Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Create a campaign to start managing your influencer pipeline.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) resetForm(); setShowCreate(open); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div>
              <Label className="text-xs">Budget ($)</Label>
              <Input type="number" placeholder="e.g. 10000" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10", !startDate && "text-muted-foreground")}>
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
                <Label className="text-xs">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10", !endDate && "text-muted-foreground")}>
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
