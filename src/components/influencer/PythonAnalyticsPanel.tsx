import React from 'react';
import { BarChart3 } from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';

interface BotDetectionResult {
  data_available: boolean;
  bot_probability?: number | null;
  risk_level?: string | null;
  signals_triggered?: string[];
  confidence?: string | null;
}
interface EngagementAnomalyResult {
  data_available: boolean;
  anomaly_score?: number | null;
  anomalies_detected?: string[];
  explanation?: string | null;
}
interface PythonAnalyticsData {
  available: boolean;
  reason?: string;
  bot_detection: BotDetectionResult;
  engagement_anomaly: EngagementAnomalyResult;
  cached?: boolean;
  analyzed_at?: string;
}

export function PythonAnalyticsPanel({ data }: { data: PythonAnalyticsData }) {
  if (!data.available) {
    return (
      <GlassCard className="p-6 h-full flex flex-col justify-center items-center text-center">
        <BarChart3 className="h-8 w-8 text-white/5 mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Statistical Integrity</p>
        <p className="text-xs text-white/20 italic leading-relaxed max-w-[200px]">
          {data.reason ?? "Analytics service pending or unavailable."}
        </p>
      </GlassCard>
    );
  }

  const bot = data.bot_detection;
  const eng = data.engagement_anomaly;

  const botPct = bot.data_available && bot.bot_probability != null
    ? Math.round(bot.bot_probability * 100) : null;
  const botRiskColor =
    bot.risk_level === "high" ? "bg-red-500"
    : bot.risk_level === "medium" ? "bg-amber-500"
    : "bg-emerald-500";
  const botBadgeColor =
    bot.risk_level === "high" ? "text-red-400 bg-red-400/10 border-red-400/20"
    : bot.risk_level === "medium" ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
    : "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";

  const anomalyPct = eng.data_available && eng.anomaly_score != null
    ? Math.round(eng.anomaly_score * 100) : null;
  const anomalyLabel =
    anomalyPct === null ? null
    : anomalyPct < 20 ? "Neutral"
    : anomalyPct < 50 ? "Moderate"
    : "Anomalous";
  const anomalyColor =
    anomalyPct === null ? ""
    : anomalyPct < 20 ? "bg-emerald-500"
    : anomalyPct < 50 ? "bg-amber-500"
    : "bg-red-500";

  return (
    <GlassCard className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-4 w-4 text-purple-400" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30">Statistical Audit</h3>
        </div>
        {data.cached && (
          <div className="text-[8px] font-black uppercase tracking-[0.15em] bg-white/[0.03] border border-white/[0.05] rounded-full px-2 py-0.5 text-white/20">
            Cached · {data.analyzed_at ? new Date(data.analyzed_at).toLocaleDateString() : ""}
          </div>
        )}
      </div>

      {/* Bot probability */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-white/80">Synthetic Engagement Risk</p>
          {bot.data_available && bot.risk_level && (
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${botBadgeColor}`}>
              {bot.risk_level}
            </span>
          )}
        </div>
        {botPct !== null ? (
          <div className="space-y-2">
            <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(168,85,247,0.3)] shadow-current`} style={{ width: `${botPct}%`, backgroundColor: 'currentColor' }} />
            </div>
            <div className="flex justify-between text-[9px] font-black uppercase tracking-[0.2em] text-white/20">
              <span>{botPct}% Probability</span>
              <span>{bot.confidence} Confidence</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-white/10 italic">Data density insufficient for risk assessment.</p>
        )}
      </div>

      {/* Engagement anomaly */}
      <div className="pt-8 border-t border-white/[0.05] space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-white/80">Engagement Stability</p>
          {anomalyLabel && (
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">{anomalyLabel}</span>
          )}
        </div>
        {anomalyPct !== null ? (
          <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden mb-2">
            <div className={`h-full rounded-full transition-all duration-300 ${anomalyColor}`} style={{ width: `${anomalyPct}%` }} />
          </div>
        ) : (
          <p className="text-xs text-white/10 italic">Profile data currently outside processing window.</p>
        )}
      </div>

      <div className="pt-6 border-t border-white/[0.03] text-[9px] font-black uppercase tracking-[0.1em] text-white/10 leading-tight">
        Advanced ML classification engine · Baseline calibrated for MENA region standards.
      </div>
    </GlassCard>
  );
}
