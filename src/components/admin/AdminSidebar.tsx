import { Link, useLocation } from "react-router-dom";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import {
  LayoutDashboard, Users, CreditCard, ShieldAlert, BarChart2,
  Settings, ScrollText, Megaphone, ShieldCheck, ChevronRight,
  ArrowLeft, LifeBuoy, Coins,
} from "lucide-react";
import { MushInLogo } from "@/components/ui/MushInLogo";

interface NavItem { icon: React.ElementType; label: string; path: string; }
interface NavGroup { label: string; items: NavItem[]; show: boolean; }

export function AdminSidebar() {
  const location = useLocation();
  const perms = useAdminPermissions();

  const groups: NavGroup[] = [
    {
      label: "Overview",
      show: true,
      items: [
        { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
        { icon: BarChart2, label: "Analytics", path: "/admin/analytics" },
      ],
    },
    {
      label: "Management",
      show: perms.isSupport,
      items: [
        { icon: Users, label: "Users", path: "/admin/users" },
        { icon: CreditCard, label: "Subscriptions", path: "/admin/subscriptions" },
        { icon: Coins, label: "Credits", path: "/admin/credits" },
        { icon: ShieldAlert, label: "Content Moderation", path: "/admin/content" },
      ],
    },
    {
      label: "Communication",
      show: perms.isAdmin || perms.role === "viewer",
      items: [
        { icon: Megaphone, label: "Announcements", path: "/admin/announcements" },
        { icon: LifeBuoy, label: "Support Tickets", path: "/admin/support" },
      ],
    },
    {
      label: "Super Admin",
      show: perms.isSuperAdmin,
      items: [
        { icon: Settings, label: "Configuration", path: "/admin/config" },
        { icon: ScrollText, label: "Audit Log", path: "/admin/audit-log" },
        { icon: ShieldCheck, label: "Permissions", path: "/admin/permissions" },
      ],
    },
  ];

  const roleBadgeColor: Record<string, string> = {
    super_admin: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    admin: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    support: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    viewer: "bg-border/20 text-muted-foreground border-border/30",
  };

  return (
    <aside className="w-60 flex-shrink-0 bg-[#050505] border-r border-border flex flex-col h-screen fixed left-0 top-0 z-40">
      {/* Header */}
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-border">
        <MushInLogo height={28} />
        <p className="text-[9px] text-primary tracking-widest ml-1">Admin Panel</p>
      </div>

      {/* Role badge */}
      {perms.role && perms.role !== "user" && (
        <div className="px-4 py-3">
          <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${roleBadgeColor[perms.role] || roleBadgeColor.viewer}`}>
            <ShieldCheck className="h-2.5 w-2.5" />
            {perms.role.replace("_", " ")}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {groups.filter((g) => g.show).map((group) => (
          <div key={group.label}>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.12em] px-3 mb-1.5">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                        active
                          ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <item.icon size={15} strokeWidth={1.5} />
                        {item.label}
                      </span>
                      {active && <ChevronRight size={11} className="text-primary" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Back to app */}
      <div className="p-3 border-t border-border">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          Back to App
        </Link>
      </div>
    </aside>
  );
}
