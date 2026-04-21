import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, CreditCard, Activity, AlertTriangle,
  TrendingUp, TrendingDown, Minus, ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';

/* ── Types ───────────────────────────────────────────────── */
interface DashboardStats {
  totalUsers: number;
  activeUsers7d: number;
  activeSubs: number;
  totalSubs: number;
  totalWorkspaces: number;
  recentAuditActions: AuditRow[];
  suspendedUsers: number;
  creditEventsToday: number;
  lastUpdatedAt: string;
}

interface AuditRow {
  id: string;
  timestamp: string;
  action_type: string;
  action_description: string;
  actor_user_id: string | null;
}

/* ── KPI Card ────────────────────────────────────────────── */
interface KPIProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'flat';
  href?: string;
}

function KPICard({ label, value, sub, icon: Icon, trend, href }: KPIProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-white/25';

  const inner = (
    <div className="app-card p-5 hover:border-white/18 transition-colors duration-150 group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-8 h-8 rounded bg-white/5 border border-white/8 flex items-center justify-center">
          <Icon size={14} strokeWidth={1.5} className="text-white/50" />
        </div>
        {trend && <TrendIcon size={13} className={trendColor} />}
      </div>
      <p className="stat-num text-3xl font-semibold text-white mb-0.5">{value}</p>
      <p className="text-[12px] text-white/40 font-medium">{label}</p>
      {sub && <p className="text-[11px] text-white/25 mt-0.5">{sub}</p>}
      {href && (
        <div className="mt-3 flex items-center gap-1 text-[11px] text-white/25 group-hover:text-white/50 transition-colors">
          View all <ArrowRight size={10} />
        </div>
      )}
    </div>
  );

  return href ? <Link to={href}>{inner}</Link> : inner;
}

/* ── Status Dot ──────────────────────────────────────────── */
const StatusDot = ({ ok }: { ok: boolean }) => (
  <span
    className={`inline-block w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`}
  />
);

/* ── Action label formatter ──────────────────────────────── */
function formatAction(action: string) {
  return action.replace(/[:._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)  return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ── Main Dashboard ──────────────────────────────────────── */
export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['admin-dashboard-v2'],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startIso = startOfDay.toISOString();

      const [usersRes, subsRes, wsRes, auditRes, suspendedRes, creditTodayRes] = await Promise.all([
        supabase.functions.invoke('admin-list-users'),
        supabase.from('subscriptions').select('id,plan,status', { count: 'exact' }),
        supabase.from('workspaces').select('id', { count: 'exact', head: true }),
        supabase
          .from('system_audit_logs')
          .select('id,timestamp,action_type,action_description,actor_user_id')
          .order('timestamp', { ascending: false })
          .limit(8),
        supabase
          .from('user_suspensions')
          .select('id', { count: 'exact', head: true })
          .is('lifted_at', null),
        supabase
          .from('credit_transactions')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startIso),
      ]);

      const activeSubs = (subsRes.data ?? []).filter(s => s.status === 'active').length;
      const totalUsers = Array.isArray((usersRes as any)?.data?.users) ? (usersRes as any).data.users.length : 0;

      return {
        totalUsers,
        activeUsers7d:     0,                           // needs active_at column
        activeSubs,
        totalSubs:         subsRes.count      ?? 0,
        totalWorkspaces:   wsRes.count        ?? 0,
        recentAuditActions: (auditRes.data    ?? []) as AuditRow[],
        suspendedUsers:    suspendedRes.count ?? 0,
        creditEventsToday: creditTodayRes.count ?? 0,
        lastUpdatedAt: new Date().toISOString(),
      };
    },
    staleTime: 30_000,
    refetchInterval: 10_000,
  });

  const dash = (v: string | number) => (isLoading ? '—' : v);

  const kpis: KPIProps[] = [
    {
      label: 'Total Users',
      value: dash(stats?.totalUsers ?? 0),
      sub: `${stats?.suspendedUsers ?? 0} suspended`,
      icon: Users,
      trend: 'up',
      href: '/admin/users',
    },
    {
      label: 'Active Subscriptions',
      value: dash(stats?.activeSubs ?? 0),
      sub: `of ${stats?.totalSubs ?? 0} total`,
      icon: CreditCard,
      trend: 'flat',
      href: '/admin/subscriptions',
    },
    {
      label: 'Workspaces',
      value: dash(stats?.totalWorkspaces ?? 0),
      icon: Activity,
      trend: 'up',
    },
    {
      label: 'Suspended Users',
      value: dash(stats?.suspendedUsers ?? 0),
      sub: 'Awaiting lift',
      icon: AlertTriangle,
      trend: stats?.suspendedUsers ? 'down' : 'flat',
      href: '/admin/users',
    },
  ];

  const systemServices = [
    { label: 'Database', ok: !isLoading },
    { label: 'Credit Ledger', ok: !isLoading },
    { label: 'Audit Log', ok: !isLoading },
  ];

  return (
    <div className="space-y-8 p-8">

      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="section-title">Dashboard</h1>
          <p className="section-subtitle">
            Platform overview · Real-time
            {!isLoading && stats?.lastUpdatedAt && (
              <span className="text-white/20 mono"> · updated {timeAgo(stats.lastUpdatedAt)}</span>
            )}
          </p>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(k => <KPICard key={k.label} {...k} />)}
      </div>

      {/* Lower grid */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* Recent audit activity */}
        <div className="app-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-[13px] font-semibold text-white">Recent Audit Activity</h2>
            <Link
              to="/admin/audit-log"
              className="text-[11px] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
            >
              View all <ArrowRight size={10} />
            </Link>
          </div>

          {isLoading ? (
            <div className="px-5 py-8 text-center text-[12px] text-white/25">Loading…</div>
          ) : (stats?.recentAuditActions?.length ?? 0) === 0 ? (
            <div className="px-5 py-8 text-center text-[12px] text-white/25">
              No audit events yet. Actions will appear once admin operations are performed.
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {stats!.recentAuditActions.map(row => (
                <li key={row.id} className="flex items-start justify-between px-5 py-3 hover:bg-white/[0.015] transition-colors">
                  <div>
                    <p className="text-[12px] font-medium text-white/80">
                      {formatAction(row.action_type)}
                    </p>
                    <p className="text-[11px] text-white/30 mt-0.5">
                      {row.actor_user_id ? `${row.actor_user_id.slice(0, 8)}…` : 'System'} · {row.action_description}
                    </p>
                  </div>
                  <span className="text-[10px] text-white/20 whitespace-nowrap ml-4 mt-0.5 mono">
                    {timeAgo(row.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* System status */}
        <div className="space-y-5">
          <div className="app-card">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-[13px] font-semibold text-white">System Status</h2>
            </div>
            <ul className="divide-y divide-border/40">
              {systemServices.map(s => (
                <li key={s.label} className="flex items-center justify-between px-5 py-3">
                  <span className="text-[12px] text-white/50">{s.label}</span>
                  <div className="flex items-center gap-2">
                    <StatusDot ok={s.ok} />
                    <span className={`text-[11px] ${s.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                      {s.ok ? 'Operational' : 'Degraded'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick actions */}
          <div className="app-card p-5">
            <h2 className="text-[13px] font-semibold text-white mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Adjust Credits', href: '/admin/credits' },
                { label: 'Manage Users',   href: '/admin/users' },
                { label: 'Audit Log',      href: '/admin/audit-log' },
                { label: 'Permissions',    href: '/admin/permissions' },
              ].map(({ label, href }) => (
                <Link
                  key={href}
                  to={href}
                  className="flex items-center justify-between px-3 py-2 rounded bg-white/3 border border-white/6
                             text-[12px] text-white/50 hover:text-white hover:bg-white/6 hover:border-white/12
                             transition-colors duration-100"
                >
                  {label}
                  <ArrowRight size={10} className="opacity-40" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
