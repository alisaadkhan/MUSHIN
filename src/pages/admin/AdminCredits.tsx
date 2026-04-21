import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useToast } from '@/hooks/use-toast';
import {
  Search, RefreshCw, Loader2, Plus, Minus,
  ArrowUpRight, ArrowDownRight, ChevronRight,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────── */
type CreditType = 'search' | 'ai' | 'email' | 'enrichment';
type EventType  = 'purchase' | 'usage' | 'admin_adjust' | 'refund' | 'expiry' | 'rollover';

interface WorkspaceBalance {
  workspace_id: string;
  owner_id:     string;
  owner_email:  string | null;
  owner_name:   string | null;
  plan:         string | null;
  balances: Record<CreditType, number>;
}

interface LedgerEntry {
  id:           string;
  user_id:      string;
  workspace_id: string;
  credit_type:  CreditType;
  kind:         'credit' | 'debit';
  amount:       number;
  balance_before: number;
  balance_after:  number;
  action:       string | null;
  metadata:     Record<string, unknown> | null;
  created_at:   string;
}

/* ── Helpers ────────────────────────────────────────────────── */
const CREDIT_TYPES: CreditType[] = ['search', 'ai', 'email', 'enrichment'];

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function EventBadge({ type }: { type: EventType }) {
  const styles: Record<EventType, string> = {
    purchase:    'bg-emerald-500/8 text-emerald-400 border-emerald-500/15',
    usage:       'bg-white/4 text-white/40 border-white/8',
    admin_adjust:'bg-amber-500/8 text-amber-400 border-amber-500/15',
    refund:      'bg-blue-500/8 text-blue-400 border-blue-500/15',
    expiry:      'bg-red-500/8 text-red-400 border-red-500/15',
    rollover:    'bg-purple-500/8 text-purple-400 border-purple-500/15',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${styles[type]}`}>
      {type.replace('_', ' ')}
    </span>
  );
}

/* ── Adjust Credits Dialog ──────────────────────────────────── */
interface AdjustDialogProps {
  workspace: WorkspaceBalance;
  onClose: () => void;
  onSubmit: (data: AdjustPayload) => Promise<void>;
}
interface AdjustPayload {
  workspaceId: string;
  targetUserId: string;
  creditType:  CreditType;
  delta:       number;
  note:        string;
}

function AdjustDialog({ workspace, onClose, onSubmit }: AdjustDialogProps) {
  const [creditType, setCreditType] = useState<CreditType>('search');
  const [mode, setMode] = useState<'add' | 'subtract'>('add');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const currentBalance = workspace.balances[creditType] ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(amount, 10);
    if (!n || n <= 0) return;
    setLoading(true);
    await onSubmit({
      workspaceId: workspace.workspace_id,
      targetUserId: workspace.owner_id,
      creditType,
      delta: mode === 'add' ? n : -n,
      note: note || `Admin adjustment: ${mode === 'add' ? '+' : '-'}${n} ${creditType}`,
    });
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
      <div className="app-card w-[400px] p-6">

        {/* Header */}
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-white">Adjust Credits</h3>
          <p className="text-[12px] text-white/35 mt-0.5">
            {workspace.owner_email ?? workspace.owner_name ?? workspace.workspace_id}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Credit type */}
          <div>
            <label className="text-[11px] text-white/35 uppercase tracking-wider mb-2 block">
              Credit Type
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {CREDIT_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCreditType(t)}
                  className={`px-2 py-1.5 rounded text-[11px] font-medium capitalize transition-colors border ${
                    creditType === t
                      ? 'bg-white/10 text-white border-white/20'
                      : 'bg-white/3 text-white/40 border-white/6 hover:bg-white/6'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-white/25 mt-1.5 mono">
              Current balance: {currentBalance.toLocaleString()}
            </p>
          </div>

          {/* Add / subtract toggle */}
          <div>
            <label className="text-[11px] text-white/35 uppercase tracking-wider mb-2 block">
              Operation
            </label>
            <div className="flex gap-2">
              {(['add', 'subtract'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-1.5 flex-1 justify-center py-2 rounded border text-[12px] font-medium transition-colors ${
                    mode === m
                      ? m === 'add'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                      : 'bg-white/3 text-white/35 border-white/6 hover:bg-white/6'
                  }`}
                >
                  {m === 'add' ? <Plus size={12} /> : <Minus size={12} />}
                  {m === 'add' ? 'Add' : 'Subtract'}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-[11px] text-white/35 uppercase tracking-wider mb-2 block">
              Amount
            </label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 100"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              className="input-sharp mono"
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-[11px] text-white/35 uppercase tracking-wider mb-2 block">
              Note (audit log)
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Reason for adjustment…"
              rows={2}
              className="input-sharp resize-none py-2"
            />
          </div>

          {/* Preview */}
          {amount && parseInt(amount) > 0 && (
            <div className="bg-white/3 border border-white/6 rounded p-3 text-[12px] text-white/50 mono">
              {currentBalance.toLocaleString()} {mode === 'add' ? '+' : '−'} {parseInt(amount).toLocaleString()}
              {' = '}
              <span className="text-white font-medium">
                {(mode === 'add'
                  ? currentBalance + parseInt(amount)
                  : Math.max(0, currentBalance - parseInt(amount))
                ).toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading || !amount} className="btn-primary flex-1">
              {loading ? <Loader2 size={13} className="animate-spin" /> : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Ledger Drawer ──────────────────────────────────────────── */
function LedgerDrawer({
  workspace,
  onClose,
}: {
  workspace: WorkspaceBalance;
  onClose: () => void;
}) {
  const { data: entries = [], isLoading } = useQuery<LedgerEntry[]>({
    queryKey: ['credit-ledger', workspace.workspace_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_credit_ledger_view')
        .select('id,created_at,user_id,workspace_id,credit_type,kind,amount,balance_before,balance_after,action,metadata')
        .eq('workspace_id', workspace.workspace_id)
        .eq('user_id', workspace.owner_id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as LedgerEntry[];
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/60" onClick={onClose} />

      {/* Drawer */}
      <div className="w-[480px] bg-[#060606] border-l border-border flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-white">Credit Ledger</h3>
            <p className="text-[11px] text-white/30 mt-0.5">
              {workspace.owner_email ?? workspace.workspace_id}
            </p>
          </div>
          <button onClick={onClose} className="text-white/25 hover:text-white transition-colors text-lg leading-none">
            ×
          </button>
        </div>

        {/* Balances summary */}
        <div className="grid grid-cols-4 gap-px border-b border-border bg-border">
          {CREDIT_TYPES.map(t => (
            <div key={t} className="bg-[#060606] px-4 py-3">
              <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1">{t}</p>
              <p className="stat-num text-base font-semibold text-white">
                {(workspace.balances[t] ?? 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Ledger entries */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={18} className="animate-spin text-white/25" />
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center text-[12px] text-white/25">
              No credit events yet
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {entries.map(e => (
                <li key={e.id} className="px-5 py-3 hover:bg-white/[0.015] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Delta direction icon */}
                      <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                        e.kind === 'credit' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                      }`}>
                        {e.kind === 'credit'
                          ? <ArrowUpRight size={11} className="text-emerald-400" />
                          : <ArrowDownRight size={11} className="text-red-400" />
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                            e.kind === 'credit'
                              ? 'bg-emerald-500/8 text-emerald-400 border-emerald-500/15'
                              : 'bg-red-500/8 text-red-400 border-red-500/15'
                          }`}>
                            {e.kind === 'credit' ? 'credit' : 'debit'}
                          </span>
                          <span className="text-[10px] text-white/30 capitalize">{e.credit_type}</span>
                        </div>
                        {e.action && (
                          <p className="text-[11px] text-white/30 mt-0.5 truncate">{e.action}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`mono text-[13px] font-semibold ${e.kind === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {e.kind === 'credit' ? '+' : '−'}{e.amount.toLocaleString()}
                      </p>
                      <p className="mono text-[10px] text-white/20 mt-0.5">
                        → {e.balance_after.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-white/20 mt-0.5">
                        {timeAgo(e.created_at)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function AdminCredits() {
  const perms = useAdminPermissions();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [adjustTarget, setAdjustTarget] = useState<WorkspaceBalance | null>(null);
  const [ledgerTarget, setLedgerTarget] = useState<WorkspaceBalance | null>(null);

  /* ── Data: workspace balances from ledger view ── */
  const { data: workspaces = [], isLoading, refetch } = useQuery<WorkspaceBalance[]>({
    queryKey: ['admin-credit-balances'],
    queryFn: async () => {
      const [wsRes, balRes, usersRes] = await Promise.all([
        supabase.from('workspaces').select('id,owner_id,plan').limit(200),
        supabase.from('user_credit_balances').select('user_id,workspace_id,credit_type,balance').limit(5000),
        supabase.functions.invoke('admin-list-users'),
      ]);
      if (wsRes.error) throw wsRes.error;
      if (balRes.error) throw balRes.error;

      const userMap: Record<string, { email: string | null; full_name: string | null }> = {};
      for (const u of usersRes.data?.users ?? []) {
        userMap[u.id] = { email: u.email, full_name: u.full_name };
      }

      // Group balances by workspace
      const balMap: Record<string, Record<string, Record<CreditType, number>>> = {};
      for (const row of balRes.data ?? []) {
        const wsId = row.workspace_id as string;
        const uId = row.user_id as string;
        if (!balMap[wsId]) balMap[wsId] = {};
        if (!balMap[wsId][uId]) balMap[wsId][uId] = { search: 0, ai: 0, email: 0, enrichment: 0 };
        balMap[wsId][uId][row.credit_type as CreditType] = (row.balance ?? 0) as number;
      }

      return (wsRes.data ?? []).map(ws => {
        const owner = userMap[ws.owner_id] ?? { email: null, full_name: null };
        return {
          workspace_id: ws.id,
          owner_id:     ws.owner_id,
          owner_email:  owner.email,
          owner_name:   owner.full_name,
          plan:         ws.plan,
          balances:     balMap[ws.id]?.[ws.owner_id] ?? { search: 0, ai: 0, email: 0, enrichment: 0 },
        } satisfies WorkspaceBalance;
      });
    },
    staleTime: 30_000,
  });

  const filtered = workspaces.filter(w => {
    const q = search.toLowerCase();
    return !q || w.owner_email?.toLowerCase().includes(q) || w.owner_name?.toLowerCase().includes(q);
  });

  /* ── Adjust handler ── */
  const handleAdjust = async (payload: AdjustPayload) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-adjust-credits', {
        body: {
          workspace_id: payload.workspaceId,
          target_user_id: payload.targetUserId,
          credit_type:  payload.creditType,
          mode: "adjust",
          amount_delta: payload.delta,
          reason:       payload.note,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Credits adjusted', description: `${payload.delta > 0 ? '+' : ''}${payload.delta} ${payload.creditType}` });
      qc.invalidateQueries({ queryKey: ['admin-credit-balances'] });
      qc.invalidateQueries({ queryKey: ['credit-ledger', payload.workspaceId] });
    } catch (err: any) {
      toast({ title: 'Adjustment failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-8 space-y-6">

      {/* Dialogs */}
      {adjustTarget && (
        <AdjustDialog
          workspace={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSubmit={handleAdjust}
        />
      )}
      {ledgerTarget && (
        <LedgerDrawer
          workspace={ledgerTarget}
          onClose={() => setLedgerTarget(null)}
        />
      )}

      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">Credit Ledger</h1>
          <p className="section-subtitle">
            Event-sourced · All mutations append-only
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary">
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        <input
          type="search"
          placeholder="Search workspace or owner…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-sharp pl-8"
        />
      </div>

      {/* Table */}
      <div className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border">
                {['Workspace', 'Plan', 'Search', 'AI', 'Email', 'Enrichment', ''].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-white/25">
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-white/25">
                    No workspaces found
                  </td>
                </tr>
              ) : (
                filtered.map(ws => (
                  <tr key={ws.workspace_id} className="admin-row">
                    {/* Owner */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-white/75 truncate max-w-[180px]">
                        {ws.owner_name || <span className="text-white/25 italic">No name</span>}
                      </p>
                      <p className="text-white/30 mono text-[10px] truncate max-w-[180px]">
                        {ws.owner_email}
                      </p>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3 capitalize text-white/40">
                      {ws.plan ?? '—'}
                    </td>

                    {/* Credit balances */}
                    {CREDIT_TYPES.map(ct => {
                      const val = ws.balances[ct] ?? 0;
                      return (
                        <td key={ct} className="px-4 py-3">
                          <span className={`mono font-medium ${
                            val === 0
                              ? 'text-red-400'
                              : val < 10
                              ? 'text-amber-400'
                              : 'text-white/60'
                          }`}>
                            {val.toLocaleString()}
                          </span>
                        </td>
                      );
                    })}

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAdjustTarget(ws)}
                          className="text-[11px] text-white/35 hover:text-white border border-white/8 hover:border-white/20 px-2.5 py-1 rounded transition-colors"
                        >
                          Adjust
                        </button>
                        <button
                          onClick={() => setLedgerTarget(ws)}
                          className="text-white/25 hover:text-white/60 transition-colors"
                          title="View ledger history"
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!isLoading && (
        <p className="text-[11px] text-white/20 mono">
          {filtered.length} workspace{filtered.length !== 1 ? 's' : ''} · Event-sourced ledger
        </p>
      )}
    </div>
  );
}
