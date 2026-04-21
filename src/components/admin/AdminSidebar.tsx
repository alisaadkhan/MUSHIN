import { Link, useLocation } from 'react-router-dom';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import {
  LayoutDashboard, Users, CreditCard, BarChart2,
  Settings, ScrollText, Megaphone, ShieldCheck,
  ArrowLeft, LifeBuoy, Coins, ShieldAlert, BookOpen,
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
      ],
    },
    {
      label: 'Management',
      show: perms.isSupport,
      items: [
        { icon: Users,     label: 'Users',         path: '/admin/users' },
        { icon: CreditCard,label: 'Subscriptions', path: '/admin/subscriptions' },
        { icon: Coins,     label: 'Credits',       path: '/admin/credits' },
        { icon: ShieldAlert, label: 'Content',     path: '/admin/content' },
      ],
    },
    {
      label: 'Communication',
      show: true,
      items: [
        { icon: Megaphone, label: 'Announcements',    path: '/admin/announcements' },
        { icon: LifeBuoy,  label: 'Support Tickets',  path: '/admin/support' },
      ],
    },
    {
      label: 'System',
      show: perms.isSupport,
      items: [
        { icon: ScrollText,  label: 'Audit Log',    path: '/admin/audit-log' },
        { icon: ShieldAlert, label: 'Security',     path: '/admin/security' },
        { icon: ShieldCheck, label: 'Permissions',  path: '/admin/permissions' },
        { icon: Settings,    label: 'Config',       path: '/admin/config' },
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {groups.filter(g => g.show).map(group => (
          <div key={group.label}>
            <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.14em] px-3 mb-1">
              {group.label}
            </p>
            <ul className="space-y-px">
              {group.items.map(item => {
                const active = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-[13px] transition-colors duration-100 ${
                        active
                          ? 'bg-white/8 text-white font-medium'
                          : 'text-white/40 hover:text-white/70 hover:bg-white/4'
                      }`}
                    >
                      <item.icon
                        size={13}
                        strokeWidth={active ? 2 : 1.5}
                        className={active ? 'text-white' : 'text-white/40'}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Back to app */}
      <div className="p-3 border-t border-white/5">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 px-3 py-1.5 rounded text-[12px] text-white/25 hover:text-white/50 hover:bg-white/4 transition-colors"
        >
          <ArrowLeft size={11} />
          Back to app
        </Link>
      </div>
    </aside>
  );
}
