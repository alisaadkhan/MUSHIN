import React from "react";
import { useNavigate } from "react-router-dom";
import { Search, Radio, Fingerprint, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface SearchHeaderProps {
  creditsRemaining: number | null;
  creditsExhausted: boolean;
}

export function SearchHeader({ creditsRemaining, creditsExhausted }: SearchHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/[0.03]">
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
           <div className="p-2 rounded-lg bg-white/[0.03] border border-white/10 text-white/40">
              <Search size={18} />
           </div>
           <h1 className="text-3xl font-black text-white tracking-tighter uppercase" style={{ fontFamily:"'Syne', sans-serif" }}>
              Discovery Engine
           </h1>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 flex items-center gap-2">
          <Radio size={12} className="animate-pulse text-purple-500" /> Operational Matrix: Search Grid Active
        </p>
      </div>
      <div className="flex items-center gap-6">
         <AnimatePresence>
            {creditsRemaining !== null && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <Badge variant="outline" className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase border-white/10 bg-white/[0.03] ${creditsExhausted ? "text-red-400 border-red-500/30" : "text-purple-400"}`}>
                  <Activity size={10} className="mr-2" /> {creditsRemaining} Credits Available
                </Badge>
              </motion.div>
            )}
         </AnimatePresence>
         <div className="w-px h-6 bg-white/[0.05]" />
         <Button variant="outline" className="h-10 px-6 border-white/10 hover:border-white/20 text-[10px] font-black uppercase tracking-widest transition-all bg-white/[0.01]" onClick={() => navigate("/dashboard")}>
            Terminal
         </Button>
         <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/20">
            <Fingerprint size={20} />
         </div>
      </div>
    </div>
  );
}
