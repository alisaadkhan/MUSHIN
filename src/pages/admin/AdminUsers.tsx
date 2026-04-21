import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useToast } from '@/hooks/use-toast';
import {
  Search, UserX, UserCheck, Key, Shield, Loader2,
  ChevronDown, MoreHorizontal, RefreshCw, Mail, UserPlus
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────── */
interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  plan: string | null;
  suspended: boolean;
  created_at: string;
  last_sign_in: string | null;
}

/* ── Helpers ────────────────────────────────────────────────── */
const ROLES = ['user', 'viewer', 'support', 'admin', 'super_admin'] as const;

function timeAgo(iso: string | null) {
  if (!iso) return 'Never';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function RolePill({ role }: { role: string }) {
  const styles: Record<string, string> = {
    super_admin: 'bg-white/10 text-white border-white/20',
    admin:       'bg-white/7 text-white/80 border-white/15',
    support:     'bg-white/5 text-white/60 border-white/10',
    viewer:      'bg-white/4 text-white/45 border-white/8',
    user:        'bg-white/2 text-white/35 border-white/5',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${styles[role] ?? styles.user}`}>
      {role.replace('_', ' ')}
    </span>
  );
}

function StatusPill({ suspended }: { suspended: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border ${
      suspended
        ? 'bg-red-500/8 text-red-400 border-red-500/15'
        : 'bg-emerald-500/8 text-emerald-400 border-emerald-500/15'
    }`}>
      <span className={`w-1 h-1 rounded-full ${suspended ? 'bg-red-400' : 'bg-emerald-400'}`} />
      {suspended ? 'Suspended' : 'Active'}
    </span>
  );
}

/* ── Action button ──────────────────────────────────────────── */
interface ActionBtnProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  loading?: boolean;
  variant?: 'default' | 'danger' | 'success';
}
function ActionBtn({ icon: Icon, label, onClick, loading, variant = 'default' }: ActionBtnProps) {
  const styles = {
    default: 'text-white/40 hover:text-white hover:bg-white/5',
    danger:  'text-red-400/60 hover:text-red-400 hover:bg-red-500/8',
    success: 'text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/8',
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={label}
      className={`p-1.5 rounded transition-colors duration-100 ${styles[variant]} disabled:opacity-40`}
    >
      {loading
        ? <Loader2 size={13} className="animate-spin" />
        : <Icon size={13} />
      }
    </button>
  );
}

/* ── Promote Role Dialog ────────────────────────────────────── */
interface RoleDialogProps {
  user: UserRow;
  onClose: () => void;
  onPromote: (userId: string, role: string) => Promise<void>;
}
function RoleDialog({ user, onClose, onPromote }: RoleDialogProps) {
  const [selected, setSelected] = useState(user.role);
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    if (selected === user.role) { onClose(); return; }
    setLoading(true);
    await onPromote(user.id, selected);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="app-card w-80 p-6">
        <h3 className="text-sm font-semibold text-white mb-1">Change Role</h3>
        <p className="text-[12px] text-white/40 mb-4">
          {user.email ?? user.full_name}
        </p>
        <div className="space-y-1.5 mb-5">
          {ROLES.map(r => (
            <button
              key={r}
              onClick={() => setSelected(r)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded border text-[12px] transition-colors ${
                selected === r
                  ? 'border-white/25 bg-white/8 text-white'
                  : 'border-white/6 text-white/40 hover:text-white/70 hover:bg-white/4'
              }`}
            >
              {r.replace('_', ' ')}
              {r === user.role && (
                <span className="text-[10px] text-white/25">current</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleApply} disabled={loading} className="btn-primary flex-1">
            {loading ? <Loader2 size={13} className="animate-spin" /> : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Create User Dialog ─────────────────────────────────────── */
interface CreateUserDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}
function CreateUserDialog({ onClose, onSuccess }: CreateUserDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('support');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!email || !password) {
      toast({ title: 'Missing fields', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { email, password, full_name: fullName, role }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({ title: 'User created' });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: 'Failed to create user', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="app-card w-80 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Create User</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-white/40 uppercase relative -bottom-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-sharp w-full" placeholder="support@mushin.app" />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase relative -bottom-1">Temporary Password</label>
            <input type="text" value={password} onChange={e => setPassword(e.target.value)} className="input-sharp w-full" placeholder="SecurePassword123!" />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase relative -bottom-1">Full Name</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="input-sharp w-full" placeholder="John Doe" />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase relative -bottom-1">Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} className="input-sharp w-full !pr-8 bg-[#0a0114] text-[13px]">
              {ROLES.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleCreate} disabled={loading} className="btn-primary flex-1">
            {loading ? <Loader2 size={13} className="animate-spin" /> : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function AdminUsers() {
  const perms = useAdminPermissions();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  /* ── Data ── */
  const { data: users = [], isLoading, error, refetch } = useQuery<UserRow[]>({
    queryKey: ['admin-users-v2'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-list-users');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.users ?? [];
    },
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (!error) return;
    toast({
      title: 'Failed to load users',
      description: (error as any)?.message ?? 'Admin request failed',
      variant: 'destructive',
    });
  }, [error, toast]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  /* ── Actions ── */
  const callAdmin = async (fn: string, body: object) => {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handle = async (action: string, userId: string, extra?: object) => {
    const key = `${action}-${userId}`;
    setLoading(key);
    try {
      if (action === 'suspend') {
        await callAdmin('admin-suspend-user', { target_user_id: userId, suspend: true });
        toast({ title: 'User suspended' });
      } else if (action === 'unsuspend') {
        await callAdmin('admin-suspend-user', { target_user_id: userId, suspend: false });
        toast({ title: 'User reactivated' });
      } else if (action === 'reset-pw') {
        await callAdmin('admin-force-password-reset', { target_user_id: userId });
        toast({ title: 'Password reset email sent' });
      } else if (action === 'revoke-sessions') {
        await callAdmin('admin-revoke-sessions', { target_user_id: userId });
        toast({ title: 'All sessions revoked' });
      }
      qc.invalidateQueries({ queryKey: ['admin-users-v2'] });
    } catch (err: any) {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handlePromote = async (userId: string, role: string) => {
    try {
      await callAdmin('admin-promote-user', { target_user_id: userId, role });
      toast({ title: 'Role updated' });
      qc.invalidateQueries({ queryKey: ['admin-users-v2'] });
    } catch (err: any) {
      toast({ title: 'Failed to update role', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-8 space-y-6">

      {/* Role dialog */}
      {roleTarget && (
        <RoleDialog
          user={roleTarget}
          onClose={() => setRoleTarget(null)}
          onPromote={handlePromote}
        />
      )}

      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">User Management</h1>
          <p className="section-subtitle">
            {isLoading ? '—' : `${users.length} users`}
            {filtered.length !== users.length && ` · ${filtered.length} shown`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="btn-secondary"
            title="Refresh"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          {perms.isSuperAdmin && (
            <button
              onClick={() => setShowCreateDialog(true)}
              className="btn-primary"
            >
              <UserPlus size={13} />
              Create User
            </button>
          )}
        </div>
      </div>

      {showCreateDialog && (
        <CreateUserDialog 
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => refetch()}
        />
      )}

      {/* Search */}
      <div className="relative w-72">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        <input
          type="search"
          placeholder="Search by name or email…"
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
                {['User', 'Role', 'Plan', 'Status', 'Last sign-in', 'Joined', 'Actions'].map(h => (
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
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <div className="text-white/70 font-medium mb-1">Unable to load users</div>
                    <div className="text-white/35 text-[11px] mono mb-4">
                      {(error as any)?.message ?? 'Admin request failed'}
                    </div>
                    <button onClick={() => refetch()} className="btn-secondary inline-flex items-center gap-2">
                      <RefreshCw size={13} />
                      Retry
                    </button>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-white/25">
                    No users found
                  </td>
                </tr>
              ) : (
                filtered.map(u => (
                  <tr key={u.id} className="admin-row">
                    {/* User */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-white/80 truncate max-w-[180px]">
                        {u.full_name || <span className="text-white/25 italic">No name</span>}
                      </p>
                      <p className="text-white/30 mono text-[10px] truncate max-w-[180px]">
                        {u.email}
                      </p>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <RolePill role={u.role} />
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3">
                      <span className="text-white/40 capitalize">{u.plan ?? '—'}</span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusPill suspended={u.suspended} />
                    </td>

                    {/* Last sign-in */}
                    <td className="px-4 py-3 mono text-white/30">
                      {timeAgo(u.last_sign_in)}
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3 mono text-white/25">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        {/* Suspend / Unsuspend */}
                        {u.suspended ? (
                          <ActionBtn
                            icon={UserCheck}
                            label="Unsuspend user"
                            loading={loading === `unsuspend-${u.id}`}
                            onClick={() => handle('unsuspend', u.id)}
                            variant="success"
                          />
                        ) : (
                          <ActionBtn
                            icon={UserX}
                            label="Suspend user"
                            loading={loading === `suspend-${u.id}`}
                            onClick={() => handle('suspend', u.id)}
                            variant="danger"
                          />
                        )}

                        {/* Change role */}
                        {perms.isSuperAdmin && (
                          <ActionBtn
                            icon={Shield}
                            label="Change role"
                            onClick={() => setRoleTarget(u)}
                          />
                        )}

                        {/* Force password reset */}
                        <ActionBtn
                          icon={Key}
                          label="Force password reset"
                          loading={loading === `reset-pw-${u.id}`}
                          onClick={() => handle('reset-pw', u.id)}
                        />

                        {/* Revoke all sessions */}
                        <ActionBtn
                          icon={Mail}
                          label="Revoke all sessions"
                          loading={loading === `revoke-sessions-${u.id}`}
                          onClick={() => handle('revoke-sessions', u.id)}
                          variant="danger"
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer count */}
      {!isLoading && (
        <p className="text-[11px] text-white/20 mono">
          Showing {filtered.length} of {users.length} users
        </p>
      )}
    </div>
  );
}
