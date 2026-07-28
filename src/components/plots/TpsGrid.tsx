import { useMemo } from "react";
import { deformationGrid } from "@/lib/tps";

interface TpsGridProps {
  /** Reference configuration the grid starts square on (usually the consensus). */
  source: number[][];
  /** Target configuration the grid is warped onto. */
  target: number[][];
  /** Wireframe links to draw on the target shape. Falls back to a sequential ring. */
  edges?: [number, number][];
  width?: number;
  height?: number;
  /** Grid cells per side — more cells show finer local deformation. */
  divisions?: number;
  showLandmarks?: boolean;
}

/**
 * Thin-plate spline deformation grid (Bookstein 1989): a square grid over the
 * reference shape, bent by the warp that takes the reference to the target.
 */
export function TpsGrid({
  source, target, edges, width = 300, height = 260, divisions = 12, showLandmarks = true,
}: TpsGridProps) {
  const grid = useMemo(
    () => deformationGrid(source, target, divisions),
    [source, target, divisions]
  );

  if (!grid) {
    return (
      <div className="flex items-center justify-center text-xs text-muted-foreground" style={{ width, height }}>
        Grid needs at least 3 non-collinear landmarks
      </div>
    );
  }

  const pad = 12;
  const minX = Math.min(grid.bounds.minX, ...target.map((p) => p[0]));
  const maxX = Math.max(grid.bounds.maxX, ...target.map((p) => p[0]));
  const minY = Math.min(grid.bounds.minY, ...target.map((p) => p[1]));
  const maxY = Math.max(grid.bounds.maxY, ...target.map((p) => p[1]));
  const scale = Math.min((width - pad * 2) / (maxX - minX || 1), (height - pad * 2) / (maxY - minY || 1));
  const offX = pad + ((width - pad * 2) - (maxX - minX) * scale) / 2;
  const offY = pad + ((height - pad * 2) - (maxY - minY) * scale) / 2;

  const sx = (x: number) => offX + (x - minX) * scale;
  const sy = (y: number) => height - offY - (y - minY) * scale;
  const path = (line: number[][]) =>
    line.map(([x, y], i) => `${i === 0 ? "M" : "L"}${sx(x).toFixed(2)},${sy(y).toFixed(2)}`).join(" ");

  const links: [number, number][] =
    edges && edges.length > 0
      ? edges
      : target.slice(0, -1).map((_, i) => [i, i + 1] as [number, number]);

  return (
    <svg width={width} height={height} className="overflow-visible">
      {grid.lines.map((line, i) => (
        <path key={i} d={path(line)} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={0.6} opacity={0.45} />
      ))}

      {links.map(([a, b], i) => {
        const p = target[a], q = target[b];
        if (!p || !q) return null;
        return (
          <line key={`e-${i}`} x1={sx(p[0])} y1={sy(p[1])} x2={sx(q[0])} y2={sy(q[1])}
            stroke="hsl(var(--primary))" strokeWidth={1.4} opacity={0.9} />
        );
      })}

      {showLandmarks && target.map((p, i) => (
        <g key={`lm-${i}`}>
          <circle cx={sx(p[0])} cy={sy(p[1])} r={2.8} fill="hsl(var(--primary))" />
          <title>LM {i + 1}</title>
        </g>
      ))}
    </svg>
  );
}
