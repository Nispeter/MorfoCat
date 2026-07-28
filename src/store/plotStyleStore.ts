import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultGroupColor, defaultGroupSymbol, type SymbolKind } from "@/lib/symbols";

export interface GroupStyle {
  /** Name shown in the legend — defaults to the classifier value. */
  label: string;
  color: string;
  symbol: SymbolKind;
  filled: boolean;
}

/**
 * Appearance of a second classifier shown at the same time as the first.
 * A specimen has exactly one value per classifier, but it can carry several
 * classifiers at once (site *and* sex), so a plot can encode two of them:
 * colour for one, symbol shape for the other.
 */
export interface SymbolGroupStyle {
  label: string;
  symbol: SymbolKind;
  filled: boolean;
}

export type AxisMode = "auto" | "symmetric" | "manual";

/**
 * What the small drawings along each axis show.
 * - `wireframe` / `photo`: the real specimen sitting closest to that point on
 *   the axis — the shape each end of the axis actually looks like.
 * - `deformation`: the mean shape pushed along the PC, which is the average
 *   trend rather than any one specimen.
 */
export type RefSource = "wireframe" | "photo" | "deformation";

export interface AxisLimits {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

interface PlotStyleState {
  /** Per-group appearance for the colour classifier, keyed by its raw value. */
  styles: Record<string, GroupStyle>;
  /** Classifier driving symbol shape; null means symbols follow the colours. */
  symbolBy: string | null;
  /** Per-value symbols for `symbolBy`, kept separate so values can't collide. */
  symbolStyles: Record<string, SymbolGroupStyle>;
  axisMode: AxisMode;
  manualLimits: AxisLimits;
  /** Flip an axis so the plot matches a figure made elsewhere. The sign of a
   *  principal component is arbitrary, so this is presentation, not data. */
  invertX: boolean;
  invertY: boolean;
  /** Number of reference shapes drawn along each axis (0 hides them). */
  refShapesX: number;
  refShapesY: number;
  refSource: RefSource;
  /** Show the specimen's ID under each reference drawing. */
  refShowIds: boolean;
  /** Size of each reference drawing, in figure pixels. */
  refSize: number;
  /** Gap between the axis and its reference drawings, in figure pixels. */
  refGap: number;
  /** Mirror the reference drawings; which way a specimen faces depends on how
   *  it was photographed, so this is a display choice, not a data change. */
  refFlipX: boolean;
  refFlipY: boolean;
  /** Clockwise rotation of the reference drawings, in degrees. */
  refRotation: number;
  /** Exact axis positions to draw references at; null spaces them evenly. */
  refPositionsX: number[] | null;
  refPositionsY: number[] | null;
  /** Figure size in pixels; the export is rendered from this at high DPI. */
  figureWidth: number;
  figureHeight: number;
  /** Multiplier applied when rasterizing the PNG. */
  exportScale: number;
  /** Legend position as a fraction of the plot area, so it survives resizing. */
  legendPos: { x: number; y: number };
  /** Legend size relative to its default, for fitting it into a figure. */
  legendScale: number;
  showLegend: boolean;

  /** Fill in defaults for any group we haven't seen before. */
  ensureGroups: (groups: string[]) => void;
  setStyle: (group: string, patch: Partial<GroupStyle>) => void;
  resetStyles: () => void;
  setSymbolBy: (name: string | null) => void;
  ensureSymbolGroups: (values: string[]) => void;
  setSymbolStyle: (value: string, patch: Partial<SymbolGroupStyle>) => void;
  setAxisMode: (mode: AxisMode) => void;
  setInvert: (axis: "x" | "y", on: boolean) => void;
  setManualLimits: (patch: Partial<AxisLimits>) => void;
  setRefShapes: (axis: "x" | "y", n: number) => void;
  setRefSource: (source: RefSource) => void;
  setRefShowIds: (show: boolean) => void;
  setRefSize: (size: number) => void;
  setRefGap: (gap: number) => void;
  setRefFlip: (axis: "x" | "y", on: boolean) => void;
  setRefRotation: (deg: number) => void;
  setRefPositions: (axis: "x" | "y", positions: number[] | null) => void;
  setFigureSize: (w: number, h: number) => void;
  setExportScale: (scale: number) => void;
  setLegendPos: (pos: { x: number; y: number }) => void;
  setLegendScale: (scale: number) => void;
  setShowLegend: (show: boolean) => void;
  /** Everything that describes how the figure looks, for saving in a project. */
  snapshot: () => PlotStyleSnapshot;
  restore: (snap: Partial<PlotStyleSnapshot>) => void;
}

/** The figure's appearance, split out so a project file can carry it. */
export type PlotStyleSnapshot = Pick<
  PlotStyleState,
  | "styles" | "symbolBy" | "symbolStyles"
  | "axisMode" | "manualLimits" | "invertX" | "invertY"
  | "refShapesX" | "refShapesY" | "refSource" | "refShowIds" | "refSize" | "refGap"
  | "refFlipX" | "refFlipY" | "refRotation" | "refPositionsX" | "refPositionsY"
  | "figureWidth" | "figureHeight" | "exportScale"
  | "legendPos" | "legendScale" | "showLegend"
>;

const SNAPSHOT_KEYS = [
  "styles", "symbolBy", "symbolStyles",
  "axisMode", "manualLimits", "invertX", "invertY",
  "refShapesX", "refShapesY", "refSource", "refShowIds", "refSize", "refGap",
  "refFlipX", "refFlipY", "refRotation", "refPositionsX", "refPositionsY",
  "figureWidth", "figureHeight", "exportScale",
  "legendPos", "legendScale", "showLegend",
] as const satisfies readonly (keyof PlotStyleSnapshot)[];

export const usePlotStyleStore = create<PlotStyleState>()(
  persist(
    (set, get) => ({
      styles: {},
      symbolBy: null,
      symbolStyles: {},
      axisMode: "auto",
      invertX: false,
      invertY: false,
      manualLimits: { xMin: -0.1, xMax: 0.1, yMin: -0.1, yMax: 0.1 },
      refShapesX: 4,
      refShapesY: 4,
      refSource: "wireframe",
      refShowIds: false,
      refSize: 96,
      refGap: 12,
      refFlipX: false,
      refFlipY: false,
      refRotation: 0,
      refPositionsX: null,
      refPositionsY: null,
      figureWidth: 900,
      figureHeight: 680,
      exportScale: 4,
      legendPos: { x: 0.66, y: 0.7 },
      legendScale: 1,
      showLegend: true,

      ensureGroups: (groups) => {
        const existing = get().styles;
        const missing = groups.filter((g) => !existing[g]);
        if (missing.length === 0) return;
        const next = { ...existing };
        // Index against the full list so colours stay stable as groups appear.
        groups.forEach((g, i) => {
          if (next[g]) return;
          next[g] = {
            label: g,
            color: defaultGroupColor(i),
            symbol: defaultGroupSymbol(i),
            filled: true,
          };
        });
        set({ styles: next });
      },

      setStyle: (group, patch) =>
        set((s) => {
          const current = s.styles[group];
          if (!current) return s;
          return { styles: { ...s.styles, [group]: { ...current, ...patch } } };
        }),

      resetStyles: () => set({ styles: {}, symbolStyles: {} }),

      setSymbolBy: (symbolBy) => set({ symbolBy }),

      ensureSymbolGroups: (values) => {
        const existing = get().symbolStyles;
        if (values.every((v) => existing[v])) return;
        const next = { ...existing };
        values.forEach((v, i) => {
          if (next[v]) return;
          next[v] = { label: v, symbol: defaultGroupSymbol(i), filled: true };
        });
        set({ symbolStyles: next });
      },

      setSymbolStyle: (value, patch) =>
        set((s) => {
          const current = s.symbolStyles[value];
          if (!current) return s;
          return { symbolStyles: { ...s.symbolStyles, [value]: { ...current, ...patch } } };
        }),

      setAxisMode: (axisMode) => set({ axisMode }),
      setInvert: (axis, on) => set(axis === "x" ? { invertX: on } : { invertY: on }),
      setManualLimits: (patch) => set((s) => ({ manualLimits: { ...s.manualLimits, ...patch } })),
      setRefShapes: (axis, n) =>
        set(axis === "x" ? { refShapesX: n } : { refShapesY: n }),
      setRefSource: (refSource) => set({ refSource }),
      setRefShowIds: (refShowIds) => set({ refShowIds }),
      setRefSize: (refSize) => set({ refSize }),
      setRefGap: (refGap) => set({ refGap }),
      setRefFlip: (axis, on) => set(axis === "x" ? { refFlipX: on } : { refFlipY: on }),
      setRefRotation: (refRotation) => set({ refRotation }),
      setRefPositions: (axis, positions) =>
        set(axis === "x" ? { refPositionsX: positions } : { refPositionsY: positions }),
      setFigureSize: (figureWidth, figureHeight) => set({ figureWidth, figureHeight }),
      setExportScale: (exportScale) => set({ exportScale }),
      setLegendPos: (legendPos) => set({ legendPos }),
      setLegendScale: (legendScale) => set({ legendScale }),
      setShowLegend: (showLegend) => set({ showLegend }),

      snapshot: () => {
        const s = get();
        return Object.fromEntries(
          SNAPSHOT_KEYS.map((k) => [k, s[k]])
        ) as PlotStyleSnapshot;
      },

      restore: (snap) =>
        set(
          Object.fromEntries(
            SNAPSHOT_KEYS.filter((k) => snap[k] !== undefined).map((k) => [k, snap[k]])
          ) as Partial<PlotStyleState>
        ),
    }),
    { name: "morfocat-plot-style" }
  )
);
