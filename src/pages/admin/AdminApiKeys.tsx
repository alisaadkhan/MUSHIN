import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeAuthed } from "@/lib/edge";
import { Loader2, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ApiKeyRow = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoked_reason: string | null;
};

export default function AdminApiKeys() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [newName, setNewName] = useState("");
  const [reason, setReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [showPlain, setShowPlain] = useState<{ name: string; api_key: string } | null>(null);

  const { data: keys = [], isLoading, refetch } = useQuery<ApiKeyRow[]>({
    queryKey: ["superadmin-api-keys"],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed<{ keys: ApiKeyRow[] }>("superadmin-api-keys", {
        body: { action: "list" },
      } as any);
      if (error) throw error;
      return (data as any)?.keys ?? [];
    },
    staleTime: 15_000,
  });

  const activeKeys = useMemo(() => keys.filter((k) => !k.revoked_at), [keys]);

  const createKey = useMutation({
    mutationFn: async () => {
      const { data, error } = await invokeEdgeAuthed("superadmin-api-keys", {
        body: { action: "create", name: newName.trim(), reason: reason.trim() },
      } as any);
      if (error) throw error;
      return data as any;
    },
    onSuccess: async (data: any) => {
      const result = data?.result as any;
      if (result?.api_key) setShowPlain({ name: result.name, api_key: result.api_key });
      setNewName("");
      setReason("");
      await qc.invalidateQueries({ queryKey: ["superadmin-api-keys"] });
      toast({ title: "API key created", description: "Copy it now. It won’t be shown again." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const revokeKey = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await invokeEdgeAuthed("superadmin-api-keys", {
        body: { action: "revoke", name, reason: revokeReason.trim() },
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      setRevokeReason("");
      await qc.invalidateQueries({ queryKey: ["superadmin-api-keys"] });
      toast({ title: "Revoked" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-8 space-y-6">
      {showPlain ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-300">
            <ShieldAlert size={14} />
            <div className="text-sm font-semibold">New key (shown once)</div>
          </div>
          <div className="text-[11px] text-amber-200/70">
            Store this in your secret manager now. It will not be retrievable again.
          </div>
          <div className="mono text-[12px] text-white/80 break-all bg-black/30 border border-white/10 rounded p-3">
            {showPlain.api_key}
          </div>
          <button className="btn-secondary" onClick={() => setShowPlain(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="section-header">
        <div>
          <h1 className="section-title">System API Keys</h1>
          <p className="section-subtitle">Hash-only storage · show-once create · revoke anytime</p>
        </div>
        <button className="btn-secondary" onClick={() => refetch()}>
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="app-card p-5 space-y-3">
          <h2 className="text-[13px] font-medium">Create key</h2>
          <input className="input-sharp" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <textarea
            className="input-sharp w-full h-20"
            placeholder="Reason (required, min 10 chars)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            className="btn-secondary w-full justify-center"
            disabled={createKey.isPending || newName.trim().length < 3 || reason.trim().length < 10}
            onClick={() => createKey.mutate()}
          >
            {createKey.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create (show once)
          </button>
        </div>

        <div className="app-card overflow-hidden lg:col-span-2">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Keys</h2>
            <span className="text-[11px] text-white/25 mono">{activeKeys.length} active</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border bg-white/[0.02]">
                  {["Name", "Status", "Created", "Revoke"].map((h) => (
                    <th key={h} className="text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-white/25">
                      <Loader2 size={16} className="animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : keys.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-white/25">
                      No keys
                    </td>
                  </tr>
                ) : (
                  keys.map((k) => (
                    <tr key={k.id} className="admin-row align-top">
                      <td className="px-4 py-2.5 text-white/70 mono">{k.name}</td>
                      <td className="px-4 py-2.5">
                        {k.revoked_at ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border bg-red-500/10 text-red-300 border-red-500/20">
                            revoked
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                            active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-white/35 text-[11px] whitespace-nowrap">
                        {new Date(k.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        {!k.revoked_at ? (
                          <div className="flex items-center gap-2">
                            <input
                              className="input-sharp h-8 w-56"
                              placeholder="Reason (min 10)…"
                              value={revokeReason}
                              onChange={(e) => setRevokeReason(e.target.value)}
                            />
                            <button
                              className="btn-secondary"
                              disabled={revokeKey.isPending || revokeReason.trim().length < 10}
                              onClick={() => revokeKey.mutate(k.name)}
                            >
                              {revokeKey.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={13} />}
                              Revoke
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-white/25">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

