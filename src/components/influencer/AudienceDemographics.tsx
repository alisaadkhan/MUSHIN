import React from 'react';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';

interface AudienceDemographicsProps {
  ageRange?: string;
  genderSplit?: string;
  topCountries?: string[];
}

function parseAgeBars(ageRange: string): { range: string; pct: number }[] {
  const rangeMatch = ageRange.match(/(\d+)[–-](\d+)/);
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1]);
    const high = parseInt(rangeMatch[2]);
    return [
      { range: "13-17", pct: low >= 18 ? 5 : 20 },
      { range: "18-24", pct: low <= 18 && high >= 24 ? 35 : (low <= 24 ? 25 : 8) },
      { range: "25-34", pct: low <= 25 && high >= 34 ? 32 : (low <= 34 ? 20 : 12) },
      { range: "35-44", pct: high >= 44 ? 20 : 15 },
      { range: "45+", pct: high >= 45 ? 25 : 10 },
    ];
  }
  return [
    { range: "13-17", pct: 8 }, { range: "18-24", pct: 35 },
    { range: "25-34", pct: 32 }, { range: "35-44", pct: 15 }, { range: "45+", pct: 10 },
  ];
}

function parseGenderBars(genderSplit: string): { gender: string; pct: number }[] {
  const female = genderSplit.match(/(\d+)%\s*female/i);
  const male = genderSplit.match(/(\d+)%\s*male/i);
  const femalePct = female ? parseInt(female[1]) : 60;
  const malePct = male ? parseInt(male[1]) : 35;
  const otherPct = Math.max(0, 100 - femalePct - malePct);
  return [
    { gender: "Female", pct: femalePct },
    { gender: "Male", pct: malePct },
    ...(otherPct > 0 ? [{ gender: "Other", pct: otherPct }] : []),
  ];
}

export function AudienceDemographics({ ageRange, genderSplit, topCountries }: AudienceDemographicsProps) {
  const ageData = parseAgeBars(ageRange || "");
  const genderData = parseGenderBars(genderSplit || "");

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30">Audience Composition</h3>
        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-white/5 bg-white/[0.02] text-white/20">AI Predictive Estimate</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-4">Age Distribution</p>
          <div className="space-y-3">
            {ageData.map((a) => (
              <div key={a.range} className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-white/40">
                  <span>{a.range}</span>
                  <span>{a.pct}%</span>
                </div>
                <div className="h-1 bg-white/[0.03] rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500/40 rounded-full transition-all duration-500" style={{ width: `${a.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-4">Gender Identification</p>
          <div className="space-y-3">
            {genderData.map((g) => (
              <div key={g.gender} className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-white/40">
                  <span>{g.gender}</span>
                  <span>{g.pct}%</span>
                </div>
                <div className="h-1 bg-white/[0.03] rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500/40 rounded-full transition-all duration-500" style={{ width: `${g.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {topCountries && topCountries.length > 0 && (
        <div className="mt-10 pt-8 border-t border-white/[0.05]">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Primary Geo-Nodes</p>
            <span className="text-[8px] font-black uppercase tracking-widest text-white/10">Ranked by density</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {topCountries.map((country, i) => (
              <div key={country} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                <span className="text-[9px] font-black text-purple-400 opacity-50">#0{i+1}</span>
                <span className="text-xs font-bold text-white/60">{country}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
