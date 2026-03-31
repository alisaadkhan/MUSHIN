import React, { useState } from "react";
import { useInfluencerLists } from "@/hooks/useInfluencerLists";
import { useToast } from "@/hooks/use-toast";
import { ListsHeader } from "@/components/lists/ListsHeader";
import { ListsTable } from "@/components/lists/ListsTable";
import { ListActions } from "@/components/lists/ListActions";
import { GlassCard } from "@/components/ui/glass-card";
import { Users, LayoutList, Fingerprint, Key, Radio } from "lucide-react";

export default function ListsPage() {
  const { data: lists, isLoading, createList, deleteList } = useInfluencerLists();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCreate = async (name: string) => {
    try {
      await createList.mutateAsync(name);
      toast({ title: "Cluster Synchronized", description: "Node initialization complete." });
      setShowCreate(false);
    } catch {
      toast({ title: "Initialization Failed", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteList.mutateAsync(deleteId);
      toast({ title: "Node Disconnected", description: "Curation vector terminated." });
      setDeleteId(null);
    } catch {
      toast({ title: "Termination Error", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20 animate-in fade-in duration-700">
      {/* ── Curation Topology Header ─── */}
      <ListsHeader onCreateClick={() => setShowCreate(true)} />

      {/* ── Main Operational Grid ─── */}
      <main className="space-y-8 min-h-[400px]">
        <ListsTable 
          lists={lists || []} 
          isLoading={isLoading} 
          onDelete={(id) => setDeleteId(id)} 
        />
      </main>

      {/* ── Resource Metadata Footer ─── */}
      <div className="flex items-center justify-between pt-10 border-t border-white/[0.03]">
         <div className="flex items-center gap-6">
            <div className="space-y-1">
               <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Operational Saturation</p>
               <p className="text-[10px] font-bold text-white/40">Active Clusters: {lists?.length || 0}</p>
            </div>
            <div className="w-px h-6 bg-white/[0.05]" />
            <div className="space-y-1">
               <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Intelligence Vectors</p>
               <p className="text-[10px] font-bold text-white/40">Verified Nodes: {lists?.reduce((acc, curr) => acc + ((curr as any).list_items?.[0]?.count ?? 0), 0) || 0}</p>
            </div>
         </div>
         <p className="text-[10px] font-black uppercase tracking-widest text-white/10 flex items-center gap-2">
           <Fingerprint size={10} /> MUSHIN IDX v4.81
         </p>
      </div>

      {/* ── Operational Modals ─── */}
      <ListActions 
        showCreate={showCreate}
        setShowCreate={setShowCreate}
        onCreate={handleCreate}
        deleteId={deleteId}
        setDeleteId={setDeleteId}
        onDelete={handleDelete}
        isPending={createList.isPending || deleteList.isPending}
      />
    </div>
  );
}
