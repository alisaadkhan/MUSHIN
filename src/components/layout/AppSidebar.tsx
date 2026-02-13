import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/auth/UserMenu";
import {
  LayoutDashboard,
  Search,
  Users,
  Megaphone,
  Bookmark,
  History,
  Settings,
  Zap,
  CreditCard,
} from "lucide-react";
import { useWorkspaceCredits } from "@/hooks/useWorkspaceCredits";
import { useSubscription } from "@/hooks/useSubscription";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { label: "Discover", icon: Search, path: "/search" },
  { label: "Lists", icon: Users, path: "/lists" },
  { label: "Campaigns", icon: Megaphone, path: "/campaigns" },
  { label: "Saved Searches", icon: Bookmark, path: "/saved-searches" },
  { label: "History", icon: History, path: "/history" },
  { label: "Settings", icon: Settings, path: "/settings" },
  { label: "Billing", icon: CreditCard, path: "/billing" },
];

export function AppSidebar() {
  const location = useLocation();
  const { data: credits } = useWorkspaceCredits();
  const { planConfig, plan } = useSubscription();

  const totalCredits = credits?.search_credits_remaining ?? planConfig.search_credits;
  const maxCredits = planConfig.search_credits;
  const pct = (totalCredits / maxCredits) * 100;

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold tracking-tight">
          <span className="aurora-text">Influence</span>
          <span className="text-foreground">IQ</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path === "/lists" && location.pathname.startsWith("/lists")) ||
            (item.path === "/campaigns" && location.pathname.startsWith("/campaigns"));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Credits + User */}
      <div className="border-t border-border p-4 space-y-3">
        <div className="glass-card rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>{planConfig.name} Plan</span>
            <span className="data-mono">{totalCredits} / {maxCredits}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
        <UserMenu />
      </div>
    </aside>
  );
}
