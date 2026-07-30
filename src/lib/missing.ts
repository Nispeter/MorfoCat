import { fitTPS } from "./tps";

/**
 * Values TPS/NTS files use to mark a landmark as not recorded.
 *
 * These are exact conventions, not magnitudes. Testing `Math.abs(v) >= 999`
 * instead flags any genuinely large coordinate — and landmarks digitized from
 * photographs are in image pixels, where 999 is an ordinary value near the
 * middle of the frame. That marked most of a real dataset as missing.
 */
const SENTINELS = [-999, 999, -9999, 9999];

/**
 * Missing landmarks. Conventionally flagged with a sentinel coordinate, and
 * some tools leave them as NaN. Everything else counts as observed.
 *
 * A point counts as missing only when *every* coordinate is a sentinel: files
 * write the whole point as (-999, -999), while a single axis landing on one of
 * those values is a real measurement.
 */
export function isMissingPoint(pt: number[] | undefined | null): boolean {
  if (!pt || pt.length === 0) return true;
  if (pt.some((v) => !isFinite(v))) return true;
  return pt.every((v) => SENTINELS.includes(v));
}

/** Indices of specimens that have at least one missing landmark. */
export function specimensWithMissing(specimens: number[][][]): number[] {
  return specimens.flatMap((sp, i) => (sp.some(isMissingPoint) ? [i] : []));
}

/** Total number of missing landmarks across the sample. */
export function countMissing(specimens: number[][][]): number {
  return specimens.reduce((n, sp) => n + sp.filter(isMissingPoint).length, 0);
}

export interface EstimateResult {
  landmarks: number[][][];
  /** How many missing landmarks were filled in. */
  filled: number;
  /** Specimens that could not be estimated (fewer than 3 observed landmarks). */
  skipped: number[];
}

/**
 * Fill missing landmarks by thin-plate spline (Gunz et al. 2009): warp the
 * reference shape onto each specimen's observed landmarks, then read the
 * missing positions off the warped reference. 2D only.
 */
export function estimateMissingLandmarks(
  specimens: number[][][],
  reference: number[][]
): EstimateResult {
  const out = specimens.map((sp) => sp.map((pt) => [...pt]));
  const skipped: number[] = [];
  let filled = 0;

  specimens.forEach((sp, si) => {
    const missing = sp.flatMap((pt, li) => (isMissingPoint(pt) ? [li] : []));
    if (missing.length === 0) return;

    const observed = sp.flatMap((pt, li) => (isMissingPoint(pt) ? [] : [li]));
    if (observed.length < 3) {
      skipped.push(si);
      return;
    }

    const warp = fitTPS(
      observed.map((li) => reference[li]),
      observed.map((li) => sp[li])
    );
    if (!warp) {
      skipped.push(si);
      return;
    }

    for (const li of missing) {
      const [x, y] = warp(reference[li][0], reference[li][1]);
      out[si][li] = [x, y];
      filled++;
    }
  });

  return { landmarks: out, filled, skipped };
}
