import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

const data = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  roi: Math.round(600 + Math.random() * 400 + i * 8),
}));

export function ROITrendChart() {
  return (
    <Card className="glass-card h-full">
      <CardContent className="p-6">
        <h3 className="font-semibold mb-4">30-Day ROI Trend</h3>
        <ChartContainer
          config={{ roi: { label: "ROI %", color: "hsl(var(--primary))" } }}
          className="h-[220px] w-full"
        >
          <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="roi" stroke="#A855F7" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
