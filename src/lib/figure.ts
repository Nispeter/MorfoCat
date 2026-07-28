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

/**
 * A round step close to `rough` — 1, 2, 2.5 or 5 times a power of ten.
 *
 * Dividing the data range into equal parts gives axes labelled -0.15, -0.09,
 * -0.04, 0.01…, which nobody can read against a published figure. Snapping the
 * step to a round number puts the ticks on -0.15, -0.10, -0.05, 0.00 instead.
 */
function niceStep(rough: number): number {
  if (!isFinite(rough) || rough <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const scaled = rough / power;
  // Thresholds sit between the candidates rather than on them, so a step of
  // 0.051 rounds down to 0.05 and keeps seven ticks instead of jumping to 0.1
  // and leaving four.
  const step = scaled <= 1.5 ? 1 : scaled <= 3 ? 2 : scaled <= 7 ? 5 : 10;
  return step * power;
}

/** Round an interval outwards to whole multiples of a nice step. */
function niceRange(lo: number, hi: number, count: number): [number, number] {
  const step = niceStep((hi - lo) / count);
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
}

/**
 * Tick positions across a domain, on round values. The domain is expected to
 * already sit on multiples of the step, so the ticks land exactly on its ends.
 */
export function niceTicks(lo: number, hi: number, count = 6): number[] {
  const step = niceStep((hi - lo) / count);
  const out: number[] = [];
  // Nudge the bound before comparing so floating-point drift does not drop the
  // last tick when it lands exactly on the end of the axis.
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) {
    out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  }
  return out;
}

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
    const [, hi] = niceRange(-m, m, 6);
    return { x: [-hi, hi], y: [-hi, hi] };
  }
  const span = (vals: number[]): [number, number] => {
    if (!vals.length) return [-0.01, 0.01];
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const margin = (hi - lo) * PAD || 0.01;
    return niceRange(lo - margin, hi + margin, 6);
  };
  return { x: span(xs), y: span(ys) };
}

/**
 * Where `n` reference drawings sit along an axis.
 *
 * They land on tick values rather than arbitrary offsets, so a drawing labelled
 * "0.05" sits under the 0.05 gridline the way published figures show it.
 */
export function refPositions(n: number, lo: number, hi: number): number[] {
  if (n <= 0) return [];
  const ticks = niceTicks(lo, hi);
  if (ticks.length === 0) return [];
  if (n >= ticks.length) return ticks;
  // Spread the chosen ticks across the axis instead of bunching them at one end.
  return Array.from({ length: n }, (_, i) =>
    ticks[Math.round((i * (ticks.length - 1)) / (n - 1 || 1))]
  );
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
