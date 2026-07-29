/**
 * Plot symbols and the default group palette.
 *
 * Point shape carries the group identity alongside colour so figures stay
 * readable in greyscale print and for colour-blind readers.
 */

export const SYMBOL_KINDS = [
  "circle", "square", "triangle", "diamond", "cross", "plus", "star",
] as const;

export type SymbolKind = (typeof SYMBOL_KINDS)[number];

/** SVG path for a symbol centred on the origin, `r` being its half-size. */
export function symbolPath(kind: SymbolKind, r: number): string {
  switch (kind) {
    case "square":
      return `M${-r},${-r}H${r}V${r}H${-r}Z`;
    case "triangle":
      return `M0,${-r * 1.15}L${r},${r * 0.85}L${-r},${r * 0.85}Z`;
    case "diamond":
      return `M0,${-r * 1.25}L${r * 1.1},0L0,${r * 1.25}L${-r * 1.1},0Z`;
    case "cross":
      return `M${-r},${-r}L${r},${r}M${-r},${r}L${r},${-r}`;
    case "plus":
      return `M${-r * 1.2},0H${r * 1.2}M0,${-r * 1.2}V${r * 1.2}`;
    case "star": {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r * 1.35 : r * 0.55;
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        pts.push(`${(radius * Math.cos(angle)).toFixed(2)},${(radius * Math.sin(angle)).toFixed(2)}`);
      }
      return `M${pts.join("L")}Z`;
    }
    case "circle":
    default:
      return `M${-r},0a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`;
  }
}

/** Symbols drawn as strokes only — they have no interior to fill. */
export function isStrokeOnly(kind: SymbolKind): boolean {
  return kind === "cross" || kind === "plus";
}

/**
 * Outline drawn around every point, independent of the group colour.
 *
 * Pale groups wash out against a white page and dark ones against a dark
 * theme, so a fixed rim keeps the marks legible whatever palette is chosen —
 * black on light backgrounds, white on dark ones.
 */
export const POINT_BORDERS = ["none", "black", "white"] as const;

export type PointBorder = (typeof POINT_BORDERS)[number];

export function borderColour(border: PointBorder): string | null {
  if (border === "black") return "#000000";
  if (border === "white") return "#ffffff";
  return null;
}

/** Distinct hues that stay legible on both light and dark backgrounds. */
export const GROUP_PALETTE = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#a855f7", "#06b6d4", "#ec4899", "#84cc16",
  "#f97316", "#14b8a6", "#8b5cf6", "#64748b",
];

export function defaultGroupColor(index: number): string {
  return GROUP_PALETTE[index % GROUP_PALETTE.length];
}

export function defaultGroupSymbol(index: number): SymbolKind {
  return SYMBOL_KINDS[index % SYMBOL_KINDS.length];
}
