import { useRef, useState } from "react";

export interface DistanceDatum {
  id: string;
  /** Index into the original specimen list, for click-through. */
  idx: number;
  procrustes: number;
  mahalanobis: number;
  flagged: boolean;
}

interface DistancePlotProps {
  data: DistanceDatum[];
  metric: "procrustes" | "mahalanobis";
  /** Draw a threshold line at this distance, if given. */
  threshold?: number;
  width?: number;
  height?: number;
  onSelect?: (idx: number) => void;
}

const MARGIN = { top: 16, right: 16, bottom: 56, left: 60 };

/**
 * One stem per specimen, drawn from the baseline up to its distance from the
 * mean shape. Reading the sample as a row of lines makes a specimen that sits
 * far above its neighbours obvious at a glance.
 */
export function DistancePlot({
  data, metric, threshold, width = 820, height = 300, onSelect,
}: DistancePlotProps) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;

  const values = data.map((d) => (metric === "procrustes" ? d.procrustes : d.mahalanobis));
  const maxV = Math.max(...values, threshold ?? 0, 1e-12) * 1.1;

  const stepX = data.length > 0 ? plotW / data.length : plotW;
  const cx = (i: number) => MARGIN.left + stepX * (i + 0.5);
  const cy = (v: number) => MARGIN.top + plotH - (v / maxV) * plotH;

  const ticks = Array.from({ length: 5 }, (_, i) => (maxV * i) / 4);
  const label = metric === "procrustes" ? "Procrustes distance" : "Mahalanobis distance";
  const hovered = hover != null ? data[hover] : null;

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={cy(t)} y2={cy(t)}
            stroke="hsl(var(--border))" strokeDasharray="3 3" strokeWidth={0.6} />
          <text x={MARGIN.left - 8} y={cy(t) + 4} textAnchor="end" fontSize={10} fill="hsl(var(--muted-foreground))">
            {t < 0.01 && t > 0 ? t.toExponential(1) : t.toFixed(3)}
          </text>
        </g>
      ))}

      <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={MARGIN.top + plotH} y2={MARGIN.top + plotH}
        stroke="hsl(var(--foreground))" strokeWidth={1} />

      {threshold != null && threshold > 0 && (
        <>
          <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={cy(threshold)} y2={cy(threshold)}
            stroke="hsl(var(--destructive))" strokeDasharray="5 4" strokeWidth={1.2} />
          <text x={MARGIN.left + plotW} y={cy(threshold) - 4} textAnchor="end" fontSize={10} fill="hsl(var(--destructive))">
            threshold
          </text>
        </>
      )}

      {data.map((d, i) => {
        const v = metric === "procrustes" ? d.procrustes : d.mahalanobis;
        const colour = d.flagged ? "hsl(var(--destructive))" : "hsl(var(--primary))";
        return (
          <g
            key={d.idx}
            style={{ cursor: onSelect ? "pointer" : "default" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect?.(d.idx)}
          >
            {/* Wide invisible target so thin stems are still easy to hit */}
            <rect x={cx(i) - stepX / 2} y={MARGIN.top} width={stepX} height={plotH} fill="transparent" />
            <line x1={cx(i)} x2={cx(i)} y1={MARGIN.top + plotH} y2={cy(v)}
              stroke={colour} strokeWidth={hover === i ? 2.4 : 1.4} opacity={hover == null || hover === i ? 1 : 0.5} />
            <circle cx={cx(i)} cy={cy(v)} r={hover === i ? 4 : 2.6} fill={colour}
              opacity={hover == null || hover === i ? 1 : 0.5} />
          </g>
        );
      })}

      <text x={MARGIN.left + plotW / 2} y={height - 8} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))">
        Specimens ({data.length})
      </text>
      <text transform={`rotate(-90 14 ${MARGIN.top + plotH / 2})`} x={14} y={MARGIN.top + plotH / 2}
        textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))">
        {label}
      </text>

      {hovered && (
        <g pointerEvents="none" transform={`translate(${Math.min(cx(hover!) + 10, MARGIN.left + plotW - 190)},${MARGIN.top + 6})`}>
          <rect width={186} height={46} rx={4} fill="hsl(var(--popover))" stroke="hsl(var(--border))" />
          <text x={8} y={16} fontSize={11} fontWeight={600} fill="hsl(var(--popover-foreground))">{hovered.id}</text>
          <text x={8} y={30} fontSize={10} fill="hsl(var(--muted-foreground))">
            Procrustes {hovered.procrustes.toExponential(3)}
          </text>
          <text x={8} y={42} fontSize={10} fill="hsl(var(--muted-foreground))">
            Mahalanobis {hovered.mahalanobis.toFixed(3)}
          </text>
        </g>
      )}
    </svg>
  );
}
