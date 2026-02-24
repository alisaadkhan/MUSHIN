import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface Campaign {
  id: string;
  name: string;
  status: string;
  budget: number | null;
  pipeline_cards?: { count: number }[];
}

interface Props {
  campaigns: Campaign[] | undefined;
}

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  draft: "secondary",
  completed: "outline",
};

export function ActiveCampaignsTable({ campaigns }: Props) {
  if (!campaigns?.length) return null;

  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <h3 className="font-semibold mb-4">Active Campaigns</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Creators</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link to={`/campaigns/${c.id}`} className="font-medium hover:text-primary transition-colors">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell className="data-mono">
                  {c.pipeline_cards?.[0]?.count ?? 0}
                </TableCell>
                <TableCell className="data-mono">
                  ${(c.budget || 0).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[c.status] || "secondary"} className="capitalize text-xs">
                    {c.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
