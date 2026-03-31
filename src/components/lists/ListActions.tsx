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
import { Loader2, ShieldAlert, Sparkles, LayoutList } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

interface ListActionsProps {
  showCreate: boolean;
  setShowCreate: (show: boolean) => void;
  onCreate: (name: string) => Promise<void>;
  deleteId: string | null;
  setDeleteId: (id: string | null) => void;
  onDelete: () => Promise<void>;
  isPending: boolean;
}

export function ListActions({ 
  showCreate, 
  setShowCreate, 
  onCreate, 
  deleteId, 
  setDeleteId, 
  onDelete, 
  isPending 
}: ListActionsProps) {
  const [newName, setNewName] = React.useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreate(newName.trim());
    setNewName("");
  };

  return (
    <>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md bg-[#06060c]/80 backdrop-blur-2xl border-white/10 p-0 overflow-hidden rounded-3xl">
          <div className="p-8 space-y-8">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-white tracking-tighter uppercase flex items-center gap-3" style={{ fontFamily: "'Syne', sans-serif" }}>
                <LayoutList size={20} className="text-purple-400" />
                Initialize Cluster
              </DialogTitle>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mt-1">Define new curation vector</p>
            </DialogHeader>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Cluster Designation</label>
              <Input
                placeholder="e.g. Q3 INFLUENCER NORTH"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="h-12 bg-white/[0.02] border-white/10 focus:border-purple-500/30 text-[13px] font-black tracking-widest uppercase"
              />
            </div>

            <DialogFooter className="pt-4 flex gap-3">
              <Button variant="outline" className="flex-1 h-12 border-white/10 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all" onClick={() => setShowCreate(false)}>
                Abort
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={!newName.trim() || isPending}
                className="flex-1 h-12 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest active:scale-105 transition-all shadow-[0_0_20px_rgba(168,85,247,0.2)]"
              >
                {isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Sparkles size={14} className="mr-2" />}
                Connect Node
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
                  Disconnect Cluster?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[10px] font-black uppercase tracking-widest text-white/30 leading-relaxed mt-2 text-left">
                  This action permanently revokes all intelligence nodes within the cluster. This operational change is irreversible.
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
                {isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : "Disconnect"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
