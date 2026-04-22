import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type AnnType = "info" | "warning" | "success";

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnType;
  is_active: boolean;
  created_at: string;
}

function storageKey(id: string) {
  return `ann-dismissed:${id}`;
}

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  const { data: active = [] } = useQuery<Announcement[]>({
    queryKey: ["active-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id,title,body,type,is_active,created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) {
        if (error.code === "42P01") return [];
        throw error;
      }
      return (data ?? []) as Announcement[];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const map: Record<string, boolean> = {};
    for (const a of active) {
      map[a.id] = localStorage.getItem(storageKey(a.id)) === "1";
    }
    setDismissed(map);
  }, [active]);

  const visible = useMemo(() => active.filter((a) => !dismissed[a.id]), [active, dismissed]);
  const top = visible[0];
  if (!top) return null;

  const style: Record<AnnType, string> = {
    info: "border-blue-500/20 bg-blue-500/5 text-blue-50",
    warning: "border-amber-500/20 bg-amber-500/5 text-amber-50",
    success: "border-emerald-500/20 bg-emerald-500/5 text-emerald-50",
  };

  const dismiss = () => {
    localStorage.setItem(storageKey(top.id), "1");
    setDismissed((d) => ({ ...d, [top.id]: true }));
  };

  return (
    <div
      className={cn(
        "w-full border-b px-3 sm:px-4 py-2.5 flex items-start gap-3",
        "backdrop-blur-md",
        style[top.type] ?? style.info
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold leading-snug truncate">{top.title}</p>
        <p className="text-[11px] opacity-80 leading-snug line-clamp-2">{top.body}</p>
      </div>
      <button
        onClick={dismiss}
        className="opacity-70 hover:opacity-100 transition-opacity mt-0.5"
        aria-label="Dismiss announcement"
      >
        <X size={16} />
      </button>
    </div>
  );
}

