import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  CreditCard, Search, Loader2, RefreshCw, PlusCircle, MinusCircle, RotateCcw
} from "lucide-react";

interface WorkspaceRow {
  id: string;
  owner_id: string;
  owner_email: string | null;
  owner_name: string | null;
  plan: string | null;
  search_credits_remaining: number;
  ai_credits_remaining: number;
  email_sends_remaining: number;
  enrichment_credits_remaining: number;
  updated_at: string;
}

interface AdjustForm {
  search_credits: string;
  ai_credits: string;
  email_sends: string;
  enrichment_credits: string;
  note: string;
}

const PLAN_DEFAULTS: Record<string, Omit<AdjustForm, "note">> = {
  free:       { search_credits: "30",   ai_credits: "3",   email_sends: "10",  enrichment_credits: "3"   },
  starter:    { search_credits: "500",  ai_credits: "25",  email_sends: "100", enrichment_credits: "25"  },
  pro:        { search_credits: "2000", ai_credits: "100", email_sends: "500", enrichment_credits: "100" },
  business:   { search_credits: "5000", ai_credits: "250", email_sends: "1500",enrichment_credits: "250" },
  enterprise: { search_credits: "9999", ai_credits: "999", email_sends: "9999",enrichment_credits: "999" },
};

function creditColor(val: number, max: number) {
  const pct = max > 0 ? (val / max) * 100 : 100;
  if (pct >= 50) return "text-emerald-400";
  if (pct >= 20) return "text-amber-400";
  return "text-red-400";
}

export default function AdminCredits() {
  const perms = useAdminPermissions();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WorkspaceRow | null>(null);
  const [dialogMode, setDialogMode] = useState<"adjust" | "reset" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<AdjustForm>({
    search_credits: "", ai_credits: "", email_sends: "", enrichment_credits: "", note: ""
  });

  const { data: workspaces = [], isLoading, refetch } = useQuery<WorkspaceRow[]>({
    queryKey: ["admin-credits"],
    queryFn: async () => {
      // Fetch users (with emails from auth) and workspaces in parallel
      const [usersRes, wsRes] = await Promise.all([
        supabase.functions.invoke("admin-list-users"),
        supabase.from("workspaces").select(
          "id, owner_id, plan, updated_at, search_credits_remaining, ai_credits_remaining, email_sends_remaining, enrichment_credits_remaining"
        ).order("updated_at", { ascending: false }).limit(200),
      ]);
      if (usersRes.error) throw usersRes.error;
      if (wsRes.error) throw wsRes.error;

      const userMap: Record<string, { email: string | null; full_name: string | null }> = {};
      for (const u of usersRes.data?.users || []) {
        userMap[u.id] = { email: u.email ?? null, full_name: u.full_name ?? null };
      }

      return (wsRes.data || []).map((w: any) => ({
        ...w,
        owner_email: userMap[w.owner_id]?.email ?? null,
        owner_name: userMap[w.owner_id]?.full_name ?? null,
      }));
    },
    staleTime: 30_000,
  });

  const filtered = workspaces.filter((w) => {
    const term = search.toLowerCase();
    return !term ||
      w.owner_email?.toLowerCase().includes(term) ||
      w.owner_name?.toLowerCase().includes(term) ||
      w.plan?.toLowerCase().includes(term);
  });

  const openAdjust = (w: WorkspaceRow) => {
    setSelected(w);
    setForm({ search_credits: "", ai_credits: "", email_sends: "", enrichment_credits: "", note: "" });
    setDialogMode("adjust");
  };

  const openReset = (w: WorkspaceRow) => {
    const defaults = PLAN_DEFAULTS[w.plan?.toLowerCase() || "free"] || PLAN_DEFAULTS.free;
    setSelected(w);
    setForm({ ...defaults, note: "Manual plan reset" });
    setDialogMode("reset");
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      if (dialogMode === "adjust") {
        const body: Record<string, any> = { target_user_id: selected.owner_id };
        if (form.search_credits !== "") body.search_credits = Number(form.search_credits);
        if (form.ai_credits !== "") body.ai_credits = Number(form.ai_credits);
        if (form.email_sends !== "") body.email_sends = Number(form.email_sends);
        if (form.enrichment_credits !== "") body.enrichment_credits = Number(form.enrichment_credits);
        if (Object.keys(body).length === 1) {
          toast({ title: "No changes", description: "Enter at least one delta value.", variant: "destructive" });
          return;
        }
        const { data, error } = await supabase.functions.invoke("admin-adjust-credits", { body });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast({ title: "Credits adjusted", description: `Updated workspace for ${selected.owner_email ?? selected.owner_id}` });
      } else {
        // Hard-set absolute values (delta = target − current)
        const targets = {
          search_credits: Number(form.search_credits),
          ai_credits: Number(form.ai_credits),
          email_sends: Number(form.email_sends),
          enrichment_credits: Number(form.enrichment_credits),
        };
        const body: Record<string, any> = {
          target_user_id: selected.owner_id,
          search_credits:      targets.search_credits      - selected.search_credits_remaining,
          ai_credits:          targets.ai_credits          - selected.ai_credits_remaining,
          email_sends:         targets.email_sends         - selected.email_sends_remaining,
          enrichment_credits:  targets.enrichment_credits  - selected.enrichment_credits_remaining,
        };
        const { data, error } = await supabase.functions.invoke("admin-adjust-credits", { body });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast({ title: "Credits reset to plan defaults", description: `Workspace for ${selected.owner_email ?? selected.owner_id} updated` });
      }
      setDialogMode(null);
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin-credits"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!perms.isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">You do not have permission to access this page.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Credits Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View and adjust credits for any user workspace in real time.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email, name, or plan…"
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-semibold">User</th>
              <th className="px-4 py-3 text-left font-semibold">Plan</th>
              <th className="px-4 py-3 text-right font-semibold">Search</th>
              <th className="px-4 py-3 text-right font-semibold">AI</th>
              <th className="px-4 py-3 text-right font-semibold">Email</th>
              <th className="px-4 py-3 text-right font-semibold">Enrich</th>
              <th className="px-4 py-3 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading workspaces…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground">No workspaces found.</td>
              </tr>
            ) : (
              filtered.map((w) => {
                const planKey = (w.plan || "free").toLowerCase();
                const defaults = PLAN_DEFAULTS[planKey] || PLAN_DEFAULTS.free;
                return (
                  <tr key={w.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground text-xs truncate max-w-[160px]">
                        {w.owner_name || <span className="text-muted-foreground italic">No name</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                        {w.owner_email || w.owner_id.slice(0, 8) + "…"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px] capitalize">{w.plan || "free"}</Badge>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold text-xs ${creditColor(w.search_credits_remaining, Number(defaults.search_credits))}`}>
                      {w.search_credits_remaining.toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold text-xs ${creditColor(w.ai_credits_remaining, Number(defaults.ai_credits))}`}>
                      {w.ai_credits_remaining.toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold text-xs ${creditColor(w.email_sends_remaining, Number(defaults.email_sends))}`}>
                      {w.email_sends_remaining.toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold text-xs ${creditColor(w.enrichment_credits_remaining, Number(defaults.enrichment_credits))}`}>
                      {w.enrichment_credits_remaining.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => openAdjust(w)}
                        >
                          <PlusCircle className="h-3 w-3" /> Adjust
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => openReset(w)}
                          title={`Reset to ${w.plan || "free"} plan defaults`}
                        >
                          <RotateCcw className="h-3 w-3" /> Reset
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Adjust Dialog */}
      <Dialog open={dialogMode === "adjust"} onOpenChange={(o) => !o && setDialogMode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-primary" /> Adjust Credits
            </DialogTitle>
            <DialogDescription>
              Enter positive or negative deltas. Leave blank to skip that credit type.
              <br />
              <span className="font-medium text-foreground">{selected?.owner_email ?? selected?.owner_id}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(["search_credits", "ai_credits", "email_sends", "enrichment_credits"] as const).map((field) => (
              <div key={field} className="flex items-center gap-3">
                <Label className="w-28 text-xs text-right capitalize shrink-0">
                  {field.replace(/_/g, " ")}
                </Label>
                <Input
                  type="number"
                  placeholder="e.g. +50 or -10"
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogMode(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Dialog */}
      <Dialog open={dialogMode === "reset"} onOpenChange={(o) => !o && setDialogMode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-primary" /> Reset to Plan Defaults
            </DialogTitle>
            <DialogDescription>
              Set absolute credit values for <span className="font-medium text-foreground">{selected?.owner_email}</span>.
              Pre-filled from the <Badge variant="outline" className="text-[10px] capitalize">{selected?.plan || "free"}</Badge> plan defaults — adjust if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(["search_credits", "ai_credits", "email_sends", "enrichment_credits"] as const).map((field) => (
              <div key={field} className="flex items-center gap-3">
                <Label className="w-28 text-xs text-right capitalize shrink-0">
                  {field.replace(/_/g, " ")}
                </Label>
                <Input
                  type="number"
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogMode(null)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
