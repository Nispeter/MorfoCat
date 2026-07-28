import type { AxisLimits, AxisMode } from "@/store/plotStyleStore";

/**
 * Geometry shared between the PCA figure and the page that feeds it. The page
 * needs to know which specimens end up as axis references so it can load their
 * photos ahead of time, and the figure needs the same answer when it draws.
 */

export interface FigureDomain {
  x: [number, number];
  y: [number, number];
}

const PAD = 0.12;

export function figureDomain(
  xs: number[],
  ys: number[],
  axisMode: AxisMode,
  manualLimits: AxisLimits
): FigureDomain {
  if (axisMode === "manual") {
    return {
      x: [manualLimits.xMin, manualLimits.xMax],
      y: [manualLimits.yMin, manualLimits.yMax],
    };
  }
  if (axisMode === "symmetric") {
    // Same magnitude either side of zero on both axes, so the spread of the
    // sample is directly comparable between plots.
    const m = Math.max(...xs.map(Math.abs), ...ys.map(Math.abs)) * (1 + PAD) || 0.01;
    return { x: [-m, m], y: [-m, m] };
  }
  const span = (vals: number[]): [number, number] => {
    if (!vals.length) return [-0.01, 0.01];
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const margin = (hi - lo) * PAD || 0.01;
    return [lo - margin, hi + margin];
  };
  return { x: span(xs), y: span(ys) };
}

/** `n` evenly spaced positions across an axis, each centred in its own slot. */
export function refPositions(n: number, lo: number, hi: number): number[] {
  return n <= 0 ? [] : Array.from({ length: n }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / n);
}

/** Index of the specimen whose score on `pc` sits closest to `value`. */
export function nearestSpecimen(scores: number[][], pc: number, value: number): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  scores.forEach((s, i) => {
    const d = Math.abs((s[pc] ?? 0) - value);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best;
}

/**
 * Where the reference drawings sit on an axis: the positions the user pinned
 * if there are any, otherwise `count` evenly spaced slots.
 */
export function resolveRefPositions(
  explicit: number[] | null,
  count: number,
  lo: number,
  hi: number
): number[] {
  return explicit ?? refPositions(count, lo, hi);
}

/**
 * The specimens standing in for each axis reference: for every reference slot,
 * the real specimen that sits closest to it. A specimen can legitimately
 * represent two neighbouring slots when the sample is sparse there.
 */
export function referenceSpecimens(
  scores: number[][],
  pc: number,
  positions: number[]
): Array<{ position: number; index: number }> {
  return positions.flatMap((position) => {
    const index = nearestSpecimen(scores, pc, position);
    return index == null ? [] : [{ position, index }];
  });
}

export interface ShapeOrientation {
  flipX: boolean;
  flipY: boolean;
  /** Clockwise rotation in degrees. */
  rotation: number;
}

/**
 * Re-orient a shape for display, about its own centre.
 *
 * Which way a specimen faces depends on how it was photographed and on the
 * digitizer's axis convention, so the drawings sometimes come out mirrored or
 * lying on their side relative to how the figure should read. This only changes
 * the picture — the coordinates the analyses use are untouched.
 *
 * Mirroring is applied first, then the rotation, so the two controls stay
 * independent of each other.
 */
export function orientShape(points: number[][], o: ShapeOrientation): number[][] {
  if (!points.length) return points;
  if (!o.flipX && !o.flipY && o.rotation % 360 === 0) return points;

  let cx = 0, cy = 0;
  for (const [x, y] of points) { cx += x; cy += y; }
  cx /= points.length; cy /= points.length;

  const theta = (-o.rotation * Math.PI) / 180; // screen y is up here, so negate
  const cos = Math.cos(theta), sin = Math.sin(theta);

  return points.map((p) => {
    let dx = p[0] - cx;
    let dy = p[1] - cy;
    if (o.flipX) dx = -dx;
    if (o.flipY) dy = -dy;
    const rest = p.slice(2);
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos, ...rest];
  });
}

/** MIME type for an image file, from its extension. */
export function imageMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "tif" || ext === "tiff") return "image/tiff";
  if (ext === "bmp") return "image/bmp";
  return "image/png";
}
