import { Link, useLocation } from "react-router-dom";
import { UserMenu } from "@/components/auth/UserMenu";
import {
  LayoutDashboard, Search, List, Megaphone, Bookmark, Clock,
  PieChart, Settings, CreditCard, ShieldCheck, LifeBuoy,
} from "lucide-react";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
import { useSubscription } from "@/hooks/useSubscription";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { MushinLogo } from "@/components/mushin-brand";

const navGroups = [
  {
    label: "Core",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
      { icon: PieChart, label: "Analytics", path: "/analytics" },
    ],
  },
  {
    label: "Discovery",
    items: [
      { icon: Search, label: "Discover", path: "/search" },
      { icon: Bookmark, label: "Saved Searches", path: "/saved-searches" },
      { icon: Clock, label: "History", path: "/history" },
    ],
  },
  {
    label: "Management",
    items: [
      { icon: List, label: "Lists", path: "/lists" },
      { icon: Megaphone, label: "Campaigns", path: "/campaigns" },
    ],
  },
  {
    label: "Account",
    items: [
      { icon: Settings, label: "Settings", path: "/settings" },
      { icon: CreditCard, label: "Billing", path: "/billing" },
      { icon: LifeBuoy, label: "Support", path: "/support" },
    ],
  },
];

interface AppSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function AppSidebar({ isOpen = true, onClose }: AppSidebarProps) {
  const location = useLocation();
  const { data: credits } = useWorkspaceCredits();
  const { planConfig, plan } = useSubscription();
  const { isAnyAdmin } = useAdminPermissions();

  const totalCredits = credits?.search_credits_remaining ?? planConfig.search_credits;
  const maxCredits = planConfig.search_credits;
  const pct = Math.min((totalCredits / maxCredits) * 100, 100);

  return (
    <aside
      className={`${
        isOpen ? "w-64 lg:w-60" : "w-0 overflow-hidden lg:w-0"
      } border-r border-border bg-[#070707] flex-shrink-0 transition-all duration-200 flex flex-col z-40 fixed left-0 top-0 h-screen lg:relative`}
    >
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-border">
        <MushinLogo size={26} />
        <span className="font-extrabold tracking-widest text-foreground text-sm uppercase" style={{ fontFamily: "'Syne', sans-serif", letterSpacing: "0.1em" }}>
          MUSHIN
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Admin link */}
        {isAnyAdmin && (
          <div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.12em] px-3 mb-2">Admin</p>
            <ul className="space-y-0.5">
              <li>
                <Link
                  to="/admin"
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    location.pathname.startsWith("/admin")
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20 border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <ShieldCheck size={16} strokeWidth={1.5} />
                  Admin Panel
                </Link>
              </li>
            </ul>
          </div>
        )}

        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.12em] px-3 mb-2">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  location.pathname === item.path ||
                  location.pathname.startsWith(item.path + "/");
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                        active
                          ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <item.icon size={16} strokeWidth={1.5} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-border space-y-3">
        {/* Credits widget */}
        <div className="rounded-lg p-3 bg-muted/40 border border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>{planConfig.name} Plan</span>
            <span className="data-mono font-semibold text-foreground">
              {totalCredits} / {maxCredits}
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%`, boxShadow: "0 0 8px rgba(168,85,247,0.5)" }}
            />
          </div>
        </div>
        <div className="w-full">
          <UserMenu />
        </div>
      </div>
    </aside>
  );
}
