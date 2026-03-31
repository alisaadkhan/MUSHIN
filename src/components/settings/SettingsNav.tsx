import React from "react";
import { cn } from "@/lib/utils";
import { useMouseSpotlight } from "@/hooks/useMouseSpotlight";

interface Tab {
  label: string;
  icon: any;
}

interface SettingsNavProps {
  tabs: Tab[];
  activeTab: string;
  setActiveTab: (label: string) => void;
}

export function SettingsNav({ tabs, activeTab, setActiveTab }: SettingsNavProps) {
  const { mouseX, mouseY, onMouseMove } = useMouseSpotlight();

  return (
    <aside 
      className="w-full md:w-64 flex-shrink-0 space-y-1.5 overflow-x-auto md:overflow-visible flex md:block pb-4 md:pb-0 scrollbar-none"
      onMouseMove={onMouseMove}
    >
      {tabs.map((t) => {
        const isActive = activeTab === t.label;
        return (
          <button
            key={t.label}
            onClick={() => setActiveTab(t.label)}
            className={cn(
              "relative flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all text-left whitespace-nowrap min-w-max md:min-w-0 md:w-full group overflow-hidden",
              isActive 
                ? "text-white bg-white/[0.03] border border-white/10 shadow-[0_0_20px_rgba(168,85,247,0.1)]" 
                : "text-white/30 hover:text-white/60 hover:bg-white/[0.01] border border-transparent"
            )}
          >
            <t.icon 
              size={14} 
              strokeWidth={isActive ? 2.5 : 2} 
              className={cn("transition-colors", isActive ? "text-purple-400" : "text-white/20 group-hover:text-white/40")} 
            />
            {t.label}
            
            {/* Active Glow Indicator */}
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-purple-500 rounded-r-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
            )}

            {/* Mouse Spotlight */}
            <div
              className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: `radial-gradient(400px circle at ${mouseX}px ${mouseY}px, rgba(168,85,247,0.08), transparent 80%)`,
              }}
            />
          </button>
        );
      })}
    </aside>
  );
}
