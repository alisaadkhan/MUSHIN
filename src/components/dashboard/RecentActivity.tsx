import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, TrendingUp, Handshake, FileText, Brain } from "lucide-react";

const activities = [
  { icon: UserPlus, text: "New creator added to Summer Launch", time: "2 min ago", color: "text-primary" },
  { icon: TrendingUp, text: "Campaign ROI updated: +12% from last week", time: "15 min ago", color: "text-emerald-500" },
  { icon: Handshake, text: "Maya Kingston accepted collaboration", time: "1 hr ago", color: "text-amber-500" },
  { icon: FileText, text: "Audience report generated for Q3 Brand Push", time: "3 hrs ago", color: "text-blue-500" },
  { icon: Brain, text: "New IQ score calculated for 847 creators", time: "6 hrs ago", color: "text-primary" },
];

export function RecentActivity() {
  return (
    <Card className="glass-card h-full">
      <CardContent className="p-6">
        <h3 className="font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {activities.map((a, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <a.icon className={`h-3.5 w-3.5 ${a.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">{a.text}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
