/**
 * Thin-plate spline (Bookstein 1989) in 2D.
 *
 * Used for the deformation grids that show how one shape warps into another,
 * and to estimate missing landmarks by warping the consensus onto whatever
 * landmarks a specimen does have.
 */

/** Maps a point in the source configuration to its position in the target. */
export type TpsWarp = (x: number, y: number) => [number, number];

/** TPS kernel U(r) = r² · ln(r²), with U(0) = 0. */
function kernel(r2: number): number {
  return r2 <= 0 ? 0 : r2 * Math.log(r2);
}

/**
 * Solve A·X = B in place by Gauss-Jordan elimination with partial pivoting.
 * B holds one column per output dimension. Returns null for singular systems.
 */
function solve(A: number[][], B: number[][]): number[][] | null {
  const n = A.length;
  const m = B[0].length;

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    if (Math.abs(A[pivot][col]) < 1e-12) return null;
    if (pivot !== col) {
      [A[col], A[pivot]] = [A[pivot], A[col]];
      [B[col], B[pivot]] = [B[pivot], B[col]];
    }

    const d = A[col][col];
    for (let c = col; c < n; c++) A[col][c] /= d;
    for (let c = 0; c < m; c++) B[col][c] /= d;

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      for (let c = 0; c < m; c++) B[r][c] -= f * B[col][c];
    }
  }
  return B;
}

/**
 * Fit the TPS that carries `source` onto `target` (both n × 2, same length).
 * Returns null when the configuration is degenerate (e.g. all points collinear).
 */
export function fitTPS(source: number[][], target: number[][]): TpsWarp | null {
  const n = source.length;
  if (n < 3 || target.length !== n) return null;

  const size = n + 3;
  const L: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const Y: number[][] = Array.from({ length: size }, () => [0, 0]);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dx = source[i][0] - source[j][0];
      const dy = source[i][1] - source[j][1];
      L[i][j] = kernel(dx * dx + dy * dy);
    }
    L[i][n] = 1;
    L[i][n + 1] = source[i][0];
    L[i][n + 2] = source[i][1];
    L[n][i] = 1;
    L[n + 1][i] = source[i][0];
    L[n + 2][i] = source[i][1];
    Y[i] = [target[i][0], target[i][1]];
  }

  const X = solve(L, Y);
  if (!X) return null;

  const w = X.slice(0, n);
  const [a0, a1, a2] = [X[n], X[n + 1], X[n + 2]];

  return (x, y) => {
    let fx = a0[0] + a1[0] * x + a2[0] * y;
    let fy = a0[1] + a1[1] * x + a2[1] * y;
    for (let i = 0; i < n; i++) {
      const dx = x - source[i][0];
      const dy = y - source[i][1];
      const u = kernel(dx * dx + dy * dy);
      fx += w[i][0] * u;
      fy += w[i][1] * u;
    }
    return [fx, fy];
  };
}

export interface DeformationGrid {
  /** Warped grid lines, each a polyline of [x, y] points. */
  lines: number[][][];
  /** Bounding box of the warped grid, for scaling into a viewport. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

/**
 * Build the classic Bookstein deformation grid: a regular grid over the source
 * shape, pushed through the TPS warp. `divisions` counts cells per side and
 * `samples` how finely each grid line is sampled (higher = smoother curves).
 */
export function deformationGrid(
  source: number[][],
  target: number[][],
  divisions = 12,
  samples = 24
): DeformationGrid | null {
  const warp = fitTPS(source, target);
  if (!warp) return null;

  const xs = source.map((p) => p[0]);
  const ys = source.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  // Breathing room so the grid frames the shape rather than clipping it
  const padX = (maxX - minX) * 0.15 || 0.1;
  const padY = (maxY - minY) * 0.15 || 0.1;
  const x0 = minX - padX, x1 = maxX + padX;
  const y0 = minY - padY, y1 = maxY + padY;

  const lines: number[][][] = [];
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };

  const push = (line: number[][]) => {
    for (const [x, y] of line) {
      if (x < bounds.minX) bounds.minX = x;
      if (x > bounds.maxX) bounds.maxX = x;
      if (y < bounds.minY) bounds.minY = y;
      if (y > bounds.maxY) bounds.maxY = y;
    }
    lines.push(line);
  };

  for (let i = 0; i <= divisions; i++) {
    const y = y0 + ((y1 - y0) * i) / divisions;
    push(Array.from({ length: samples + 1 }, (_, s) => warp(x0 + ((x1 - x0) * s) / samples, y)));
  }
  for (let i = 0; i <= divisions; i++) {
    const x = x0 + ((x1 - x0) * i) / divisions;
    push(Array.from({ length: samples + 1 }, (_, s) => warp(x, y0 + ((y1 - y0) * s) / samples)));
  }

  return { lines, bounds };
}
