/**
 * Shared styling for Recharts tooltips.
 *
 * Recharts defaults to a white box and lets the label inherit its colour from
 * the page. Under the dark theme that means near-white text on white — the
 * value was readable but the specimen ID above it was not. Every chart passes
 * these props so the tooltip follows the theme like the rest of the interface.
 *
 * Usage: `<Tooltip {...chartTooltip} />`, keeping any `formatter` the chart
 * already had.
 */
export const chartTooltip = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "6px",
    color: "hsl(var(--popover-foreground))",
    fontSize: 12,
    boxShadow: "0 2px 8px rgb(0 0 0 / 0.25)",
  },
  labelStyle: { color: "hsl(var(--popover-foreground))", fontWeight: 600 },
  itemStyle: { color: "hsl(var(--popover-foreground))" },
  cursor: { fill: "hsl(var(--muted-foreground))", fillOpacity: 0.12 },
} as const;

/** The same, for scatter charts where a crosshair reads better than a band. */
export const scatterTooltip = {
  ...chartTooltip,
  cursor: { strokeDasharray: "3 3", stroke: "hsl(var(--muted-foreground))" },
} as const;
