import { Link, useLocation } from "react-router-dom";
import { UserMenu } from "@/components/auth/UserMenu";
import {
  Zap, LayoutDashboard, Search, List, Megaphone, Bookmark, Clock,
  PieChart, Settings, CreditCard
} from "lucide-react";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
import { useSubscription } from "@/hooks/useSubscription";

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
    ],
  },
];

interface AppSidebarProps {
  isOpen?: boolean;
}

export function AppSidebar({ isOpen = true }: AppSidebarProps) {
  const location = useLocation();
  const { data: credits } = useWorkspaceCredits();
  const { planConfig, plan } = useSubscription();

  const totalCredits = credits?.search_credits_remaining ?? planConfig.search_credits;
  const maxCredits = planConfig.search_credits;
  const pct = (totalCredits / maxCredits) * 100;

  return (
    <aside className={`${isOpen ? "w-60" : "w-0 overflow-hidden"} border-r border-border bg-white/80 backdrop-blur-md flex-shrink-0 transition-all duration-200 flex flex-col z-40 fixed left-0 top-0 h-screen sm:relative`}>
      <div className="flex h-14 items-center gap-2 px-4 border-b border-border">
        <Zap className="w-5 h-5 text-primary" strokeWidth={1.5} />
        <span className="font-bold text-foreground">InfluenceIQ</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                    >
                      <item.icon size={18} strokeWidth={1.5} />
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
        {/* Credits */}
        <div className="glass-card rounded-lg p-3 bg-muted/30 border-border/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>{planConfig.name} Plan</span>
            <span className="data-mono font-medium text-foreground">{totalCredits} / {maxCredits}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>

        {/* User Menu */}
        <div className="w-full">
          <UserMenu />
        </div>
      </div>
    </aside>
  );
}
