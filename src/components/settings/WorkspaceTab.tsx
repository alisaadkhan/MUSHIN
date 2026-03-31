import React, { useState } from "react";
import { UserPlus, Mail, Trash2, Globe, Shield, RefreshCw, Loader2, X } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EmailTemplateManager } from "@/components/campaigns/EmailTemplateManager";
import { DataManagement } from "@/components/settings/DataManagement";

interface WorkspaceTabProps {
  workspace: any;
  workspaceData: any;
  refetchWorkspace: () => Promise<any>;
  currentUser: any;
}

export function WorkspaceTab({ workspace, workspaceData, refetchWorkspace, currentUser }: WorkspaceTabProps) {
  const { toast } = useToast();
  
  // Outreach states
  const [defaultFromName, setDefaultFromName] = useState(workspaceData?.settings?.default_from_name || "");
  const [defaultReplyTo, setDefaultReplyTo] = useState(workspaceData?.settings?.default_reply_to || "");
  const [isOutreachSaving, setIsOutreachSaving] = useState(false);

  // Invite states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);

  const handleOutreachSave = async () => {
    if (!workspace?.workspace_id) return;
    setIsOutreachSaving(true);
    try {
      const existingSettings = workspaceData?.settings || {};
      const newSettings = {
        ...existingSettings,
        default_from_name: defaultFromName.trim() || null,
        default_reply_to: defaultReplyTo.trim() || null,
      };
      
      const { error } = await supabase.rpc("update_workspace_settings", {
        _workspace_id: workspace.workspace_id,
        _settings: newSettings,
      });
      if (error) throw error;
      toast({ title: "Outreach strategy updated" });
      await refetchWorkspace();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsOutreachSaving(false);
    }
  };

  const handleInviteMember = async () => {
    if (!workspace?.workspace_id || !inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const { data, error } = await supabase.rpc("invite_workspace_member", {
        p_workspace_id: workspace.workspace_id,
        p_email: inviteEmail.trim(),
        p_role: inviteRole,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      
      toast({ title: "Signal dispatched", description: `${inviteEmail} added to cluster.` });
      setInviteEmail("");
      setShowInviteModal(false);
      await refetchWorkspace();
    } catch (err: any) {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!workspace?.workspace_id) return;
    try {
      const { data, error } = await supabase.rpc("remove_workspace_member", {
        p_workspace_id: workspace.workspace_id,
        p_user_id: userId,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.error) throw new Error(result.error);
      
      toast({ title: "Node disconnected" });
      await refetchWorkspace();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const roleLabels: Record<string, string> = { owner: "OWNER", admin: "ADMIN", member: "MEMBER" };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── Cluster Information ─── */}
      <GlassCard intensity="low" className="p-8 md:p-10 space-y-8">
        <div>
           <h2 className="text-xl font-black text-white uppercase tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>Cluster Definition</h2>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mt-1">Workspace parameters and metadata</p>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Workspace Designation</label>
              <Input 
                value={workspaceData?.name || ""} 
                disabled 
                className="h-11 bg-white/[0.01] border-white/5 text-[12px] font-bold text-white/20 cursor-not-allowed uppercase tracking-widest"
              />
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Domain Handle</label>
              <div className="relative">
                 <Globe size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                 <Input 
                   value={`${workspaceData?.name?.toLowerCase().replace(/\s+/g, "-") || "node"}.mushin.io`} 
                   disabled 
                   className="h-11 pl-12 bg-white/[0.01] border-white/5 text-[12px] font-bold text-white/20 cursor-not-allowed uppercase tracking-widest"
                 />
              </div>
           </div>
        </div>
      </GlassCard>

      {/* ── Node Management Cluster ─── */}
      <GlassCard intensity="low" className="overflow-hidden">
        <div className="px-8 py-6 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.01]">
           <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Team Synchronization</h3>
              <p className="text-[9px] font-bold text-white/10 uppercase tracking-[0.1em] mt-1">Active operators in cluster</p>
           </div>
           <Button variant="outline" size="sm" className="h-9 border-white/10 hover:border-white/20 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/[0.03]" onClick={() => setShowInviteModal(true)}>
             <UserPlus size={14} className="mr-2" /> Connect Node
           </Button>
        </div>
        <div className="overflow-x-auto">
           <table className="w-full">
              <thead className="bg-white/[0.02]">
                 <tr className="text-[10px] font-black uppercase tracking-widest text-white/20 border-b border-white/[0.03]">
                    <th className="text-left px-8 py-4">Operator Vector</th>
                    <th className="text-left px-8 py-4">Level</th>
                    <th className="text-right px-8 py-4">Signal</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                 {workspaceData?.workspace_members?.map((member: any) => {
                    const mp = member.profiles;
                    const isSelf = currentUser?.id === member.user_id;
                    return (
                       <tr key={member.id} className="group/row hover:bg-white/[0.01] transition-colors">
                          <td className="px-8 py-5">
                             <div className="flex items-center gap-4">
                                {mp?.avatar_url ? (
                                   <img src={mp.avatar_url} alt="Avatar" className="w-9 h-9 rounded-xl border border-white/10 grayscale group-hover/row:grayscale-0 transition-all" />
                                ) : (
                                   <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-xs font-black text-white/30">
                                      {mp?.full_name?.split(" ").map((w: string) => w[0]).join("").toUpperCase() || "?"}
                                   </div>
                                )}
                                <div>
                                   <p className="text-sm font-black text-white/80 group-hover/row:text-white transition-colors">{mp?.full_name || "Unknown Link"}</p>
                                   {isSelf && <p className="text-[9px] font-black text-purple-400/50 uppercase tracking-widest mt-0.5">Primary Session</p>}
                                </div>
                             </div>
                          </td>
                          <td className="px-8 py-5">
                             <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border", 
                                member.role === 'owner' ? 'text-purple-400 bg-purple-400/10 border-purple-400/20' : 'text-white/40 bg-white/5 border-white/10'
                             )}>
                                {roleLabels[member.role] || "MEMBER"}
                             </span>
                          </td>
                          <td className="px-8 py-5 text-right">
                             {!isSelf && member.role !== 'owner' && (
                                <button className="p-2 text-white/10 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all" onClick={() => handleRemoveMember(member.user_id)}>
                                   <Trash2 size={14} />
                                </button>
                             )}
                          </td>
                       </tr>
                    );
                 })}
              </tbody>
           </table>
        </div>
      </GlassCard>

      {/* ── Outreach Synthesis ─── */}
      <GlassCard intensity="low" className="p-8 md:p-10 space-y-8">
        <div className="flex justify-between items-start">
           <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>Signal Synthesis Defaults</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mt-1">Default outreach parameters for cluster</p>
           </div>
           <Button className="h-10 px-8 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest shadow-xl transition-all" onClick={handleOutreachSave} disabled={isOutreachSaving}>
             {isOutreachSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
             Update Protocol
           </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Dispatch Identity (From Name)</label>
              <Input 
                value={defaultFromName} 
                onChange={(e) => setDefaultFromName(e.target.value)} 
                placeholder="MUSHIN Operator" 
                className="h-11 bg-white/[0.02] border-white/10 focus:border-purple-500/30 text-[13px] font-black uppercase tracking-widest"
              />
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Response Vector (Reply-To)</label>
              <div className="relative">
                 <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                 <Input 
                   type="email"
                   value={defaultReplyTo} 
                   onChange={(e) => setDefaultReplyTo(e.target.value)} 
                   placeholder="operator@cluster.io" 
                   className="h-11 pl-12 bg-white/[0.02] border-white/10 focus:border-purple-500/30 text-[13px] font-black tracking-widest"
                 />
              </div>
           </div>
        </div>
      </GlassCard>

      <GlassCard intensity="low" className="p-8 md:p-10">
         <EmailTemplateManager />
      </GlassCard>

      <DataManagement />

      {/* ── Invite Modal ─── */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-[#06060c]/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <GlassCard className="p-8 w-full max-w-md space-y-8 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-white tracking-tighter uppercase" style={{ fontFamily: "'Syne', sans-serif" }}>Signal Connection</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mt-1">Connect new node to cluster</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="text-white/20 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Target Vector (Email)</label>
                  <Input 
                    placeholder="operator@target.io" 
                    value={inviteEmail} 
                    onChange={(e) => setInviteEmail(e.target.value)} 
                    className="h-12 bg-white/[0.02] border-white/10 focus:border-purple-500/30 text-[13px] font-black tracking-widest uppercase"
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Authorization Level</label>
                  <select 
                    value={inviteRole} 
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-white/10 bg-white/[0.02] text-[13px] font-black uppercase tracking-widest text-white focus:outline-none focus:border-purple-500/30 transition-all appearance-none"
                  >
                     <option value="member" className="bg-[#0c0c14]">Operator</option>
                     <option value="admin" className="bg-[#0c0c14]">Supervisor</option>
                  </select>
               </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button variant="outline" className="flex-1 h-12 border-white/10 text-[10px] font-black uppercase tracking-widest" onClick={() => setShowInviteModal(false)}>Abort</Button>
              <Button className="flex-1 h-12 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest" onClick={handleInviteMember} disabled={isInviting || !inviteEmail.trim()}>
                {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Connect Node
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
