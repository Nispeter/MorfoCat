/**
 * Rotate a set of aligned 2D configurations so the consensus lies along its
 * principal axes (MorphoJ's "align by principal axes" display option). The same
 * rigid rotation is applied to every specimen, so shape is unchanged — only the
 * orientation of the whole sample. Non-2D input is returned unchanged.
 */
export function alignPrincipalAxes(
  consensus: number[][],
  aligned: number[][][]
): { consensus: number[][]; aligned: number[][][] } {
  if (!consensus.length || consensus[0].length !== 2) {
    return { consensus, aligned };
  }

  // Centroid of the consensus
  const n = consensus.length;
  let mx = 0, my = 0;
  for (const [x, y] of consensus) { mx += x; my += y; }
  mx /= n; my /= n;

  // 2x2 covariance of the consensus points
  let sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of consensus) {
    const dx = x - mx, dy = y - my;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }

  // Angle of the major principal axis; rotate by -theta to put it on x
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const cos = Math.cos(-theta), sin = Math.sin(-theta);
  const rot = ([x, y]: number[]) => [
    (x - mx) * cos - (y - my) * sin + mx,
    (x - mx) * sin + (y - my) * cos + my,
  ];

  return {
    consensus: consensus.map(rot),
    aligned: aligned.map((sp) => sp.map(rot)),
  };
}
