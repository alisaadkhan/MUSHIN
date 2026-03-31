import React, { useState } from "react";
import { User, Globe, Lock, Zap, Shield, Radio, Key, Fingerprint } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

// Modularized Components
import { SettingsNav } from "@/components/settings/SettingsNav";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { WorkspaceTab } from "@/components/settings/WorkspaceTab";
import { SecurityTab } from "@/components/settings/SecurityTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";

const tabs = [
  { label: "Profile", icon: User },
  { label: "Workspace", icon: Globe },
  { label: "Integrations", icon: Zap },
  { label: "Security", icon: Lock },
];

export default function Settings() {
  const { user, profile, workspace, updatePassword, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("Profile");

  // Fetch MFA factors
  const { data: mfaFactors, refetch: refetchMfa } = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
  });

  // Fetch Workspace Details
  const { data: workspaceData, refetch: refetchWorkspace } = useQuery({
    queryKey: ["workspace-details", workspace?.workspace_id],
    queryFn: async () => {
      if (!workspace?.workspace_id) return null;
      const { data, error } = await supabase
        .from("workspaces")
        .select("*, settings, workspace_members(*, profiles(full_name, avatar_url))")
        .eq("id", workspace.workspace_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!workspace?.workspace_id,
  });

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-20 animate-in fade-in duration-700">
      {/* ── Settings Topology Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/[0.03]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-lg bg-white/[0.03] border border-white/10 text-white/40">
                <Shield size={18} />
             </div>
             <h1 className="text-3xl font-black text-white tracking-tighter uppercase" style={{ fontFamily:"'Syne', sans-serif" }}>
                System Parameters
             </h1>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 flex items-center gap-2">
            <Radio size={12} className="animate-pulse text-purple-500" /> Operational Matrix: Configuration Active
          </p>
        </div>
        <div className="flex items-center gap-6">
           <div className="text-right">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Authorized Node</p>
              <p className="text-[11px] font-bold text-white/40">{user?.email}</p>
           </div>
           <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/20">
              <Fingerprint size={20} />
           </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-10">
        <SettingsNav 
          tabs={tabs} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
        />

        <main className="flex-1 min-w-0">
          {activeTab === "Profile" && (
            <ProfileTab 
              user={user} 
              profile={profile} 
              refreshProfile={refreshProfile} 
            />
          )}

          {activeTab === "Workspace" && (
            <WorkspaceTab 
              workspace={workspace} 
              workspaceData={workspaceData} 
              refetchWorkspace={refetchWorkspace} 
              currentUser={user}
            />
          )}

          {activeTab === "Integrations" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <IntegrationsTab />
            </div>
          )}

          {activeTab === "Security" && (
            <SecurityTab 
              user={user} 
              updatePassword={updatePassword} 
              mfaFactors={mfaFactors} 
              refetchMfa={refetchMfa}
            />
          )}
        </main>
      </div>

      {/* ── Security Metadata Footer ─── */}
      <div className="flex items-center justify-between pt-10 border-t border-white/[0.03]">
         <div className="flex items-center gap-6">
            <div className="space-y-1">
               <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Encryption Protocol</p>
               <p className="text-[10px] font-bold text-white/40">Level: Hyper-Secure</p>
            </div>
            <div className="w-px h-6 bg-white/[0.05]" />
            <div className="space-y-1">
               <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Access Verification</p>
               <p className="text-[10px] font-bold text-white/40">MFA: {mfaFactors?.totp?.length > 0 ? "Synchronized" : "Pending"}</p>
            </div>
         </div>
         <p className="text-[10px] font-black uppercase tracking-widest text-white/10 flex items-center gap-2">
           <Key size={10} /> MUSHIN SEC-LOCK v2.4
         </p>
      </div>
    </div>
  );
}
