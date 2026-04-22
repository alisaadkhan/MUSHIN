import { useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const typeColors: Record<string, string> = {
  info: "bg-blue-500/20 text-blue-300",
  success: "bg-emerald-500/20 text-emerald-300",
  warning: "bg-amber-500/20 text-amber-300",
  error: "bg-red-500/20 text-red-300",
};

export default function NotificationsPage() {
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const navigate = useNavigate();

  const visible = filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  const openLink = (id: string, link?: string | null, isRead?: boolean) => {
    if (!isRead) markRead(id);
    if (!link) return;
    if (link.startsWith("http")) {
      window.open(link, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(link);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Notifications</h1>
          <p className="section-subtitle">
            {unreadCount} unread · Latest 50
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => setFilter((f) => (f === "all" ? "unread" : "all"))}
          >
            {filter === "all" ? "Show unread" : "Show all"}
          </Button>
          {unreadCount > 0 && (
            <Button variant="default" size="sm" className="rounded-lg gap-2" onClick={() => markAllRead()}>
              <CheckCheck size={14} />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      <div className="app-card overflow-hidden">
        {isLoading ? (
          <div className="py-14 text-center text-white/25">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading…
          </div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-white/25">
            <Bell className="h-8 w-8 mx-auto mb-3 opacity-50" />
            No notifications
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {visible.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "px-5 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer",
                  !n.is_read && "bg-white/[0.02]",
                )}
                onClick={() => openLink(n.id, n.link, n.is_read)}
              >
                <div className="flex items-start gap-3">
                  {!n.is_read ? <span className="mt-1.5 h-2 w-2 rounded-full bg-violet-400 flex-shrink-0" /> : <span className="mt-1.5 h-2 w-2 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cn("text-[13px] font-semibold truncate", !n.is_read ? "text-white/90" : "text-white/70")}>
                        {n.title}
                      </p>
                      <Badge className={cn("text-[10px] uppercase", typeColors[n.type] || typeColors.info)}>
                        {n.type}
                      </Badge>
                      {n.link && <ExternalLink size={12} className="text-white/25 ml-auto" />}
                    </div>
                    {n.body && <p className="text-[12px] text-white/40 mt-1 whitespace-pre-wrap">{n.body}</p>}
                    <p className="text-[10px] text-white/25 mt-2">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

