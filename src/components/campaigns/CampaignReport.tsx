import { forwardRef } from "react";

interface Stage {
  id: string;
  name: string;
  color: string;
  position: number;
}

interface PipelineCard {
  id: string;
  stage_id: string;
  username: string;
  platform: string;
  agreed_rate: number | null;
  created_at: string;
  data: any;
}

interface OutreachEntry {
  id: string;
  username: string;
  platform: string;
  status: string;
  contacted_at: string;
  email_to: string | null;
}

interface CampaignReportProps {
  campaign: {
    name: string;
    description: string | null;
    status: string;
    budget: number | null;
    start_date: string | null;
    end_date: string | null;
  };
  stages: Stage[];
  cards: PipelineCard[];
  outreachEntries: OutreachEntry[];
}

export const CampaignReport = forwardRef<HTMLDivElement, CampaignReportProps>(
  ({ campaign, stages, cards, outreachEntries }, ref) => {
    const sortedStages = [...stages].sort((a, b) => a.position - b.position);
    const totalSpend = cards.reduce((sum, c) => sum + (c.agreed_rate || 0), 0);

    return (
      <div ref={ref} className="p-8 bg-background text-foreground print:text-black print:bg-card max-w-4xl mx-auto">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            .campaign-report, .campaign-report * { visibility: visible; }
            .campaign-report { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}</style>

        <div className="campaign-report space-y-8">
          {/* Header */}
          <div className="border-b pb-4">
            <h1 className="text-3xl font-bold">{campaign.name}</h1>
            {campaign.description && <p className="text-muted-foreground mt-1">{campaign.description}</p>}
            <div className="flex gap-6 mt-3 text-sm text-muted-foreground">
              <span>Status: <strong className="text-foreground capitalize">{campaign.status}</strong></span>
              {campaign.budget && <span>Budget: <strong className="text-foreground">${campaign.budget.toLocaleString()}</strong></span>}
              {campaign.start_date && <span>Start: {new Date(campaign.start_date).toLocaleDateString()}</span>}
              {campaign.end_date && <span>End: {new Date(campaign.end_date).toLocaleDateString()}</span>}
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{cards.length}</p>
              <p className="text-xs text-muted-foreground">Total Influencers</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">${totalSpend.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Agreed Spend</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{outreachEntries.length}</p>
              <p className="text-xs text-muted-foreground">Outreach Sent</p>
            </div>
            <div className="border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">{stages.length}</p>
              <p className="text-xs text-muted-foreground">Pipeline Stages</p>
            </div>
          </div>

          {/* Stage Breakdown */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Pipeline Breakdown</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Stage</th>
                  <th className="text-right py-2">Count</th>
                  <th className="text-right py-2">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedStages.map((stage) => {
                  const count = cards.filter((c) => c.stage_id === stage.id).length;
                  const pct = cards.length > 0 ? Math.round((count / cards.length) * 100) : 0;
                  return (
                    <tr key={stage.id} className="border-b">
                      <td className="py-2 flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </td>
                      <td className="text-right py-2">{count}</td>
                      <td className="text-right py-2">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Influencer Roster */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Influencer Roster</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Username</th>
                  <th className="text-left py-2">Platform</th>
                  <th className="text-left py-2">Stage</th>
                  <th className="text-right py-2">Agreed Rate</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => {
                  const stage = stages.find((s) => s.id === card.stage_id);
                  return (
                    <tr key={card.id} className="border-b">
                      <td className="py-1.5">{card.username}</td>
                      <td className="py-1.5 capitalize">{card.platform}</td>
                      <td className="py-1.5">{stage?.name || "—"}</td>
                      <td className="py-1.5 text-right">{card.agreed_rate ? `$${card.agreed_rate.toLocaleString()}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Outreach Summary */}
          {outreachEntries.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Outreach Log</h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Username</th>
                    <th className="text-left py-2">Email</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {outreachEntries.map((entry) => (
                    <tr key={entry.id} className="border-b">
                      <td className="py-1.5">{entry.username}</td>
                      <td className="py-1.5">{entry.email_to || "—"}</td>
                      <td className="py-1.5 capitalize">{entry.status}</td>
                      <td className="py-1.5">{new Date(entry.contacted_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-xs text-muted-foreground text-center pt-4 border-t">
            Generated by MUSHIN on {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    );
  }
);

CampaignReport.displayName = "CampaignReport";
