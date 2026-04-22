import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const GROUP_COLORS = [
  "hsl(221,83%,53%)", "hsl(0,84%,60%)", "hsl(142,71%,45%)", "hsl(38,92%,50%)",
  "hsl(271,76%,53%)", "hsl(187,85%,43%)", "hsl(326,78%,60%)", "hsl(72,60%,50%)",
];

interface GroupScatterPlotProps {
  scores: number[][];
  groups: string[];
  xLabel?: string;
  yLabel?: string;
  xIdx?: number;
  yIdx?: number;
  ids?: string[];
}

export function GroupScatterPlot({
  scores, groups, xLabel = "Axis 1", yLabel = "Axis 2",
  xIdx = 0, yIdx = 1, ids,
}: GroupScatterPlotProps) {
  const uniqueGroups = [...new Set(groups)];

  const grouped = uniqueGroups.map((g, gi) => ({
    name: g,
    fill: GROUP_COLORS[gi % GROUP_COLORS.length],
    data: scores
      .map((s, i) => ({ x: s[xIdx] ?? 0, y: s[yIdx] ?? 0, id: ids?.[i] ?? `sp_${i}` }))
      .filter((_, i) => groups[i] === g),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="x" name={xLabel} tick={{ fontSize: 11 }} label={{ value: xLabel, position: "insideBottom", offset: -4, fontSize: 11 }} />
        <YAxis dataKey="y" name={yLabel} tick={{ fontSize: 11 }} label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 11 }} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {grouped.map((g) => (
          <Scatter key={g.name} name={g.name} data={g.data} fill={g.fill} opacity={0.8} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { x: number; y: number; id: string } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded border bg-card px-3 py-2 text-xs shadow">
      <p className="font-medium">{d.id}</p>
      <p>x: {d.x.toFixed(4)}</p>
      <p>y: {d.y.toFixed(4)}</p>
    </div>
  );
}
