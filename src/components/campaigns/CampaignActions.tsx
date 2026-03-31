import React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, ShieldAlert, Sparkles, Megaphone, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CampaignActionsProps {
  showCreate: boolean;
  setShowCreate: (show: boolean) => void;
  onCreate: (params: any) => Promise<void>;
  deleteId: string | null;
  setDeleteId: (id: string | null) => void;
  onDelete: () => Promise<void>;
  isPending: boolean;
}

export function CampaignActions({ 
  showCreate, 
  setShowCreate, 
  onCreate, 
  deleteId, 
  setDeleteId, 
  onDelete, 
  isPending 
}: CampaignActionsProps) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [startDate, setStartDate] = React.useState<Date | undefined>();

  const handleCreate = async () => {
    if (!name.trim()) return;
    await onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      budget: budget ? Number(budget) : undefined,
      start_date: startDate ? format(startDate, "yyyy-MM-dd") : undefined,
    });
    // Reset
    setName("");
    setDescription("");
    setBudget("");
    setStartDate(undefined);
  };

  return (
    <>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg bg-[#06060c]/80 backdrop-blur-2xl border-white/10 p-0 overflow-hidden rounded-3xl">
          <div className="p-8 space-y-8">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-white tracking-tighter uppercase flex items-center gap-3" style={{ fontFamily: "'Syne', sans-serif" }}>
                <Megaphone size={20} className="text-purple-400" />
                Initialize Protocol
              </DialogTitle>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mt-1">Define new strategic campaign Nexus</p>
            </DialogHeader>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Designation Identifier</Label>
                <Input
                  placeholder="e.g. Q3 BRAND ACCELERATION"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 bg-white/[0.02] border-white/10 focus:border-purple-500/30 text-[13px] font-black tracking-widest uppercase"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Strategic Architecture</Label>
                <Textarea
                  placeholder="Describe core objectives and campaign logic..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="bg-white/[0.02] border-white/10 focus:border-purple-500/30 text-[12px] font-bold text-white/60 resize-none rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Allocation (₨)</Label>
                    <Input
                      type="number"
                      placeholder="50,000"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="h-12 bg-white/[0.02] border-white/10 focus:border-purple-500/30 text-[13px] font-black tracking-widest"
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Commencement</Label>
                    <Popover>
                       <PopoverTrigger asChild>
                         <Button variant="outline" className={cn("w-full h-12 bg-white/[0.02] border-white/10 text-left font-black uppercase text-[10px] tracking-widest", !startDate && "text-white/20")}>
                           <CalendarIcon size={14} className="mr-2 opacity-30" />
                           {startDate ? format(startDate, "MMM d, yyyy") : "Select Date"}
                         </Button>
                       </PopoverTrigger>
                       <PopoverContent className="w-auto p-0 bg-[#0c0c14] border-white/10" align="start">
                         <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                       </PopoverContent>
                     </Popover>
                 </div>
              </div>
            </div>

            <DialogFooter className="pt-4 flex gap-3">
              <Button variant="outline" className="flex-1 h-12 border-white/10 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all" onClick={() => setShowCreate(false)}>
                Abort
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={!name.trim() || isPending}
                className="flex-1 h-12 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest active:scale-105 transition-all shadow-[0_0_20px_rgba(168,85,247,0.2)]"
              >
                {isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Sparkles size={14} className="mr-2" />}
                Confirm Protocol
              </Button>
            </DialogFooter>
          </div>
          <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-purple-500/[0.05] rounded-full blur-[100px] pointer-events-none" />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-[#06060c]/80 backdrop-blur-2xl border-white/10 p-0 overflow-hidden rounded-3xl max-w-sm">
          <div className="p-8 space-y-6">
            <AlertDialogHeader className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                <ShieldAlert size={28} />
              </div>
              <div>
                <AlertDialogTitle className="text-lg font-black text-white tracking-tighter uppercase" style={{ fontFamily: "'Syne', sans-serif" }}>
                   Execute Purge Protocol?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[10px] font-black uppercase tracking-widest text-white/30 leading-relaxed mt-2 text-left">
                   Permanently revoking this strategic campaign deletes all historical performance and intelligence mapping. This state change is irreversible.
                </AlertDialogDescription>
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex gap-3">
              <AlertDialogCancel className="flex-1 h-11 border-white/10 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={(e) => {
                   e.preventDefault();
                   onDelete();
                }} 
                className="flex-1 h-11 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest active:scale-105 transition-all"
              >
                {isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : "Purge Protocol"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
