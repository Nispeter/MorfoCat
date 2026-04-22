/**
 * Renders a 2D consensus shape with optional deformation arrows.
 * Uses SVG scaled to the container.
 */
interface ShapeGridProps {
  consensus: number[][];
  deformed?: number[][];
  width?: number;
  height?: number;
  showWire?: boolean;
}

export function ShapeGrid({ consensus, deformed, width = 260, height = 220, showWire = true }: ShapeGridProps) {
  if (!consensus?.length) return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">No consensus shape</div>;

  const pad = 20;
  const xs = consensus.map((p) => p[0]);
  const ys = consensus.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const scale = Math.min((width - pad * 2) / rangeX, (height - pad * 2) / rangeY);
  const toSvg = (x: number, y: number) => ({
    cx: pad + (x - minX) * scale,
    cy: height - pad - (y - minY) * scale,
  });

  const pts = consensus.map((p) => toSvg(p[0], p[1]));
  const defPts = deformed?.map((p) => toSvg(p[0], p[1]));

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Consensus wireframe (triangulate by connecting sequential landmarks) */}
      {showWire && pts.map((p, i) => {
        const next = pts[(i + 1) % pts.length];
        return <line key={i} x1={p.cx} y1={p.cy} x2={next.cx} y2={next.cy} stroke="hsl(var(--muted-foreground))" strokeWidth={0.8} opacity={0.5} />;
      })}

      {/* Deformation vectors */}
      {defPts && pts.map((p, i) => {
        const d = defPts[i];
        const dx = d.cx - p.cx;
        const dy = d.cy - p.cy;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null;
        return (
          <line key={`def-${i}`} x1={p.cx} y1={p.cy} x2={d.cx} y2={d.cy}
            stroke="hsl(var(--primary))" strokeWidth={1.5} markerEnd="url(#arrowBlue)" />
        );
      })}

      <defs>
        <marker id="arrowBlue" viewBox="0 -4 8 8" refX={6} refY={0} markerWidth={4} markerHeight={4} orient="auto">
          <path d="M0,-4L8,0L0,4" fill="hsl(var(--primary))" />
        </marker>
      </defs>

      {/* Landmarks */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r={3.5} fill="hsl(var(--primary))" opacity={0.8} />
          <title>LM {i + 1}</title>
        </g>
      ))}

      {/* Deformed landmarks */}
      {defPts?.map((p, i) => (
        <circle key={`def-lm-${i}`} cx={p.cx} cy={p.cy} r={3.5} fill="hsl(var(--destructive))" opacity={0.7} />
      ))}
    </svg>
  );
}
