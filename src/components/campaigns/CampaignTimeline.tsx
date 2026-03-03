import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Plus, Trash2, Pencil, Palette, Users, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCampaignActivity } from "@/hooks/useCampaignActivity";
import { useState } from "react";

const actionConfig: Record<string, { icon: any; color: string; label: (d: any) => string }> = {
  card_moved: {
    icon: ArrowRight,
    color: "#3b82f6",
    label: (d) => `${d.username || "Card"} moved from ${d.from_stage} to ${d.to_stage}`,
  },
  card_updated: {
    icon: Pencil,
    color: "#f59e0b",
    label: (d) => `${d.username || "Card"} updated`,
  },
  card_removed: {
    icon: Trash2,
    color: "#ef4444",
    label: (d) => `${d.username || "Card"} removed from pipeline`,
  },
  stage_created: {
    icon: Plus,
    color: "#22c55e",
    label: (d) => `Stage "${d.name}" created`,
  },
  stage_renamed: {
    icon: Pencil,
    color: "#f59e0b",
    label: (d) => `Stage renamed from "${d.from}" to "${d.to}"`,
  },
  stage_deleted: {
    icon: Trash2,
    color: "#ef4444",
    label: (d) => `Stage "${d.name}" deleted`,
  },
  stage_color_changed: {
    icon: Palette,
    color: "#a855f7",
    label: (d) => `Stage "${d.name}" color changed`,
  },
  status_changed: {
    icon: RefreshCw,
    color: "#6366f1",
    label: (d) => `Status changed from ${d.from} to ${d.to}`,
  },
  influencers_added: {
    icon: Users,
    color: "#22c55e",
    label: (d) => `${d.count} influencer${d.count !== 1 ? "s" : ""} added from ${d.source}`,
  },
  bulk_move: {
    icon: ArrowRight,
    color: "#3b82f6",
    label: (d) => `${d.count} card${d.count !== 1 ? "s" : ""} moved to ${d.to_stage}`,
  },
  bulk_remove: {
    icon: Trash2,
    color: "#ef4444",
    label: (d) => `${d.count} card${d.count !== 1 ? "s" : ""} removed`,
  },
};

interface CampaignTimelineProps {
  campaignId: string;
}

export function CampaignTimeline({ campaignId }: CampaignTimelineProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useCampaignActivity(campaignId);
  const [isOpen, setIsOpen] = useState(false);

  const entries = data?.pages.flat() || [];

  if (entries.length === 0 && !isOpen) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="gap-2 text-sm text-muted-foreground w-full justify-start">
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          Activity Timeline {entries.length > 0 && `(${entries.length})`}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="relative ml-4 mt-2 border-l border-border pl-6 space-y-4">
          {entries.map((entry) => {
            const details = (entry.details || {}) as Record<string, any>;
            const config = actionConfig[entry.action] || {
              icon: RefreshCw,
              color: "#6b7280",
              label: () => entry.action,
            };
            const Icon = config.icon;
            return (
              <div key={entry.id} className="relative flex items-start gap-3">
                <div
                  className="absolute -left-[31px] top-0.5 h-4 w-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: config.color }}
                >
                  <Icon className="h-2.5 w-2.5 text-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm">{config.label(details)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
          {hasNextPage && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? "Loading…" : "Show more"}
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
