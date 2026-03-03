import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, X, ExternalLink, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const typeColors: Record<string, string> = {
  info: "bg-blue-500/20 text-blue-300",
  success: "bg-emerald-500/20 text-emerald-300",
  warning: "bg-amber-500/20 text-amber-300",
  error: "bg-red-500/20 text-red-300",
};

export function NotificationCenter() {
  const { notifications, unreadCount, isLoading, markRead, markAllRead, archive } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleClick = (id: string, link?: string | null, isRead?: boolean) => {
    if (!isRead) markRead(id);
    if (link) {
      setOpen(false);
      if (link.startsWith("http")) {
        window.open(link, "_blank");
      } else {
        navigate(link);
      }
    }
  };

  const formatTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell size={17} strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 rounded-full bg-violet-500 border-2 border-background text-[9px] font-bold text-white flex items-center justify-center px-0.5">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 bg-[#0a0a0a] border border-border/70 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <Badge className="text-[9px] bg-violet-500/10 text-violet-300 border-violet-500/20 font-normal px-1.5 rounded-full">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] text-muted-foreground hover:text-foreground px-2 gap-1"
              onClick={() => markAllRead()}
            >
              <CheckCheck size={11} />
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto divide-y divide-border/30">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "group relative px-4 py-3 transition-colors cursor-pointer",
                  !n.is_read ? "bg-muted/5 hover:bg-muted/10" : "hover:bg-muted/5"
                )}
                onClick={() => handleClick(n.id, n.link, n.is_read)}
              >
                <div className="flex items-start gap-3">
                  {/* Unread dot */}
                  {!n.is_read && (
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-violet-400 flex-shrink-0" />
                  )}
                  {n.is_read && <span className="mt-1.5 h-2 w-2 flex-shrink-0" />}

                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium leading-snug", !n.is_read ? "text-foreground" : "text-muted-foreground")}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide", typeColors[n.type] || typeColors.info)}>
                        {n.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground/70">{formatTime(n.created_at)}</span>
                      {n.link && <ExternalLink size={9} className="text-muted-foreground/50 ml-auto" />}
                    </div>
                  </div>

                  {/* Dismiss */}
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 mt-0.5 text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); archive(n.id); }}
                    aria-label="Dismiss notification"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-border/50 px-4 py-2.5">
            <Button variant="ghost" size="sm" className="w-full h-7 text-[11px] text-muted-foreground" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
