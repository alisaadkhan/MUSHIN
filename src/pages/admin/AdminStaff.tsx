import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { invokeEdgeAuthed } from '@/lib/edge';
import {
  Search, UserX, UserCheck, Key, Shield, Loader2,
  RefreshCw, Mail, UserPlus, Users
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
const STAFF_ROLES = ['viewer', 'support', 'admin', 'super_admin'] as const;
const ALL_ROLES   = ['user', 'viewer', 'support', 'admin', 'super_admin'] as const;

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
    support:     'bg-blue-500/10 text-blue-300 border-blue-500/20',
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

/* ── Role Dialog ────────────────────────────────────────────── */
function RoleDialog({ user, onClose, onPromote }: {
  user: UserRow;
  onClose: () => void;
  onPromote: (userId: string, role: string) => Promise<void>;
}) {
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
        <p className="text-[12px] text-white/40 mb-4">{user.email ?? user.full_name}</p>
        <div className="space-y-1.5 mb-5">
          {ALL_ROLES.map(r => (
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
              {r === user.role && <span className="text-[10px] text-white/25">current</span>}
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

/* ── Create Support Staff Dialog ────────────────────────────── */
function CreateSupportStaffDialog({ onClose, onSuccess }: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword]     = useState('');
  const [department, setDepartment] = useState('support');
  const [loading, setLoading]       = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!employeeId || !password) {
      toast({ title: 'Missing fields', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await invokeEdgeAuthed('admin-create-support-staff', {
        body: { employee_id: employeeId, password, department },
      } as any);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: 'Support staff created',
        description: `Staff ID: ${data.employee_id} — login at /support/login`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: 'Failed to create staff', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="app-card w-80 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Create Support Staff</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-white/40 uppercase relative -bottom-1">Staff ID</label>
            <input type="text" value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="input-sharp w-full" placeholder="SUP-01" />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase relative -bottom-1">Temporary Password</label>
            <input type="text" value={password} onChange={e => setPassword(e.target.value)} className="input-sharp w-full" placeholder="SecurePassword123!" />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase relative -bottom-1">Department</label>
            <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className="input-sharp w-full" placeholder="support" />
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

/* ── Role badge for stat cards ──────────────────────────────── */
const ROLE_COLORS: Record<string, string> = {
  super_admin: 'text-white',
  admin:       'text-white/70',
  support:     'text-blue-300',
  viewer:      'text-white/45',
};

/* ── Main Page ──────────────────────────────────────────────── */
export default function AdminStaff() {
  const { user, session } = useAuth();
  const perms = useAdminPermissions();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch]                         = useState('');
  const [actionLoading, setActionLoading]           = useState<string | null>(null);
  const [roleTarget, setRoleTarget]                 = useState<UserRow | null>(null);
  const [showCreateStaffDialog, setShowCreateStaffDialog] = useState(false);

  /* ── Data ── */
  const { data: allUsers = [], isLoading, error, refetch } = useQuery<UserRow[]>({
    queryKey: ['admin-users-v2'],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed('admin-list-users');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.users ?? [];
    },
    enabled: !!session?.access_token,
    staleTime: 30_000,
    retry: false,
  });

  // Only show staff (non-user roles), and hide the current user to prevent self-suspension
  const staff = allUsers.filter(u => u.role !== 'user' && u.id !== user?.id);

  const filtered = staff.filter(u => {
    const q = search.toLowerCase();
    return !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  // Role counts for stat cards
  const counts = STAFF_ROLES.reduce((acc, r) => {
    acc[r] = staff.filter(u => u.role === r).length;
    return acc;
  }, {} as Record<string, number>);

  useEffect(() => {
    if (!error) return;
    const anyErr = error as any;
    toast({
      title: 'Failed to load staff',
      description: anyErr?.message ?? 'Admin request failed',
      variant: 'destructive',
    });
  }, [error, toast]);

  /* ── Actions ── */
  const callAdmin = async (fn: string, body: object) => {
    const { data, error } = await invokeEdgeAuthed(fn, { body } as any);
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handle = async (action: string, userId: string) => {
    const key = `${action}-${userId}`;
    setActionLoading(key);
    try {
      if (action === 'suspend') {
        await callAdmin('admin-suspend-user', { target_user_id: userId, suspend: true });
        toast({ title: 'Staff member suspended' });
      } else if (action === 'unsuspend') {
        await callAdmin('admin-suspend-user', { target_user_id: userId, suspend: false });
        toast({ title: 'Staff member reactivated' });
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
      setActionLoading(null);
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

      {/* Dialogs */}
      {roleTarget && (
        <RoleDialog
          user={roleTarget}
          onClose={() => setRoleTarget(null)}
          onPromote={handlePromote}
        />
      )}
      {showCreateStaffDialog && (
        <CreateSupportStaffDialog
          onClose={() => setShowCreateStaffDialog(false)}
          onSuccess={() => refetch()}
        />
      )}

      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">Staff & Team</h1>
          <p className="section-subtitle">
            {isLoading ? '—' : `${staff.length} staff members`}
            {filtered.length !== staff.length && ` · ${filtered.length} shown`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="btn-secondary" title="Refresh">
            <RefreshCw size={13} />
            Refresh
          </button>
          {perms.isAnyAdmin && (
            <button onClick={() => setShowCreateStaffDialog(true)} className="btn-primary">
              <UserPlus size={13} />
              Add Staff Member
            </button>
          )}
        </div>
      </div>

      {/* Role stat cards */}
      {!isLoading && (
        <div className="grid grid-cols-4 gap-3">
          {STAFF_ROLES.map(r => (
            <div key={r} className="app-card px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/4 flex items-center justify-center">
                <Users size={14} className={ROLE_COLORS[r] ?? 'text-white/40'} />
              </div>
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">{r.replace('_', ' ')}</p>
                <p className="text-lg font-semibold text-white">{counts[r] ?? 0}</p>
              </div>
            </div>
          ))}
        </div>
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
                {['Staff Member', 'Role', 'Status', 'Last Sign-in', 'Joined', 'Actions'].map(h => (
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
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <div className="text-white/70 font-medium mb-1">Unable to load staff</div>
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
                  <td colSpan={6} className="px-4 py-12 text-center text-white/25">
                    {search ? 'No staff members match your search' : 'No staff members yet'}
                  </td>
                </tr>
              ) : (
                filtered.map(u => (
                  <tr key={u.id} className="admin-row">
                    {/* Staff member */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-white/80 truncate max-w-[200px]">
                        {u.full_name || <span className="text-white/25 italic">No name</span>}
                      </p>
                      <p className="text-white/30 mono text-[10px] truncate max-w-[200px]">
                        {u.email}
                      </p>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <RolePill role={u.role} />
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
                        {u.suspended ? (
                          <ActionBtn
                            icon={UserCheck}
                            label="Reactivate"
                            loading={actionLoading === `unsuspend-${u.id}`}
                            onClick={() => handle('unsuspend', u.id)}
                            variant="success"
                          />
                        ) : (
                          <ActionBtn
                            icon={UserX}
                            label="Suspend"
                            loading={actionLoading === `suspend-${u.id}`}
                            onClick={() => handle('suspend', u.id)}
                            variant="danger"
                          />
                        )}
                        {perms.isSuperAdmin && (
                          <ActionBtn
                            icon={Shield}
                            label="Change role"
                            onClick={() => setRoleTarget(u)}
                          />
                        )}
                        <ActionBtn
                          icon={Key}
                          label="Force password reset"
                          loading={actionLoading === `reset-pw-${u.id}`}
                          onClick={() => handle('reset-pw', u.id)}
                        />
                        <ActionBtn
                          icon={Mail}
                          label="Revoke all sessions"
                          loading={actionLoading === `revoke-sessions-${u.id}`}
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

      {!isLoading && (
        <p className="text-[11px] text-white/20 mono">
          Showing {filtered.length} of {staff.length} staff members
        </p>
      )}
    </div>
  );
}
