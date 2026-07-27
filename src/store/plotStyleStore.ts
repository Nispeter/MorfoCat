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
  /** Per-group appearance, keyed by the raw classifier value. */
  styles: Record<string, GroupStyle>;
  axisMode: AxisMode;
  manualLimits: AxisLimits;
  /** Number of reference shapes drawn along each axis (0 hides them). */
  refShapesX: number;
  refShapesY: number;
  refSource: RefSource;
  /** Show the specimen's ID under each reference drawing. */
  refShowIds: boolean;
  /** Legend position as a fraction of the plot area, so it survives resizing. */
  legendPos: { x: number; y: number };
  showLegend: boolean;

  /** Fill in defaults for any group we haven't seen before. */
  ensureGroups: (groups: string[]) => void;
  setStyle: (group: string, patch: Partial<GroupStyle>) => void;
  resetStyles: () => void;
  setAxisMode: (mode: AxisMode) => void;
  setManualLimits: (patch: Partial<AxisLimits>) => void;
  setRefShapes: (axis: "x" | "y", n: number) => void;
  setRefSource: (source: RefSource) => void;
  setRefShowIds: (show: boolean) => void;
  setLegendPos: (pos: { x: number; y: number }) => void;
  setShowLegend: (show: boolean) => void;
}

export const usePlotStyleStore = create<PlotStyleState>()(
  persist(
    (set, get) => ({
      styles: {},
      axisMode: "auto",
      manualLimits: { xMin: -0.1, xMax: 0.1, yMin: -0.1, yMax: 0.1 },
      refShapesX: 4,
      refShapesY: 4,
      refSource: "wireframe",
      refShowIds: false,
      legendPos: { x: 0.66, y: 0.7 },
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

      resetStyles: () => set({ styles: {} }),
      setAxisMode: (axisMode) => set({ axisMode }),
      setManualLimits: (patch) => set((s) => ({ manualLimits: { ...s.manualLimits, ...patch } })),
      setRefShapes: (axis, n) =>
        set(axis === "x" ? { refShapesX: n } : { refShapesY: n }),
      setRefSource: (refSource) => set({ refSource }),
      setRefShowIds: (refShowIds) => set({ refShowIds }),
      setLegendPos: (legendPos) => set({ legendPos }),
      setShowLegend: (showLegend) => set({ showLegend }),
    }),
    { name: "morfocat-plot-style" }
  )
);
