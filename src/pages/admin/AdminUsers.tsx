import { useEffect, useState } from 'react';
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { invokeEdgeAuthed } from '@/lib/edge';
import {
  Search, UserX, UserCheck, Key, Shield, Loader2,
  ChevronDown, MoreHorizontal, RefreshCw, Mail, UserPlus, Monitor, X, MonitorSmartphone
} from 'lucide-react';
import { History } from 'lucide-react';
import { CreditCard } from 'lucide-react';

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
      const { data, error } = await invokeEdgeAuthed('admin-create-user', {
        body: { email, password, full_name: fullName, role },
      } as any);
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

/* ── Create Support Staff (Staff ID) Dialog ─────────────────── */
interface CreateSupportStaffDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}
function CreateSupportStaffDialog({ onClose, onSuccess }: CreateSupportStaffDialogProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('support');
  const [loading, setLoading] = useState(false);
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
        description: `Staff ID: ${data.employee_id} (login at /support/login)`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: 'Failed to create support staff', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="app-card w-80 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Create Support Staff (Staff ID)</h3>
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

/* ── Sessions Dialog ────────────────────────────────────────── */
interface SessionsDialogProps {
  user: UserRow;
  onClose: () => void;
}
function SessionsDialog({ user, onClose }: SessionsDialogProps) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await invokeEdgeAuthed('admin-get-sessions', {
          body: { userId: user.id }
        } as any);
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setSessions(data?.sessions || []);
      } catch (err: any) {
        toast({ title: 'Failed to load sessions', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.id, toast]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f0f0f] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h3 className="text-lg font-semibold text-white">Active Devices</h3>
            <p className="text-sm text-white/40 mt-0.5">Sessions for {user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/40">
              <Loader2 size={24} className="animate-spin mb-4" />
              <p className="text-sm">Fetching session data...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-white/40 bg-white/5 rounded-lg border border-white/5 border-dashed">
              <MonitorSmartphone size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No active sessions found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s, idx) => (
                <div key={s.id || idx} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 flex-shrink-0">
                    <Monitor size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-white truncate pr-4">{s.device}</p>
                      <span className="text-[10px] uppercase tracking-wider text-white/30 whitespace-nowrap bg-white/5 px-2 py-0.5 rounded">
                        {idx === 0 ? "Latest" : "Active"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-white/30 mb-0.5">IP Address</p>
                        <p className="text-xs text-white/70 font-mono">{s.ip}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-white/30 mb-0.5">Last Active</p>
                        <p className="text-xs text-white/70">{new Date(s.updated_at).toLocaleString()}</p>
                      </div>
                      <div className="col-span-2 mt-1">
                        <p className="text-[10px] uppercase tracking-widest text-white/30 mb-0.5">Raw User Agent</p>
                        <p className="text-[10px] text-white/40 truncate" title={s.raw_user_agent}>{s.raw_user_agent}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Activity Log Dialog ───────────────────────────────────── */
interface ActivityDialogProps {
  user: UserRow;
  onClose: () => void;
}
function ActivityDialog({ user, onClose }: ActivityDialogProps) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await invokeEdgeAuthed('admin-get-activity-log', {
          body: { userId: user.id, limit: 250 },
        } as any);
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setLogs(data?.logs || []);
      } catch (err: any) {
        toast({ title: 'Failed to load activity logs', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.id, toast]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f0f0f] border border-white/10 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h3 className="text-lg font-semibold text-white">Activity Log</h3>
            <p className="text-sm text-white/40 mt-0.5">Recent activity for {user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/40">
              <Loader2 size={24} className="animate-spin mb-4" />
              <p className="text-sm">Loading activity…</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-white/40 bg-white/5 rounded-lg border border-white/5 border-dashed">
              <History size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No activity logs found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((l, idx) => (
                <div key={l.id || idx} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{l.action_type}</p>
                      <p className="text-[11px] text-white/40 truncate">
                        {l.status === 'error' ? 'error' : 'success'} · {new Date(l.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${
                      l.status === 'error'
                        ? 'bg-red-500/10 text-red-300 border-red-500/20'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    }`}>
                      {l.status}
                    </span>
                  </div>
                  {(l.ip_address || l.device_info) && (
                    <p className="text-[10px] text-white/35 mt-2">
                      {l.ip_address ? `IP: ${l.ip_address}` : ''}
                      {l.ip_address && l.device_info ? ' · ' : ''}
                      {l.device_info ? `Device: ${l.device_info}` : ''}
                    </p>
                  )}
                  {l.metadata && (
                    <pre className="mt-2 text-[10px] text-white/40 whitespace-pre-wrap break-words bg-black/20 border border-white/10 rounded p-2 max-h-40 overflow-auto">
                      {JSON.stringify(l.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Send Notification Dialog ──────────────────────────────── */
function SendUserNotificationDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<"info" | "warning" | "success">("info");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Title and body are required", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await invokeEdgeAuthed("admin-send-notification", {
        body: {
          p_title: title.trim(),
          p_body: body.trim(),
          p_type: type,
          p_link: link.trim() || null,
          p_target_type: "user",
          p_target_value: user.id,
        },
      } as any);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Notification sent" });
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="app-card w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Send Notification</h3>
            <p className="text-[12px] text-white/40">To {user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-white/40 uppercase relative -bottom-1">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-sharp w-full" placeholder="Short title" />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase relative -bottom-1">Body</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="input-sharp w-full resize-none" placeholder="Message…" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <label className="text-[10px] text-white/40 uppercase relative -bottom-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as any)} className="input-sharp w-full !pr-8 bg-[#0a0114] text-[13px]">
                <option value="info">INFO</option>
                <option value="warning">WARNING</option>
                <option value="success">SUCCESS</option>
              </select>
            </div>
            <div className="flex-[2] min-w-[220px]">
              <label className="text-[10px] text-white/40 uppercase relative -bottom-1">Link (optional)</label>
              <input value={link} onChange={(e) => setLink(e.target.value)} className="input-sharp w-full" placeholder="/billing or https://…" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSend} disabled={sending} className="btn-primary flex-1">
            {sending ? <Loader2 size={13} className="animate-spin" /> : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Change Plan Dialog ─────────────────────────────────────── */
function ChangePlanDialog({ user, onClose, onChanged }: { user: UserRow; onClose: () => void; onChanged: () => void }) {
  const { toast } = useToast();
  const [plan, setPlan] = useState<string>(user.plan ?? "free");
  const [saving, setSaving] = useState(false);

  const apply = async () => {
    setSaving(true);
    try {
      const { data, error } = await invokeEdgeAuthed("admin-set-user-plan", {
        body: { target_user_id: user.id, plan },
      } as any);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Plan updated", description: `User is now on ${plan.toUpperCase()}` });
      onChanged();
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to update plan", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="app-card w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Change Plan</h3>
            <p className="text-[12px] text-white/40">For {user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-white/40 uppercase relative -bottom-1">Plan</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="input-sharp w-full !pr-8 bg-[#0a0114] text-[13px]">
            <option value="free">FREE</option>
            <option value="pro">PRO</option>
            <option value="business">BUSINESS</option>
            <option value="enterprise">ENTERPRISE</option>
          </select>
          <p className="text-[11px] text-white/25">
            This is an admin override and applies immediately in-app.
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={apply} disabled={saving} className="btn-primary flex-1">
            {saving ? <Loader2 size={13} className="animate-spin" /> : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function AdminUsers() {
  const { user, session } = useAuth();
  const perms = useAdminPermissions();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null);
  const [sessionTarget, setSessionTarget] = useState<UserRow | null>(null);
  const [activityTarget, setActivityTarget] = useState<UserRow | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<UserRow | null>(null);
  const [planTarget, setPlanTarget] = useState<UserRow | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateSupportDialog, setShowCreateSupportDialog] = useState(false);

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

  // Only show regular users — staff (support/admin/super_admin/viewer) live in the Staff page.
  // Also hide the currently logged in user to prevent self-suspension.
  const users = allUsers.filter(u => u.role === 'user' && u.id !== user?.id);

  useEffect(() => {
    if (!error) return;
    const anyErr = error as any;
    const status = anyErr?.context?.status ?? anyErr?.status ?? null;
    const body = anyErr?.context?.body ?? anyErr?.context?.responseBody ?? null;
    const hint = status === 401
      ? 'Unauthorized (sign in again).'
      : status === 403
        ? 'Forbidden (your account is not an admin/support role).'
        : status
          ? `Request failed (${status}).`
          : null;
    toast({
      title: 'Failed to load users',
      description:
        (body?.error ? String(body.error) : null) ??
        anyErr?.message ??
        hint ??
        'Admin request failed',
      variant: 'destructive',
    });
  }, [error, toast]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  /* ── Actions ── */
  const callAdmin = async (fn: string, body: object) => {
    const { data, error } = await invokeEdgeAuthed(fn, { body } as any);
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

      {/* Sessions dialog */}
      {sessionTarget && (
        <SessionsDialog
          user={sessionTarget}
          onClose={() => setSessionTarget(null)}
        />
      )}

      {/* Activity dialog */}
      {activityTarget && (
        <ActivityDialog
          user={activityTarget}
          onClose={() => setActivityTarget(null)}
        />
      )}

      {/* Notify dialog */}
      {notifyTarget && (
        <SendUserNotificationDialog
          user={notifyTarget}
          onClose={() => setNotifyTarget(null)}
        />
      )}

      {/* Change plan dialog */}
      {planTarget && (
        <ChangePlanDialog
          user={planTarget}
          onClose={() => setPlanTarget(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ['admin-users-v2'] })}
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
          {perms.isAnyAdmin && (
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

      {showCreateSupportDialog && (
        <CreateSupportStaffDialog
          onClose={() => setShowCreateSupportDialog(false)}
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
                      <Link to={`/admin/users/${u.id}`} className="block">
                        <p className="font-medium text-white/80 truncate max-w-[180px] hover:underline">
                          {u.full_name || <span className="text-white/25 italic">No name</span>}
                        </p>
                      </Link>
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
                      {u.plan
                        ? <span className="text-white/60 capitalize">{u.plan}</span>
                        : <span className="text-white/25 text-[11px]">Not subscribed</span>
                      }
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
                          icon={UserX}
                          label="Revoke all sessions"
                          loading={loading === `revoke-sessions-${u.id}`}
                          onClick={() => handle('revoke-sessions', u.id)}
                          variant="danger"
                        />

                        {/* View Devices */}
                        <ActionBtn
                          icon={Monitor}
                          label="View Devices"
                          onClick={() => setSessionTarget(u)}
                        />

                        {/* View Activity Log */}
                        <ActionBtn
                          icon={History}
                          label="View Activity Log"
                          onClick={() => setActivityTarget(u)}
                        />

                        {/* Notify user */}
                        <ActionBtn
                          icon={Mail}
                          label="Send notification"
                          onClick={() => setNotifyTarget(u)}
                        />

                        {/* Change plan */}
                        <ActionBtn
                          icon={CreditCard}
                          label="Change plan"
                          onClick={() => setPlanTarget(u)}
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
