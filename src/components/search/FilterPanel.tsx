import React from 'react';
import { Filter, MapPin, Search, X } from 'lucide-react';
import { PlatformIcon } from '@/components/influencer/ResultCard'; // I'll export it there or move it

interface FilterPanelProps {
  selectedPlatforms: string[];
  togglePlatform: (p: string) => void;
  selectedCity: string;
  setSelectedCity: (v: string) => void;
  selectedNiches: string[];
  toggleNiche: (n: string) => void;
  followerRange: string;
  setFollowerRange: (v: string) => void;
  tagFilter: string;
  setTagFilter: (v: string) => void;
  engagementRange: string;
  setEngagementRange: (v: string) => void;
  contentLanguage: string;
  setContentLanguage: (v: string) => void;
  MAX_NICHES: number;
  PLATFORMS: string[];
  PK_CITIES: string[];
  PK_NICHES: string[];
  FOLLOWER_RANGES: { label: string; value: string }[];
}

export function FilterPanel({
  selectedPlatforms, togglePlatform,
  selectedCity, setSelectedCity,
  selectedNiches, toggleNiche,
  followerRange, setFollowerRange,
  tagFilter, setTagFilter,
  engagementRange, setEngagementRange,
  contentLanguage, setContentLanguage,
  MAX_NICHES, PLATFORMS, PK_CITIES, PK_NICHES, FOLLOWER_RANGES
}: FilterPanelProps) {
  return (
    <div className="space-y-6">
      {/* Platform */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-3">Platform</p>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const active = selectedPlatforms.includes(p);
            return (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                  active
                    ? "border-purple-500 bg-purple-500/10 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                    : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
                }`}
              >
                <PlatformIcon platform={p} /> {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* Location */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-3 flex items-center gap-2">
          <MapPin className="h-3 w-3" /> Location
        </p>
        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all cursor-pointer hover:bg-white/[0.05]"
        >
          {PK_CITIES.map((c) => <option key={c} value={c} className="bg-[#0c0c14]">{c}</option>)}
        </select>
      </div>

      {/* Niche */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Niche</p>
          {selectedNiches.length > 0 && (
            <span className={`text-[10px] font-black uppercase ${selectedNiches.length >= MAX_NICHES ? "text-amber-500" : "text-white/20"}`}>
              {selectedNiches.length}/{MAX_NICHES}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PK_NICHES.map((n) => {
            const isActive = selectedNiches.includes(n);
            const isDisabled = !isActive && selectedNiches.length >= MAX_NICHES;
            return (
              <button
                key={n}
                disabled={isDisabled}
                onClick={() => toggleNiche(n)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all active:scale-95 ${
                  isActive
                    ? "border-purple-500/40 text-purple-400 bg-purple-500/10 shadow-[0_0_12px_rgba(168,85,247,0.1)]"
                    : isDisabled
                      ? "border-white/5 text-white/10 cursor-not-allowed"
                      : "border-white/10 text-white/30 hover:border-white/20 hover:text-white/60"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Follower range */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-3">Reach</p>
          <select
            value={followerRange}
            onChange={(e) => setFollowerRange(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-white/10 bg-white/[0.03] text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          >
            {FOLLOWER_RANGES.map((r) => <option key={r.value} value={r.value} className="bg-[#0c0c14]">{r.label}</option>)}
          </select>
        </div>

        {/* Engagement rate */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-3">Engagement</p>
          <select
            value={engagementRange}
            onChange={(e) => setEngagementRange(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-white/10 bg-white/[0.03] text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          >
            <option value="any" className="bg-[#0c0c14]">Any rate</option>
            <option value="0-2" className="bg-[#0c0c14]">Low (0-2%)</option>
            <option value="2-5" className="bg-[#0c0c14]">Good (2-5%)</option>
            <option value="5-10" className="bg-[#0c0c14]">High (5-10%)</option>
            <option value="10+" className="bg-[#0c0c14]">Viral (10%+)</option>
          </select>
        </div>
      </div>

      {/* Tag filter */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-3">Tags</p>
        <div className="relative">
          <input
            type="text"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="#tech, #beauty..."
            className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          />
          {tagFilter && (
            <button onClick={() => setTagFilter("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content language */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-3">Language</p>
        <select
          value={contentLanguage}
          onChange={(e) => setContentLanguage(e.target.value)}
          className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
        >
          <option value="any" className="bg-[#0c0c14]">Any language</option>
          <option value="urdu" className="bg-[#0c0c14]">Urdu / Roman Urdu</option>
          <option value="english" className="bg-[#0c0c14]">English</option>
          <option value="bilingual" className="bg-[#0c0c14]">Bilingual</option>
        </select>
      </div>
    </div>
  );
}
