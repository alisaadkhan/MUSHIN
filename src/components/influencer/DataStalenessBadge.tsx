import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface DataStalenessBadgeProps {
  daysSince: number;
  onRefresh: () => void;
  disabled?: boolean;
}

export function DataStalenessBadge({ daysSince, onRefresh, disabled }: DataStalenessBadgeProps) {
  return (
    <button
      onClick={onRefresh}
      disabled={disabled}
      className="flex items-center gap-3 text-amber-400 bg-amber-400/5 hover:bg-amber-400/10 transition-all px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-400/20 w-full mt-2 disabled:opacity-50 active:scale-[0.98]"
    >
      <ShieldAlert size={14} className="shrink-0" />
      <span className="flex-1 text-left">
        Intelligence Stale · Last enriched {daysSince} days ago
      </span>
    </button>
  );
}
