import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, User, CreditCard, BarChart2, Headphones, LogOut, AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { MushInIcon } from "@/components/ui/MushInLogo";

interface UserRecord {
  id: string;
  full_name: string | null;
  email: string | null;
  plan_name: string;
  subscription_status: string | null;
  search_count: number;
  monthly_limit: number;
  created_at: string | null;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status || status === "free") {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">Free</span>;
  }
  const map: Record<string, { color: string; label: string }> = {
    active:     { color: "bg-green-500/10 text-green-400 border border-green-500/20", label: "Active" },
    trialing:   { color: "bg-blue-500/10 text-blue-400 border border-blue-500/20",    label: "Trial" },
    past_due:   { color: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20", label: "Past Due" },
    canceled:   { color: "bg-red-500/10 text-red-400 border border-red-500/20",       label: "Canceled" },
    paused:     { color: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",    label: "Paused" },
  };
  const { color, label } = map[status] ?? { color: "bg-zinc-800 text-zinc-400", label: status };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{label}</span>;
}

function UsageBar({ count, limit }: { count: number; limit: number }) {
  const pct = limit > 0 ? Math.min((count / limit) * 100, 100) : 0;
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-teal-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-white/50">
        <span>{count.toLocaleString()} used</span>
        <span>{limit.toLocaleString()} limit</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SupportDashboard() {
  const { user, signOut } = useAuth();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<UserRecord[]>([]);
  const [selected, setSelected] = useState<UserRecord | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setHasSearched(true);
    setSelected(null);

    try {
      const { data, error } = await supabase.rpc("support_lookup_user", { p_email: `%${query.trim()}%` });
      if (error) throw error;
      setResults((data as UserRecord[]) ?? []);

      // Log the support action
      await supabase.from("support_actions_log").insert({
        support_id: user!.id,
        action: "user_lookup",
        metadata: { query: query.trim(), result_count: (data as any[])?.length ?? 0 },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lookup failed";
      toast({ title: "Search failed", description: msg, variant: "destructive" });
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleViewUser = async (record: UserRecord) => {
    setSelected(record);
    // Log user view
    await supabase.from("support_actions_log").insert({
      support_id: user!.id,
      action: "view_user",
      target_user_id: record.id,
      metadata: { email: record.email },
    });
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-[#060608] text-white">
      {/* Top nav */}
      <header className="border-b border-white/[0.06] px-6 py-3 flex items-center justify-between sticky top-0 z-50 bg-[#060608]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <MushInIcon size={28} className="text-teal-400" />
          <div>
            <span className="text-sm font-bold tracking-widest text-white">MUSHIN</span>
            <div className="flex items-center gap-1.5">
              <Headphones className="w-3 h-3 text-teal-400" />
              <span className="text-[10px] text-teal-400 font-medium uppercase tracking-wider">Support Dashboard</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/40">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-white/50 hover:text-white gap-1.5">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Search section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">User Lookup</h1>
            <p className="text-white/40 text-sm mt-1">Search users by email. All lookups are logged.</p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by email (partial match supported)…"
                className="w-full h-10 bg-white/[0.04] border border-white/10 rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-teal-500/40 focus:bg-white/[0.06] transition-all"
              />
            </div>
            <Button type="submit" disabled={searching || !query.trim()}
              className="bg-teal-600 hover:bg-teal-500 text-white h-10 px-5">
              {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Search"}
            </Button>
          </form>
        </motion.div>

        {/* Results */}
        {hasSearched && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {results.length === 0 && !searching && (
              <div className="text-center py-12 text-white/30">
                <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No users found matching "{query}"</p>
              </div>
            )}
            {results.map((r) => (
              <div key={r.id}
                onClick={() => handleViewUser(r)}
                className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                  selected?.id === r.id
                    ? "border-teal-500/40 bg-teal-500/[0.06]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-sm font-bold text-teal-400">
                    {(r.full_name ?? r.email ?? "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{r.full_name ?? "—"}</div>
                    <div className="text-xs text-white/40">{r.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={r.subscription_status ?? r.plan_name} />
                  <span className="text-xs text-white/30 hidden sm:block capitalize">{r.plan_name}</span>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* User detail panel */}
        {selected && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="grid sm:grid-cols-3 gap-4">

            {/* Identity card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-widest mb-1">
                <User className="w-3.5 h-3.5" /> Identity
              </div>
              <div>
                <div className="text-lg font-bold">{selected.full_name ?? "—"}</div>
                <div className="text-sm text-white/50 break-all">{selected.email}</div>
              </div>
              <div className="text-xs text-white/30 font-mono break-all">{selected.id}</div>
              {selected.created_at && (
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  <Clock className="w-3 h-3" />
                  Period ends: {new Date(selected.created_at).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Subscription card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-widest mb-1">
                <CreditCard className="w-3.5 h-3.5" /> Subscription
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={selected.subscription_status} />
                <span className="text-sm font-semibold capitalize">{selected.plan_name}</span>
              </div>
              {selected.subscription_status === "active" ? (
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle className="w-3.5 h-3.5" /> Subscription active
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  <AlertCircle className="w-3.5 h-3.5" /> {selected.plan_name === "free" ? "Free plan" : "Inactive"}
                </div>
              )}
              <p className="text-[10px] text-white/25">Support cannot modify billing. Direct billing queries to admin.</p>
            </div>

            {/* Usage card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs text-white/40 uppercase tracking-widest mb-1">
                <BarChart2 className="w-3.5 h-3.5" /> Usage
              </div>
              <div>
                <div className="text-3xl font-black">{selected.search_count.toLocaleString()}</div>
                <div className="text-xs text-white/40">searches this period</div>
              </div>
              <UsageBar count={selected.search_count} limit={selected.monthly_limit} />
              {selected.search_count >= selected.monthly_limit && (
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle className="w-3.5 h-3.5" /> Limit reached
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Activity notice */}
        <div className="rounded-xl border border-yellow-500/15 bg-yellow-500/[0.04] p-4 flex gap-3">
          <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-400/80 leading-relaxed">
            All actions in this dashboard are logged to the support audit trail. You have read-only access to user data. To modify subscriptions or credits, contact a super admin.
          </p>
        </div>
      </div>
    </div>
  );
}
