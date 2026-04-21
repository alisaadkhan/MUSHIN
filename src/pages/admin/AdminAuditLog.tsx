import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, RefreshCw, Loader2, Download } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────── */
interface AuditEntry {
  id:            string;
  timestamp:     string;
  actor_user_id: string | null;
  target_user_id:string | null;
  workspace_id:  string | null;
  action_type:   string;
  action_description: string;
  ip_address:    string | null;
  user_agent:    string | null;
  metadata_json: Record<string, unknown>;
}

/* ── Helpers ────────────────────────────────────────────────── */
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleString();
}

function ActionChip({ action }: { action: string }) {
  const cat = action.split('.')[0];
  const styles: Record<string, string> = {
    credits:  'bg-amber-500/8 text-amber-400 border-amber-500/15',
    user:     'bg-blue-500/8 text-blue-400 border-blue-500/15',
    session:  'bg-red-500/8 text-red-400 border-red-500/15',
    role:     'bg-purple-500/8 text-purple-400 border-purple-500/15',
    system:   'bg-white/5 text-white/40 border-white/8',
  };
  const style = styles[cat] ?? styles.system;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border mono ${style}`}>
      {action}
    </span>
  );
}

/* ── Detail Panel ───────────────────────────────────────────── */
function DetailPanel({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-[440px] bg-[#060606] border-l border-border flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-white">Audit Entry</h3>
          <button onClick={onClose} className="text-white/25 hover:text-white text-lg leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-[12px]">
          {[
            { label: 'ID',            value: entry.id,                   mono: true },
            { label: 'Action',        value: entry.action_type,          mono: true },
            { label: 'Description',   value: entry.action_description,   mono: false },
            { label: 'Actor User',    value: entry.actor_user_id ?? 'System', mono: true },
            { label: 'Target User',   value: entry.target_user_id ?? '—', mono: true },
            { label: 'Workspace',     value: entry.workspace_id ?? '—',  mono: true },
            { label: 'IP Address',    value: entry.ip_address ?? '—',    mono: true },
            { label: 'Timestamp',     value: new Date(entry.timestamp).toISOString(), mono: true },
          ].map(({ label, value, mono }) => (
            <div key={label}>
              <p className="text-[10px] text-white/25 uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-white/70 break-all ${mono ? 'mono' : ''}`}>{value}</p>
            </div>
          ))}
          {entry.metadata_json && (
            <div>
              <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">Metadata</p>
              <div className="bg-white/3 border border-white/6 rounded p-3 space-y-2">
                <pre className="mono text-[11px] text-white/50 whitespace-pre-wrap break-all">
                  {JSON.stringify(entry.metadata_json, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
const ACTION_CATEGORIES = ['all', 'credits', 'user', 'session', 'role', 'system'] as const;

export default function AdminAuditLog() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [detail, setDetail] = useState<AuditEntry | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-log', page, category],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      if (category !== 'all') {
        // system audit uses ':' separators; we match broadly client-side
        params.set('action_type', category);
      }

      const { data, error } = await supabase.functions.invoke(`admin-get-audit-log?${params.toString()}`, {
        method: 'GET',
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const entries = (data?.logs ?? []) as AuditEntry[];
      return { entries, total: entries.length };
    },
    staleTime: 15_000,
  });

  const entries = data?.entries ?? [];
  const total   = data?.total   ?? 0;

  const filtered = search
    ? entries.filter(e =>
        e.action_type?.includes(search) ||
        e.action_description?.includes(search) ||
        e.actor_user_id?.includes(search) ||
        e.workspace_id?.includes(search)
      )
    : entries;

  /* CSV export */
  const exportCSV = () => {
    const header = ['id','timestamp','action_type','action_description','actor_user_id','target_user_id','workspace_id','ip_address','user_agent'];
    const rows = entries.map(e => header.map(k => JSON.stringify((e as any)[k] ?? '')).join(','));
    const blob = new Blob([header.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `audit-log-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 space-y-6">

      {/* Detail panel */}
      {detail && <DetailPanel entry={detail} onClose={() => setDetail(null)} />}

      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">Audit Log</h1>
          <p className="section-subtitle">
            Immutable · Append-only · Latest {entries.length.toLocaleString()} events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary">
            <Download size={13} />
            Export CSV
          </button>
          <button onClick={() => refetch()} className="btn-secondary">
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            type="search"
            placeholder="Filter by action, email, ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-sharp pl-8 w-64"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {ACTION_CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => { setCategory(c); setPage(0); }}
              className={`px-3 py-1.5 rounded text-[11px] font-medium capitalize border transition-colors ${
                category === c
                  ? 'bg-white/10 text-white border-white/20'
                  : 'bg-white/3 text-white/35 border-white/6 hover:bg-white/6'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border">
                {['Time', 'Action', 'Actor', 'Resource', 'IP', ''].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-white/25">
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-white/25">
                    No entries found
                  </td>
                </tr>
              ) : (
                filtered.map(e => (
                  <tr
                    key={e.id}
                    className="admin-row cursor-pointer"
                    onClick={() => setDetail(e)}
                  >
                    <td className="px-4 py-2.5 mono text-white/25 whitespace-nowrap text-[11px]">
                      {timeAgo(e.timestamp)}
                    </td>
                    <td className="px-4 py-2.5">
                      <ActionChip action={e.action_type} />
                    </td>
                    <td className="px-4 py-2.5 text-white/50 max-w-[160px] truncate">
                      {e.actor_user_id ? `${e.actor_user_id.slice(0, 8)}…` : 'System'}
                    </td>
                    <td className="px-4 py-2.5 text-white/35 mono text-[11px]">
                      {e.action_description}
                    </td>
                    <td className="px-4 py-2.5 mono text-white/25 text-[11px]">
                      {e.ip_address ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-white/20 text-[11px]">
                      View →
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-white/20 mono">
          Showing latest events (server-limited)
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-secondary"
          >
            ← Previous
          </button>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled
            className="btn-secondary"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
