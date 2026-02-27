import { TrendingUp, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

export interface FollowerHistoryPoint {
    recorded_at: string;
    follower_count: number;
}

interface GrowthAnalyticsPanelProps {
    history: FollowerHistoryPoint[];
    className?: string;
}

export function GrowthAnalyticsPanel({ history, className = "" }: GrowthAnalyticsPanelProps) {
    if (!history || history.length === 0) return null;

    // Sort by date ascending
    const sortedHistory = [...history].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

    // Format data for chart
    const chartData = sortedHistory.map(point => ({
        date: format(new Date(point.recorded_at), "MMM d"),
        followers: point.follower_count
    }));

    const startFollowers = sortedHistory[0].follower_count;
    const endFollowers = sortedHistory[sortedHistory.length - 1].follower_count;
    const isPositive = endFollowers >= startFollowers;
    const pctChange = startFollowers > 0 ? ((endFollowers - startFollowers) / startFollowers * 100).toFixed(1) : "0.0";

    return (
        <Card className={`glass-card ${className}`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Follower Growth
                </CardTitle>
                <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${isPositive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                    <TrendingUp className={`h-3 w-3 ${!isPositive && 'rotate-180'}`} />
                    {isPositive ? '+' : ''}{pctChange}%
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[180px] w-full mt-2">
                    <ChartContainer config={{ followers: { label: "Followers", color: "hsl(var(--primary))" } }} className="h-full w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ left: 10, right: 10, top: 5, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} dy={10} />
                                <YAxis hide domain={['dataMin', 'dataMax']} padding={{ top: 20, bottom: 20 }} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Line
                                    type="monotone"
                                    dataKey="followers"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    dot={{ strokeWidth: 2, r: 3, fill: "white" }}
                                    activeDot={{ r: 5, strokeWidth: 0 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </div>
            </CardContent>
        </Card>
    );
}
