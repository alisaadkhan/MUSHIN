import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, Trash2, Loader2, Send, History } from "lucide-react";

type AnnType = "info" | "warning" | "success";
type TargetType = "all" | "role" | "plan" | "user";

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnType;
  is_active: boolean;
  created_at: string;
}

interface NotifLog {
  id: string;
  title: string;
  body: string;
  type: string;
  target_type: string;
  target_value: string | null;
  sent_count: number;
  created_at: string;
}

const typeColors: Record<string, string> = {
  info: "border-blue-500/30 bg-blue-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  success: "border-emerald-500/30 bg-emerald-500/5",
};
const typeBadge: Record<string, string> = {
  info: "bg-blue-500/20 text-blue-300",
  warning: "bg-amber-500/20 text-amber-300",
  success: "bg-emerald-500/20 text-emerald-300",
};

export default function AdminAnnouncements() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<AnnType>("info");
  const [link, setLink] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [targetValue, setTargetValue] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [sendingNotif, setSendingNotif] = useState(false);
  const [tab, setTab] = useState<"compose" | "history">("compose");

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
  });

  const { data: notifLog = [] } = useQuery<NotifLog[]>({
    queryKey: ["admin-notification-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as NotifLog[];
    },
    enabled: tab === "history",
  });

  const handlePublish = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Please fill both title and body", variant: "destructive" });
      return;
    }
    setPublishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("announcements").insert({
        title: title.trim(),
        body: body.trim(),
        type,
        is_active: true,
        admin_user_id: user?.id,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Announcement published" });
      setTitle("");
      setBody("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const handleSendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Please fill both title and body", variant: "destructive" });
      return;
    }
    if ((targetType === "role" || targetType === "plan" || targetType === "user") && !targetValue.trim()) {
      toast({ title: "Please specify the target value", variant: "destructive" });
      return;
    }
    setSendingNotif(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-send-notification", {
        body: {
          p_title: title.trim(),
          p_body: body.trim(),
          p_type: type,
          p_link: link.trim() || null,
          p_target_type: targetType,
          p_target_value: targetValue.trim() || null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(String((data as any).error));
      qc.invalidateQueries({ queryKey: ["admin-notification-log"] });
      toast({ title: "In-app notifications sent" });
    } catch (err: any) {
      toast({ title: "Error sending notifications", description: err.message, variant: "destructive" });
    } finally {
      setSendingNotif(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    await supabase.from("announcements").update({ is_active: false }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    toast({ title: "Announcement deactivated" });
  };

  const handleDelete = async (id: string) => {
    await supabase.from("announcements").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    toast({ title: "Announcement deleted" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Announcements & Notifications</h1>
        <p className="text-muted-foreground">Publish announcements and send in-app notifications to users</p>
      </div>

      <div className="flex gap-2">
        {(["compose", "history"] as const).map((t) => (
          <Button
            key={t}
            variant={tab === t ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t)}
            className={`rounded-lg capitalize gap-2 ${tab === t ? "bg-violet-600 hover:bg-violet-700 text-white" : ""}`}
          >
            {t === "history" ? <History size={13} /> : <Megaphone size={13} />}
            {t}
          </Button>
        ))}
      </div>

      {tab === "compose" && (
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">Compose</h2>
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-[#070707] border-border text-slate-200 placeholder:text-muted-foreground focus:border-violet-500"
            />
            <textarea
              placeholder="Body text…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-[#070707] border border-border text-sm text-slate-300 placeholder:text-muted-foreground resize-none focus:outline-none focus:border-violet-500"
            />
            <Input
              placeholder="Link URL (optional, e.g. /billing or https://…)"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="bg-[#070707] border-border text-slate-200 placeholder:text-muted-foreground focus:border-violet-500"
            />
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AnnType)}
                className="h-9 px-3 rounded-lg bg-[#070707] border border-border text-sm text-slate-300 focus:outline-none focus:border-violet-500"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="success">Success</option>
              </select>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as TargetType)}
                className="h-9 px-3 rounded-lg bg-[#070707] border border-border text-sm text-slate-300 focus:outline-none focus:border-violet-500"
              >
                <option value="all">All Users</option>
                <option value="role">By Role</option>
                <option value="plan">By Plan</option>
                <option value="user">Specific User ID</option>
              </select>
              {targetType !== "all" && (
                <Input
                  placeholder={
                    targetType === "role" ? "e.g. admin" :
                    targetType === "plan" ? "e.g. growth" :
                    "User UUID"
                  }
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className="h-9 w-48 bg-[#070707] border-border text-slate-200 placeholder:text-muted-foreground focus:border-violet-500"
                />
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                onClick={handlePublish}
                disabled={publishing}
                className="gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
              >
                {publishing ? <Loader2 size={14} className="animate-spin" /> : <Plus className="h-4 w-4" />}
                Publish Announcement
              </Button>
              <Button
                onClick={handleSendNotification}
                disabled={sendingNotif}
                variant="outline"
                className="gap-2 rounded-lg border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
              >
                {sendingNotif ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send In-App Notification
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              "Publish" saves to the announcements banner. "Send In-App Notification" pushes to each user's notification center immediately.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Published Announcements</h2>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : announcements.length === 0 ? (
              <div className="glass-card rounded-2xl p-10 text-center">
                <Megaphone className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">No announcements yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className={`border rounded-xl p-4 flex items-start justify-between gap-4 ${typeColors[a.type]} ${!a.is_active ? "opacity-50" : ""}`}>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${typeBadge[a.type]}`}>{a.type}</span>
                        <span className="text-slate-200 font-medium text-sm">{a.title}</span>
                        {!a.is_active && <Badge className="text-[9px] bg-muted/20 text-muted-foreground border-border px-1.5">inactive</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{a.body}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {a.is_active && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:bg-muted/10" onClick={() => handleDeactivate(a.id)}>
                          Deactivate
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Notification Send History</h2>
          {notifLog.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center">
              <History className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No notifications sent yet.</p>
            </div>
          ) : (
            notifLog.map((log) => (
              <div key={log.id} className="glass-card rounded-xl p-4 flex items-start gap-4">
                <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-full self-start ${typeBadge[log.type] || typeBadge.info}`}>
                  {log.type}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{log.title}</p>
                  {log.body && <p className="text-xs text-muted-foreground mt-0.5">{log.body}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-muted-foreground">Target: {log.target_type}{log.target_value ? ` → ${log.target_value}` : ""}</span>
                    <span className="text-[10px] text-muted-foreground">{log.sent_count} sent</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

