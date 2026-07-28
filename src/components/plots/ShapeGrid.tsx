/**
 * A 2D consensus shape with, optionally, where each landmark moves to.
 *
 * The displacement is drawn as a plain line from the mean position to the
 * deformed one — no arrowheads and no dots at either end. At the sizes these
 * drawings are printed, markers crowd the outline and hide the very shape
 * change they are meant to show; a bare line reads as direction on its own.
 */
interface ShapeGridProps {
  consensus: number[][];
  deformed?: number[][];
  width?: number;
  height?: number;
  showWire?: boolean;
  /** User-defined links (pairs of landmark indices). Falls back to a sequential ring when empty. */
  edges?: [number, number][];
}

export function ShapeGrid({ consensus, deformed, width = 340, height = 300, showWire = true, edges }: ShapeGridProps) {
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
      {/* Consensus wireframe: user-defined links if present, else a sequential ring */}
      {showWire && (edges && edges.length > 0
        ? edges.map(([a, b], i) => {
            const p = pts[a], q = pts[b];
            if (!p || !q) return null;
            return <line key={i} x1={p.cx} y1={p.cy} x2={q.cx} y2={q.cy} stroke="hsl(var(--muted-foreground))" strokeWidth={0.8} opacity={0.5} />;
          })
        : pts.slice(0, -1).map((p, i) => {
            const next = pts[i + 1];
            return <line key={i} x1={p.cx} y1={p.cy} x2={next.cx} y2={next.cy} stroke="hsl(var(--muted-foreground))" strokeWidth={0.8} opacity={0.5} />;
          }))}

      {/* Where each landmark moves to */}
      {defPts && pts.map((p, i) => {
        const d = defPts[i];
        if (Math.abs(d.cx - p.cx) < 0.5 && Math.abs(d.cy - p.cy) < 0.5) return null;
        return (
          <line key={`def-${i}`} x1={p.cx} y1={p.cy} x2={d.cx} y2={d.cy}
            stroke="hsl(var(--primary))" strokeWidth={1.6} strokeLinecap="round" />
        );
      })}

      {/* Landmarks — hidden once displacements are drawn, so the lines read cleanly */}
      {!defPts && pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.cx} cy={p.cy} r={3} fill="hsl(var(--primary))" opacity={0.8} />
          <title>LM {i + 1}</title>
        </g>
      ))}
    </svg>
  );
}
