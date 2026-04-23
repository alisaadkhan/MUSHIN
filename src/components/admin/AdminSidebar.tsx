import { Link, useLocation } from 'react-router-dom';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import {
  LayoutDashboard, Users, CreditCard, BarChart2,
  Settings, ScrollText, Megaphone, ShieldCheck,
  ArrowLeft, LifeBuoy, Coins, ShieldAlert, UserCog, Key, Shield, Lock
} from 'lucide-react';
import { MushInLogo } from '@/components/ui/MushInLogo';

interface NavItem  { icon: React.ElementType; label: string; path: string; }
interface NavGroup { label: string; items: NavItem[]; show: boolean; }

export function AdminSidebar() {
  const location = useLocation();
  const perms    = useAdminPermissions();

  const groups: NavGroup[] = [
    {
      label: 'Overview',
      show: true,
      items: [
        { icon: LayoutDashboard, label: 'Dashboard',  path: '/admin' },
        { icon: BarChart2,       label: 'Analytics',  path: '/admin/analytics' },
        { icon: CreditCard,      label: 'Revenue',    path: '/admin/revenue' },
      ],
    },
    {
      label: 'Management',
      show: perms.isSupport,
      items: [
        { icon: Users,       label: 'Users',         path: '/admin/users' },
        { icon: UserCog,     label: 'Staff',         path: '/admin/staff' },
        { icon: CreditCard,  label: 'Subscriptions', path: '/admin/subscriptions' },
        { icon: Coins,       label: 'Credits',       path: '/admin/credits' },
      ],
    },
    {
      label: 'Communication',
      show: true,
      items: [
        { icon: Megaphone, label: 'Announcements',   path: '/admin/announcements' },
        { icon: LifeBuoy,  label: 'Support Tickets', path: '/admin/support' },
      ],
    },
    {
      label: 'System',
      show: perms.isSupport,
      items: [
        { icon: ScrollText,  label: 'Audit Log',   path: '/admin/audit-log' },
        { icon: ShieldAlert, label: 'Security',    path: '/admin/security' },
        { icon: ShieldCheck, label: 'Permissions', path: '/admin/permissions' },
        { icon: Settings,    label: 'Config',      path: '/admin/config' },
      ],
    },
    {
      label: 'Super Admin',
      show: perms.isSuperAdmin,
      items: [
        { icon: Shield, label: 'RBAC',            path: '/admin/rbac' },
        { icon: Settings, label: 'System Settings', path: '/admin/system-settings' },
        { icon: Key, label: 'API Keys',           path: '/admin/api-keys' },
        { icon: Lock, label: 'Impersonation',     path: '/admin/impersonation' },
        { icon: ShieldAlert, label: 'Security Flags', path: '/admin/security/flags' },
        { icon: Lock, label: 'Support Oversight', path: '/admin/security/support-activity' },
      ],
    },
  ];

  /* Role badge style — monochrome except role type */
  const roleBadge: Record<string, string> = {
    super_admin: 'bg-white/8 text-white/80 border-white/15',
    admin:       'bg-white/5 text-white/60 border-white/10',
    support:     'bg-white/4 text-white/50 border-white/8',
    viewer:      'bg-white/3 text-white/40 border-white/6',
  };

  return (
    <aside className="w-56 flex-shrink-0 bg-[#020202] border-r border-white/6 flex flex-col h-screen fixed left-0 top-0 z-40">

      {/* Header */}
      <div className="flex h-12 items-center gap-3 px-4 border-b border-white/6">
        <MushInLogo height={24} />
        <span className="text-[9px] text-white/30 tracking-[0.2em] uppercase font-medium ml-0.5">
          Admin
        </span>
      </div>

      {/* Role badge */}
      {perms.role && perms.role !== 'user' && (
        <div className="px-4 py-2.5 border-b border-white/4">
          <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${roleBadge[perms.role] ?? roleBadge.viewer}`}>
            <ShieldCheck size={8} />
            {perms.role.replace('_', ' ')}
          </span>
        </div>
      )}

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-4 px-2">
        {groups.filter(g => g.show).map(group => (
          <div key={group.label}>
            <p className="px-2 mb-1 text-[9px] font-semibold uppercase tracking-widest text-white/25">
              {group.label}
            </p>
            {group.items.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded text-[12px] font-medium transition-colors ${
                    active
                      ? 'bg-white/8 text-white'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/4'
                  }`}
                >
                  <item.icon size={13} className="shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Links */}
      <div className="px-2 py-3 border-t border-white/6 space-y-1">
        <Link
          to="/update-password"
          state={{ requireOld: true }}
          className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-white/30 hover:text-white/60 hover:bg-white/4 transition-colors"
        >
          <Key size={12} />
          Change Password
        </Link>
      </div>

    </aside>
  );
}
