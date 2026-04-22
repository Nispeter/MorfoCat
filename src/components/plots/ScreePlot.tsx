import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

interface ScreePlotProps {
  pctVariance: number[];
  cumulativePct: number[];
  selectedPC?: number;
  onSelectPC?: (idx: number) => void;
}

export function ScreePlot({ pctVariance, cumulativePct, selectedPC, onSelectPC }: ScreePlotProps) {
  const data = pctVariance.slice(0, 20).map((pct, i) => ({
    pc: `PC${i + 1}`,
    variance: +pct.toFixed(2),
    cumulative: +cumulativePct[i].toFixed(2),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 20, bottom: 8, left: 0 }}
        onClick={(d) => d?.activeTooltipIndex != null && onSelectPC?.(d.activeTooltipIndex)}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="pc" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" unit="%" tick={{ fontSize: 11 }} domain={[0, "auto"]} />
        <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
        <Tooltip formatter={(v: number, name: string) => [`${v}%`, name]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {selectedPC != null && (
          <ReferenceLine yAxisId="left" x={`PC${selectedPC + 1}`} stroke="hsl(var(--primary))" strokeWidth={2} />
        )}
        <Bar yAxisId="left" dataKey="variance" name="% Variance" fill="hsl(var(--primary))" opacity={0.8} radius={[3, 3, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative %" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
