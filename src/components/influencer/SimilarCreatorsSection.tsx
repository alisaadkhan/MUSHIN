import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { GlassCard } from '@/components/ui/glass-card';

export function SimilarCreatorsSection({ profileId, currentPlatform }: { profileId: string; currentPlatform: string }) {
  const [similar, setSimilar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.functions
      .invoke("find-lookalikes", {
        body: { target_profile_id: profileId, limit: 12, same_platform_only: false },
      })
      .then(({ data }) => {
        if (!cancelled && data?.results) setSimilar(data.results);
      })
      .catch(console.warn)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profileId]);

  if (!loading && similar.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="p-5">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-white/50">Discovery Lookalikes</h3>
        </div>
        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-32 space-y-3">
                <Skeleton className="h-12 w-12 rounded-full mx-auto bg-white/5" />
                <Skeleton className="h-3 w-20 mx-auto bg-white/5" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
            {similar.map((c: any) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/influencer/${c.platform}/${c.username.replace("@", "")}`)}
                className="flex-shrink-0 w-32 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-[10px] font-black text-white uppercase overflow-hidden mx-auto mb-3 group-hover:border-purple-500/40 transition-colors">
                  {c.avatar_url ? (
                    <img
                      src={c.avatar_url}
                      alt={c.username}
                      className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    (c.full_name || c.username).slice(0, 2).toUpperCase()
                  )}
                </div>
                <p className="text-[11px] font-bold text-white/80 truncate text-center group-hover:text-purple-400 transition-colors">{c.full_name || c.username}</p>
                <p className="text-[9px] text-white/20 truncate text-center">@{c.username.replace("@", "")}</p>
                <div className="flex justify-center mt-2">
                   <div className="text-[8px] font-black uppercase tracking-[0.15em] bg-white/[0.03] border border-white/[0.05] rounded px-1.5 py-0.5 text-white/40">
                    {Math.round((c.similarity ?? 0) * 100)}% Match
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
