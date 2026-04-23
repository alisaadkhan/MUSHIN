import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeAuthed } from "@/lib/edge";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SettingRow = {
  key: string;
  value: any;
  is_sensitive: boolean;
  updated_by: string | null;
  updated_at: string;
};

export default function AdminSystemSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [filter, setFilter] = useState("");
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("{\n  \n}");
  const [editSensitive, setEditSensitive] = useState(false);
  const [reason, setReason] = useState("");

  const { data: settings = [], isLoading, refetch } = useQuery<SettingRow[]>({
    queryKey: ["superadmin-system-settings", includeSensitive],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed<{ settings: SettingRow[] }>("superadmin-system-settings", {
        body: { action: "list", include_sensitive: includeSensitive },
      } as any);
      if (error) throw error;
      return (data as any)?.settings ?? [];
    },
    staleTime: 15_000,
  });

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return settings;
    return settings.filter((s) => s.key.toLowerCase().includes(needle));
  }, [settings, filter]);

  const setSetting = useMutation({
    mutationFn: async () => {
      const key = editKey.trim();
      if (!key) throw new Error("key required");
      let parsed: any;
      try {
        parsed = JSON.parse(editValue);
      } catch {
        throw new Error("value must be valid JSON");
      }
      const { data, error } = await invokeEdgeAuthed("superadmin-system-settings", {
        body: { action: "set", key, value: parsed, is_sensitive: editSensitive, reason: reason.trim() },
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      setReason("");
      await qc.invalidateQueries({ queryKey: ["superadmin-system-settings"] });
      toast({ title: "Saved" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const loadForEdit = (s: SettingRow) => {
    setEditKey(s.key);
    setEditSensitive(Boolean(s.is_sensitive));
    setEditValue(JSON.stringify(s.value ?? {}, null, 2));
  };

  return (
    <div className="p-8 space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">System Settings</h1>
          <p className="section-subtitle">Feature flags and configuration (super admin only)</p>
        </div>
        <button className="btn-secondary" onClick={() => refetch()}>
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          className="input-sharp w-72"
          placeholder="Filter by key…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <label className="text-[11px] text-white/50 flex items-center gap-2 select-none">
          <input
            type="checkbox"
            checked={includeSensitive}
            onChange={(e) => setIncludeSensitive(e.target.checked)}
          />
          Show sensitive values (redacted by default)
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="app-card overflow-hidden lg:col-span-2">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-[13px] font-medium">Settings</h2>
            <span className="text-[11px] text-white/25 mono">{filtered.length} keys</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-border bg-white/[0.02]">
                  {["Key", "Sensitive", "Updated", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider px-4 py-3"
                    >
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
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-white/25">
                      No settings
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.key} className="admin-row align-top">
                      <td className="px-4 py-2.5 mono text-white/70">{s.key}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                            s.is_sensitive ? "bg-red-500/10 text-red-300 border-red-500/20" : "bg-white/4 text-white/40 border-white/8"
                          }`}
                        >
                          {s.is_sensitive ? "sensitive" : "normal"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-white/35 text-[11px] whitespace-nowrap">
                        {new Date(s.updated_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button className="btn-secondary" onClick={() => loadForEdit(s)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="app-card p-5 space-y-3">
          <h2 className="text-[13px] font-medium">Edit / Create</h2>
          <input className="input-sharp" placeholder="key" value={editKey} onChange={(e) => setEditKey(e.target.value)} />
          <label className="text-[11px] text-white/50 flex items-center gap-2 select-none">
            <input type="checkbox" checked={editSensitive} onChange={(e) => setEditSensitive(e.target.checked)} />
            Mark as sensitive (never expose to normal clients)
          </label>
          <textarea
            className="input-sharp w-full h-48 mono"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
          />
          <textarea
            className="input-sharp w-full h-20"
            placeholder="Reason (required, min 10 chars)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button className="btn-secondary w-full justify-center" disabled={setSetting.isPending || reason.trim().length < 10} onClick={() => setSetting.mutate()}>
            {setSetting.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

