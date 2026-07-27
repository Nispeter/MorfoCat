import { useMemo, useRef, useState } from "react";
import { symbolPath, isStrokeOnly } from "@/lib/symbols";
import { usePlotStyleStore } from "@/store/plotStyleStore";
import { figureDomain, referenceSpecimens } from "@/lib/figure";

interface PCAFigureProps {
  scores: number[][];
  loadings: number[][];
  pctVariance: number[];
  /** Mean shape the "average shape change" references deform away from. */
  consensus: number[][] | null;
  /** Procrustes-aligned coordinates, used to draw real specimens as references. */
  aligned: number[][][] | null;
  wireframe: [number, number][];
  groups: string[];
  ids: string[];
  /** Photo for each specimen, keyed by its index in `scores`. */
  photos: Record<number, string>;
  pcX: number;
  pcY: number;
  width?: number;
  height?: number;
}

const MARGIN = { top: 24, right: 24, bottom: 150, left: 150 };
const REF_BOX = 96;

/**
 * Publication-style PCA scatter: group symbols and colours, shape references
 * running along both axes, a draggable legend, and hover read-out. The whole
 * figure is a single SVG so it exports as one high-resolution image.
 */
export function PCAFigure({
  scores, loadings, pctVariance, consensus, aligned, wireframe, groups, ids, photos,
  pcX, pcY, width = 900, height = 680,
}: PCAFigureProps) {
  const {
    styles, axisMode, manualLimits, refShapesX, refShapesY, refSource, refShowIds,
    legendPos, showLegend, setLegendPos,
  } = usePlotStyleStore();

  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const dragging = useRef(false);

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;

  const xs = scores.map((s) => s[pcX] ?? 0);
  const ys = scores.map((s) => s[pcY] ?? 0);

  const domain = useMemo(
    () => figureDomain(xs, ys, axisMode, manualLimits),
    [axisMode, manualLimits, xs.join(","), ys.join(",")]
  );

  const sx = (v: number) =>
    MARGIN.left + ((v - domain.x[0]) / (domain.x[1] - domain.x[0] || 1)) * plotW;
  const sy = (v: number) =>
    MARGIN.top + plotH - ((v - domain.y[0]) / (domain.y[1] - domain.y[0] || 1)) * plotH;

  const uniqueGroups = useMemo(() => [...new Set(groups)], [groups]);
  const styleFor = (g: string) =>
    styles[g] ?? { label: g, color: "#3b82f6", symbol: "circle" as const, filled: true };

  const ticks = (lo: number, hi: number, count = 6) => {
    const step = (hi - lo) / count;
    return Array.from({ length: count + 1 }, (_, i) => lo + step * i);
  };
  const xTicks = ticks(domain.x[0], domain.x[1]);
  const yTicks = ticks(domain.y[0], domain.y[1]);

  const deform = (pc: number, amount: number): number[][] | null => {
    if (!consensus || !loadings.length) return null;
    const nDim = consensus[0].length;
    return consensus.map((pt, li) =>
      pt.map((v, d) => v + amount * (loadings[li * nDim + d]?.[pc] ?? 0))
    );
  };

  /**
   * What to draw at each reference slot along an axis. In `deformation` mode
   * that's the mean shape pushed to that PC score; otherwise it's the real
   * specimen that sits closest to that point on the axis.
   */
  function references(pc: number, count: number, lo: number, hi: number) {
    if (refSource === "deformation") {
      const positions = count <= 0 ? [] :
        Array.from({ length: count }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / count);
      return positions.map((position) => ({
        key: `d${position}`,
        at: position,
        shape: deform(pc, position),
        photo: undefined as string | undefined,
        label: position.toFixed(2),
        caption: undefined as string | undefined,
      }));
    }
    return referenceSpecimens(scores, pc, count, lo, hi).map(({ position, index }) => ({
      key: `s${position}-${index}`,
      at: position,
      shape: aligned?.[index] ?? null,
      photo: refSource === "photo" ? photos[index] : undefined,
      label: (scores[index]?.[pc] ?? position).toFixed(2),
      caption: refShowIds ? ids[index] : undefined,
    }));
  }

  const onLegendDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) * (width / rect.width) - MARGIN.left) / plotW;
    const py = ((e.clientY - rect.top) * (height / rect.height) - MARGIN.top) / plotH;
    setLegendPos({ x: Math.min(0.95, Math.max(0, px)), y: Math.min(0.95, Math.max(0, py)) });
  };
  const endDrag = () => { dragging.current = false; };

  const hovered = hover != null ? { x: xs[hover], y: ys[hover], id: ids[hover], group: groups[hover] } : null;

  return (
    <svg
      ref={svgRef}
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", maxWidth: width, margin: "0 auto" }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      {/* Grid */}
      {xTicks.map((t, i) => (
        <line key={`gx${i}`} x1={sx(t)} x2={sx(t)} y1={MARGIN.top} y2={MARGIN.top + plotH}
          stroke="hsl(var(--border))" strokeDasharray="3 3" strokeWidth={0.6} />
      ))}
      {yTicks.map((t, i) => (
        <line key={`gy${i}`} x1={MARGIN.left} x2={MARGIN.left + plotW} y1={sy(t)} y2={sy(t)}
          stroke="hsl(var(--border))" strokeDasharray="3 3" strokeWidth={0.6} />
      ))}

      {/* Axes */}
      <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={MARGIN.top + plotH} y2={MARGIN.top + plotH}
        stroke="hsl(var(--foreground))" strokeWidth={1.5} />
      <line x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={MARGIN.top + plotH}
        stroke="hsl(var(--foreground))" strokeWidth={1.5} />

      {xTicks.map((t, i) => (
        <g key={`tx${i}`}>
          <line x1={sx(t)} x2={sx(t)} y1={MARGIN.top + plotH} y2={MARGIN.top + plotH + 5} stroke="hsl(var(--foreground))" />
          <text x={sx(t)} y={MARGIN.top + plotH + 18} textAnchor="middle" fontSize={11} fill="hsl(var(--foreground))">
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      {yTicks.map((t, i) => (
        <g key={`ty${i}`}>
          <line x1={MARGIN.left - 5} x2={MARGIN.left} y1={sy(t)} y2={sy(t)} stroke="hsl(var(--foreground))" />
          <text x={MARGIN.left - 8} y={sy(t) + 4} textAnchor="end" fontSize={11} fill="hsl(var(--foreground))">
            {t.toFixed(2)}
          </text>
        </g>
      ))}

      {/* Axis titles */}
      <text x={MARGIN.left + plotW / 2} y={MARGIN.top + plotH + 42} textAnchor="middle" fontSize={14} fontWeight={600} fill="hsl(var(--foreground))">
        Principal Component {pcX + 1}
        <tspan fontWeight={400} fontSize={12}>{`  ${(pctVariance[pcX] ?? 0).toFixed(2)}%`}</tspan>
      </text>
      <text transform={`rotate(-90 ${MARGIN.left - 46} ${MARGIN.top + plotH / 2})`}
        x={MARGIN.left - 46} y={MARGIN.top + plotH / 2} textAnchor="middle" fontSize={14} fontWeight={600} fill="hsl(var(--foreground))">
        Principal Component {pcY + 1}
        <tspan fontWeight={400} fontSize={12}>{`  ${(pctVariance[pcY] ?? 0).toFixed(2)}%`}</tspan>
      </text>

      {/* Reference drawings below the x axis */}
      {references(pcX, refShapesX, domain.x[0], domain.x[1]).map((r) => (
        <RefShape
          key={`rx-${r.key}`}
          shape={r.shape}
          photo={r.photo}
          edges={wireframe}
          cx={sx(r.at)}
          cy={MARGIN.top + plotH + 60 + REF_BOX / 2}
          size={REF_BOX}
          label={r.label}
          caption={r.caption}
        />
      ))}

      {/* Reference drawings left of the y axis */}
      {references(pcY, refShapesY, domain.y[0], domain.y[1]).map((r) => (
        <RefShape
          key={`ry-${r.key}`}
          shape={r.shape}
          photo={r.photo}
          edges={wireframe}
          cx={MARGIN.left - 66 - REF_BOX / 2}
          cy={sy(r.at)}
          size={REF_BOX}
          label={r.label}
          caption={r.caption}
        />
      ))}

      {/* Points */}
      {scores.map((_, i) => {
        const st = styleFor(groups[i]);
        const stroke = isStrokeOnly(st.symbol) || !st.filled;
        return (
          <path
            key={i}
            d={symbolPath(st.symbol, hover === i ? 7 : 5)}
            transform={`translate(${sx(xs[i])},${sy(ys[i])})`}
            fill={stroke ? "none" : st.color}
            stroke={st.color}
            strokeWidth={stroke ? 1.8 : 0.8}
            opacity={hover == null || hover === i ? 0.95 : 0.45}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        );
      })}

      {/* Hover read-out */}
      {hovered && (
        <g pointerEvents="none">
          <line x1={MARGIN.left} x2={sx(hovered.x)} y1={sy(hovered.y)} y2={sy(hovered.y)}
            stroke="hsl(var(--muted-foreground))" strokeDasharray="2 3" strokeWidth={0.8} />
          <line x1={sx(hovered.x)} x2={sx(hovered.x)} y1={sy(hovered.y)} y2={MARGIN.top + plotH}
            stroke="hsl(var(--muted-foreground))" strokeDasharray="2 3" strokeWidth={0.8} />
          <g transform={`translate(${Math.min(sx(hovered.x) + 12, MARGIN.left + plotW - 150)},${Math.max(sy(hovered.y) - 46, MARGIN.top + 4)})`}>
            <rect width={148} height={44} rx={4} fill="hsl(var(--popover))" stroke="hsl(var(--border))" />
            <text x={8} y={16} fontSize={11} fontWeight={600} fill="hsl(var(--popover-foreground))">{hovered.id}</text>
            <text x={8} y={30} fontSize={10} fill="hsl(var(--muted-foreground))">
              PC{pcX + 1} {hovered.x.toFixed(4)} · PC{pcY + 1} {hovered.y.toFixed(4)}
            </text>
            <text x={8} y={40} fontSize={10} fill="hsl(var(--muted-foreground))">{styleFor(hovered.group).label}</text>
          </g>
        </g>
      )}

      {/* Legend — drag it anywhere inside the plot */}
      {showLegend && uniqueGroups.length > 0 && (
        <g
          transform={`translate(${MARGIN.left + legendPos.x * plotW},${MARGIN.top + legendPos.y * plotH})`}
          onPointerDown={onLegendDown}
          style={{ cursor: "move" }}
        >
          <rect
            width={150} height={uniqueGroups.length * 18 + 10} rx={4}
            fill="hsl(var(--card))" stroke="hsl(var(--border))" opacity={0.92}
          />
          {uniqueGroups.map((g, i) => {
            const st = styleFor(g);
            const stroke = isStrokeOnly(st.symbol) || !st.filled;
            return (
              <g key={g} transform={`translate(14,${16 + i * 18})`}>
                <path d={symbolPath(st.symbol, 5)} fill={stroke ? "none" : st.color} stroke={st.color} strokeWidth={stroke ? 1.8 : 0.8} />
                <text x={14} y={4} fontSize={11} fill="hsl(var(--foreground))">{st.label}</text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

/**
 * One reference drawing with its PC value underneath — either the specimen's
 * photo or its wireframe. A photo that failed to load falls back to the
 * wireframe rather than leaving a hole in the figure.
 */
function RefShape({
  shape, photo, edges, cx, cy, size, label, caption,
}: {
  shape: number[][] | null;
  photo?: string;
  edges: [number, number][];
  cx: number;
  cy: number;
  size: number;
  label: string;
  caption?: string;
}) {
  const labelY = cy + size / 2 + 2;
  if (photo) {
    return (
      <g>
        <image
          href={photo}
          x={cx - size / 2}
          y={cy - size / 2}
          width={size}
          height={size}
          preserveAspectRatio="xMidYMid meet"
        />
        <text x={cx} y={labelY} textAnchor="middle" fontSize={11} fontWeight={600} fill="hsl(var(--foreground))">
          {label}
        </text>
        {caption && (
          <text x={cx} y={labelY + 11} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
            {caption}
          </text>
        )}
      </g>
    );
  }

  if (!shape?.length) return null;

  const pad = 6;
  const xs = shape.map((p) => p[0]);
  const ys = shape.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const k = Math.min((size - pad * 2) / (maxX - minX || 1), (size - pad * 2) / (maxY - minY || 1));
  const px = (x: number) => cx - ((maxX + minX) / 2 - x) * k;
  const py = (y: number) => cy + ((maxY + minY) / 2 - y) * k;

  const links: [number, number][] =
    edges.length > 0 ? edges : shape.map((_, i) => [i, (i + 1) % shape.length] as [number, number]);

  return (
    <g>
      {links.map(([a, b], i) => {
        const p = shape[a], q = shape[b];
        if (!p || !q) return null;
        return <line key={i} x1={px(p[0])} y1={py(p[1])} x2={px(q[0])} y2={py(q[1])}
          stroke="hsl(var(--foreground))" strokeWidth={1} />;
      })}
      {shape.map((p, i) => (
        <circle key={i} cx={px(p[0])} cy={py(p[1])} r={1.6} fill="hsl(var(--primary))" />
      ))}
      <text x={cx} y={labelY} textAnchor="middle" fontSize={11} fontWeight={600} fill="hsl(var(--foreground))">
        {label}
      </text>
      {caption && (
        <text x={cx} y={labelY + 11} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">
          {caption}
        </text>
      )}
    </g>
  );
}
