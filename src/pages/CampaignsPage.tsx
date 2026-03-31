import React, { useState, useMemo } from "react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useToast } from "@/hooks/use-toast";
import { CampaignsHeader } from "@/components/campaigns/CampaignsHeader";
import { CampaignKanban } from "@/components/campaigns/CampaignKanban";
import { CampaignActions } from "@/components/campaigns/CampaignActions";
import { Fingerprint, Radio, Key } from "lucide-react";

type CampaignStatus = "draft" | "active" | "completed";

export default function CampaignsPage() {
  const { data: campaigns, isLoading, createCampaign, deleteCampaign } = useCampaigns();
  const { canCreateCampaign, campaignLimit } = usePlanLimits();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCreate = async (params: any) => {
    if (!canCreateCampaign()) {
      toast({ 
        title: "Capacitor Limit Reached", 
        description: `Your plan allows ${campaignLimit} concurrent strategies.`, 
        variant: "destructive" 
      });
      return;
    }
    try {
      await createCampaign.mutateAsync(params);
      toast({ title: "Protocol Initialized", description: "Strategic Nexus successfully deployed." });
      setShowCreate(false);
    } catch {
      toast({ title: "Initialization Error", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCampaign.mutateAsync(deleteId);
      toast({ title: "Nexus Purged", description: "Campaign intelligence permanently revoked." });
      setDeleteId(null);
    } catch {
      toast({ title: "Purge Error", variant: "destructive" });
    }
  };

  const grouped = useMemo(() => {
    const map: Record<CampaignStatus, typeof campaigns> = { draft: [], active: [], completed: [] };
    (campaigns || []).forEach(c => {
      const s = c.status as CampaignStatus;
      if (map[s]) map[s]!.push(c);
      else map.draft!.push(c);
    });
    return map;
  }, [campaigns]);

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto pb-20 animate-in fade-in duration-700">
      {/* ── Campaigns Topology Header ─── */}
      <CampaignsHeader onInitializeClick={() => setShowCreate(true)} />

      {/* ── Tactical Kanban Grid ─── */}
      <main className="min-h-[600px]">
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[600px] rounded-[2rem] bg-white/[0.01] border border-white/[0.05] animate-pulse" />
            ))}
          </div>
        ) : (
          <CampaignKanban 
            grouped={grouped} 
            onDelete={(id) => setDeleteId(id)} 
          />
        )}
      </main>

      {/* ── Operational Metadata Footer ─── */}
      <div className="flex items-center justify-between pt-10 border-t border-white/[0.03]">
         <div className="flex items-center gap-6">
            <div className="space-y-1">
               <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Operational Saturation</p>
               <p className="text-[10px] font-bold text-white/40">Active Nexus: {campaigns?.length || 0} / {campaignLimit}</p>
            </div>
            <div className="w-px h-6 bg-white/[0.05]" />
            <div className="space-y-1">
               <p className="text-[9px] font-black uppercase tracking-widest text-white/20">System Load</p>
               <p className="text-[10px] font-bold text-white/40">Status: Optimized Execution</p>
            </div>
         </div>
         <p className="text-[10px] font-black uppercase tracking-widest text-white/10 flex items-center gap-2">
           <Fingerprint size={10} /> MUSHIN OPS v2.1
         </p>
      </div>

      {/* ── Action Modals ─── */}
      <CampaignActions 
        showCreate={showCreate}
        setShowCreate={setShowCreate}
        onCreate={handleCreate}
        deleteId={deleteId}
        setDeleteId={setDeleteId}
        onDelete={handleDelete}
        isPending={createCampaign.isPending || deleteCampaign.isPending}
      />
    </div>
  );
}
