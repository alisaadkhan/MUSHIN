import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const COLORS = ["hsl(var(--primary))", "#f59e0b", "#22c55e", "#ec4899"];

export default function CampaignComparePage() {
  const { data: campaigns } = useCampaigns();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const { data: comparisonData } = useQuery({
    queryKey: ["campaign-compare", selectedIds],
    queryFn: async () => {
      const results = await Promise.all(
        selectedIds.map(async (cid) => {
          const [stagesRes, cardsRes] = await Promise.all([
            supabase.from("pipeline_stages").select("*").eq("campaign_id", cid).order("position"),
            supabase.from("pipeline_cards").select("*").eq("campaign_id", cid),
          ]);
          return {
            campaignId: cid,
            stages: stagesRes.data || [],
            cards: cardsRes.data || [],
          };
        })
      );
      return results;
    },
    enabled: selectedIds.length >= 2,
  });

  const selectedCampaigns = campaigns?.filter((c) => selectedIds.includes(c.id)) || [];

  // Build chart data: group by stage name
  const allStageNames = Array.from(
    new Set(comparisonData?.flatMap((d) => d.stages.map((s) => s.name)) || [])
  );

  const chartData = allStageNames.map((stageName) => {
    const row: any = { stage: stageName };
    comparisonData?.forEach((d, i) => {
      const stage = d.stages.find((s) => s.name === stageName);
      const count = stage ? d.cards.filter((c) => c.stage_id === stage.id).length : 0;
      const campaign = selectedCampaigns[i];
      row[campaign?.name || `Campaign ${i + 1}`] = count;
    });
    return row;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/campaigns">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compare Campaigns</h1>
          <p className="text-muted-foreground mt-1">Select 2–4 campaigns to compare side by side</p>
        </div>
      </div>

      {/* Campaign selector */}
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-sm">Select Campaigns</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="max-h-48">
            <div className="space-y-2">
              {campaigns?.map((c) => (
                <label key={c.id} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-md p-2 transition-colors">
                  <Checkbox
                    checked={selectedIds.includes(c.id)}
                    onCheckedChange={() => toggle(c.id)}
                    disabled={!selectedIds.includes(c.id) && selectedIds.length >= 4}
                  />
                  <span className="text-sm font-medium">{c.name}</span>
                  <Badge variant="outline" className="text-[10px] ml-auto">{c.status}</Badge>
                </label>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {selectedIds.length < 2 && (
        <p className="text-sm text-muted-foreground text-center py-8">Select at least 2 campaigns to compare.</p>
      )}

      {comparisonData && selectedIds.length >= 2 && (
        <>
          {/* Comparison Table */}
          <Card className="glass-card overflow-auto">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Metrics Comparison</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 text-muted-foreground font-medium">Metric</th>
                    {selectedCampaigns.map((c, i) => (
                      <th key={c.id} className="text-center p-2 font-medium" style={{ color: COLORS[i] }}>{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2 text-muted-foreground">Total Influencers</td>
                    {comparisonData.map((d, i) => (
                      <td key={i} className="text-center p-2 font-semibold">{d.cards.length}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 text-muted-foreground">Budget</td>
                    {selectedCampaigns.map((c, i) => (
                      <td key={i} className="text-center p-2">{c.budget ? `$${Number(c.budget).toLocaleString()}` : "—"}</td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 text-muted-foreground">Spent (Agreed Rates)</td>
                    {comparisonData.map((d, i) => {
                      const spent = d.cards.reduce((s, c) => s + (Number(c.agreed_rate) || 0), 0);
                      return <td key={i} className="text-center p-2">${spent.toLocaleString()}</td>;
                    })}
                  </tr>
                  <tr className="border-b">
                    <td className="p-2 text-muted-foreground">Conversion (First→Last)</td>
                    {comparisonData.map((d, i) => {
                      if (d.stages.length < 2) return <td key={i} className="text-center p-2">—</td>;
                      const first = d.cards.filter((c) => c.stage_id === d.stages[0].id).length;
                      const last = d.cards.filter((c) => c.stage_id === d.stages[d.stages.length - 1].id).length;
                      const rate = first > 0 ? ((last / first) * 100).toFixed(0) : "0";
                      return <td key={i} className="text-center p-2">{rate}%</td>;
                    })}
                  </tr>
                  {allStageNames.map((sn) => (
                    <tr key={sn} className="border-b">
                      <td className="p-2 text-muted-foreground">{sn}</td>
                      {comparisonData.map((d, i) => {
                        const stage = d.stages.find((s) => s.name === sn);
                        const count = stage ? d.cards.filter((c) => c.stage_id === stage.id).length : 0;
                        return <td key={i} className="text-center p-2">{count}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Grouped Bar Chart */}
          {chartData.length > 0 && (
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-sm">Influencers per Stage</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="stage" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Legend />
                      {selectedCampaigns.map((c, i) => (
                        <Bar key={c.id} dataKey={c.name} fill={COLORS[i]} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
