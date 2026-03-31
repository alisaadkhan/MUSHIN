import React from 'react';
import { ShieldCheck, Globe, Sparkles, MapPin, Calendar, Heart, Share2, ExternalLink, RefreshCw, BarChart3, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';
import { EvaluationScoreBadge } from '@/components/influencer/EvaluationScoreBadge';
import { DataStalenessBadge } from '@/components/influencer/DataStalenessBadge';
import { useMouseSpotlight } from '@/hooks/useMouseSpotlight';

interface ProfileSummaryProps {
  profile: any;
  loading: boolean;
  isEnriched: boolean;
  followers: number | null;
  following: number | null;
  postsCount: number | null;
  engagementRate: number | null;
  city: string | null;
  niche: string;
  evaluation: any;
  isStale: boolean;
  daysSinceEnrichment: number | null;
  handleEnrichAndEvaluate: () => void;
  handleRunAnalytics: () => void;
  handleShare: () => void;
  setShowAddToList: (val: boolean) => void;
  enriching: boolean;
  analyticsLoading: boolean;
  analyticsData: any;
  avatarUrl: string | null;
  avatarInitials: string;
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

export function ProfileSummary({
  profile, loading, isEnriched, followers, following, postsCount, engagementRate,
  city, niche, evaluation, isStale, daysSinceEnrichment,
  handleEnrichAndEvaluate, handleRunAnalytics, handleShare, setShowAddToList,
  enriching, analyticsLoading, analyticsData, avatarUrl, avatarInitials
}: ProfileSummaryProps) {
  const { mouseX, mouseY, onMouseMove } = useMouseSpotlight();

  if (loading) {
    return (
      <GlassCard className="p-8 animate-pulse">
        <div className="flex flex-col sm:flex-row gap-8 items-start">
          <div className="w-24 h-24 rounded-full bg-white/5 shrink-0" />
          <div className="flex-1 space-y-4">
            <div className="h-8 bg-white/5 w-1/3 rounded-lg" />
            <div className="h-4 bg-white/5 w-1/2 rounded-lg" />
            <div className="grid grid-cols-4 gap-4 mt-6">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl" />)}
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  const audienceQualityScore = profile?.audience_quality_score ?? null;
  const botProbability = profile?.bot_probability ?? null;
  const dataSource = profile?.data_source ?? null;

  return (
    <GlassCard 
      className="p-8 relative overflow-hidden group/summary"
      onMouseMove={onMouseMove}
      mouseX={mouseX}
      mouseY={mouseY}
    >
      <div className="flex flex-col lg:flex-row gap-10 items-start">
        {/* Avatar Section */}
        <div className="relative shrink-0">
          <div className="w-28 h-28 rounded-full bg-white/[0.05] border-2 border-white/10 flex items-center justify-center overflow-hidden relative shadow-2xl group-hover/summary:border-purple-500/40 transition-colors duration-500">
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={profile?.full_name} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover/summary:scale-110"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} 
              />
            ) : (
              <span className="text-3xl font-black text-white/40">{avatarInitials}</span>
            )}
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-[#0c0c14] border border-white/10 flex items-center justify-center shadow-xl">
             <div className="text-white/40">
                {profile?.platform === 'youtube' ? <span className="text-[10px] font-black">YT</span> : <span className="text-[10px] font-black uppercase">{profile?.platform?.slice(0, 2)}</span>}
             </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase truncate max-w-full">
                {profile?.full_name || profile?.username}
              </h1>
              {evaluation ? (
                <EvaluationScoreBadge score={evaluation.overall_score} size="lg" showLabel />
              ) : profile?.overall_score ? (
                <EvaluationScoreBadge score={profile.overall_score} size="lg" showLabel />
              ) : (
                <Badge variant="outline" className="bg-white/[0.03] border-white/10 text-[10px] font-black text-white/30 uppercase tracking-widest px-3 h-7">Unscored</Badge>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">@{profile?.username}</span>
              <span className="w-1 h-1 rounded-full bg-white/10" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-purple-400">{niche}</span>
              {city && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/10" />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-1.5"><MapPin size={12} className="text-white/20" /> {city}</span>
                </>
              )}
            </div>
          </div>

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Reach", value: followers != null ? formatFollowers(followers) : "—" },
              { label: profile?.platform === "youtube" ? "Videos" : "Posts", value: postsCount != null ? postsCount.toLocaleString() : "—" },
              { label: "Following", value: following != null ? formatFollowers(following) : "—" },
              { label: "Engagement", value: engagementRate != null ? `${engagementRate.toFixed(1)}%` : "—" },
            ].map((stat, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 text-center group/stat hover:bg-white/[0.04] transition-colors">
                <div className="text-lg font-black text-white group-hover/stat:text-purple-400 transition-colors uppercase tracking-tight">{stat.value}</div>
                <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Bio Section */}
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-white/20">Operational Intel</p>
            {profile?.bio ? (
              <p className="text-sm text-white/60 leading-relaxed max-w-2xl">{profile.bio}</p>
            ) : (
              <p className="text-xs text-white/20 italic">Deep profile analysis required for full bio retrieval.</p>
            )}
          </div>
        </div>

        {/* Control Section */}
        <div className="w-full lg:w-72 space-y-4">
          {isStale && (
            <DataStalenessBadge 
              daysSince={Math.floor(daysSinceEnrichment!)} 
              onRefresh={handleEnrichAndEvaluate}
              disabled={enriching}
            />
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-11 border-white/10 hover:border-white/20 text-[10px] uppercase font-black tracking-widest" onClick={() => setShowAddToList(true)}>
              <Heart size={14} className="mr-2" /> Monitor
            </Button>
             <Button variant="outline" className="flex-1 h-11 border-white/10 hover:border-white/20 text-[10px] uppercase font-black tracking-widest" onClick={handleShare}>
              <Share2 size={14} className="mr-2" /> Signal
            </Button>
          </div>

          <div className="space-y-2">
            <Button 
              className="w-full h-11 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-500/20 active:scale-95"
              onClick={handleEnrichAndEvaluate}
              disabled={enriching}
            >
              <RefreshCw size={14} className={cn("mr-2", enriching && "animate-spin")} />
              {enriching ? "Synthesizing..." : evaluation ? "Re-evaluate Profile" : "Enrich & Evaluate"}
            </Button>
            <Button 
              variant="outline" 
              className="w-full h-11 border-white/10 hover:border-white/20 text-[10px] uppercase font-black tracking-widest"
              onClick={handleRunAnalytics}
              disabled={analyticsLoading}
            >
              <BarChart3 size={14} className={cn("mr-2", analyticsLoading && "animate-pulse")} />
              {analyticsLoading ? "Auditing Stats..." : "Deep Statistical Audit"}
            </Button>
          </div>

          <div className="pt-4 border-t border-white/[0.05] space-y-3">
             <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/20 leading-none">
              <span>Source Integrity</span>
              <span className="text-white/40">{dataSource === 'youtube_api' ? 'YT_API_V3' : 'CLUSTER_OSINT'}</span>
            </div>
            {audienceQualityScore != null && (
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest leading-none">
                <span className="text-white/20">Audience Trust</span>
                <span className={cn(
                  audienceQualityScore >= 70 ? "text-emerald-400" : audienceQualityScore >= 40 ? "text-amber-400" : "text-red-400"
                )}>{audienceQualityScore}/100</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

const cn = (...args: any[]) => args.filter(Boolean).join(" ");
