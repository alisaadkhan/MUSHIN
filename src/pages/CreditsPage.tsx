import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Sparkles, Shield, Clock, Coins } from "lucide-react";
import { useCreditManager, type MushinCreditType } from "@/hooks/useCreditManager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function creditLabel(t: MushinCreditType) {
  if (t === "search") return "Search Credits";
  if (t === "ai") return "AI Credits";
  if (t === "enrichment") return "Enrichment Credits";
  return "Email Credits";
}

function creditAccent(t: MushinCreditType) {
  if (t === "search") return "border-primary/30 bg-primary/5";
  if (t === "ai") return "border-violet-400/20 bg-violet-400/5";
  if (t === "enrichment") return "border-emerald-400/20 bg-emerald-400/5";
  return "border-sky-400/20 bg-sky-400/5";
}

function fmtAction(action: string) {
  return action
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function CreditsPage() {
  const { balances, transactions, costs } = useCreditManager();

  const balanceMap = useMemo(() => {
    const map = new Map<MushinCreditType, number>();
    (balances.data ?? []).forEach((b) => map.set(b.credit_type, b.balance));
    return map;
  }, [balances.data]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Credits</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your MUSHIN usage, balances, and activity log.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="rounded-lg">
            <Link to="/billing">
              Upgrade <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Balances */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {(balances.data ?? []).map((b) => (
          <div
            key={b.credit_type}
            className={`rounded-2xl border shadow-sm p-5 bg-background/80 backdrop-blur-md ${creditAccent(b.credit_type)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground font-medium">{creditLabel(b.credit_type)}</p>
                <p className="text-3xl font-bold text-foreground mt-2 data-mono">
                  {Number(b.balance ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-muted/40 border border-border flex items-center justify-center">
                <Coins className="h-5 w-5 text-primary" />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Updated {b.updated_at ? new Date(b.updated_at).toLocaleString() : "—"}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Pricing */}
        <div className="lg:col-span-1 bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Credit Costs</h2>
            </div>
            <Badge variant="outline" className="text-[10px] rounded-md">
              Live pricing
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            These costs are applied automatically by the backend.
          </p>

          <div className="mt-4 space-y-2">
            {(costs.data ?? []).map((c) => (
              <div
                key={c.action}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{fmtAction(c.action)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Paid from <span className="text-foreground/90">{creditLabel(c.credit_type)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-[10px] rounded-md ${c.enabled ? "" : "opacity-60"}`}
                  >
                    {c.amount} {c.amount === 1 ? "credit" : "credits"}
                  </Badge>
                </div>
              </div>
            ))}
            {costs.isLoading && (
              <div className="text-xs text-muted-foreground">Loading pricing…</div>
            )}
          </div>
        </div>

        {/* Transactions */}
        <div className="lg:col-span-2 bg-background/80 backdrop-blur-md border border-white/50 shadow-sm rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Transaction History</h2>
            </div>
            <Badge variant="outline" className="text-[10px] rounded-md">
              Last 100
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Every debit/credit is logged with balances before and after.
          </p>

          <div className="mt-4 divide-y divide-border/60 rounded-xl border border-border/60 overflow-hidden">
            {(transactions.data ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/10">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] rounded-md ${
                        t.kind === "debit" ? "border-destructive/30 text-destructive" : "border-emerald-500/30 text-emerald-500"
                      }`}
                    >
                      {t.kind.toUpperCase()}
                    </Badge>
                    <p className="text-sm font-medium text-foreground truncate">{fmtAction(t.action)}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {creditLabel(t.credit_type)} • {new Date(t.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-foreground data-mono">
                    {t.kind === "debit" ? "-" : "+"}{t.amount}
                  </p>
                  <p className="text-[11px] text-muted-foreground data-mono">
                    {t.balance_before} → {t.balance_after}
                  </p>
                </div>
              </div>
            ))}
            {!transactions.isLoading && (transactions.data?.length ?? 0) === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No transactions yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick insight */}
      <div className="bg-[#060608] border border-border rounded-2xl p-5">
        <p className="text-sm text-foreground font-medium">Tip</p>
        <p className="text-sm text-muted-foreground mt-1">
          If your team sees “Insufficient credits”, upgrade your plan in Billing or contact support for an allocation.
          <span className="text-foreground/90"> Credits are enforced server-side</span> on live OSINT, saved searches, and campaigns.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-md text-[10px]">OSINT is credit-gated</Badge>
          <Badge variant="outline" className="rounded-md text-[10px]">Campaign create debits automatically</Badge>
          <Badge variant="outline" className="rounded-md text-[10px]">Saved search debits automatically</Badge>
        </div>
      </div>
    </div>
  );
}

