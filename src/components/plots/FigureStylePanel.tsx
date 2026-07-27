import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePlotStyleStore, type AxisMode, type RefSource } from "@/store/plotStyleStore";
import { SYMBOL_KINDS, symbolPath, isStrokeOnly, type SymbolKind } from "@/lib/symbols";
import { Palette, RotateCcw, FolderOpen } from "lucide-react";

/** Controls for how the PCA figure looks: group appearance, axes, references. */
export function FigureStylePanel({
  groups, symbolValues, classifiers, activeClassifier, imageDir, onPickImageFolder,
}: {
  groups: string[];
  /** Distinct values of the second classifier, when one is chosen. */
  symbolValues: string[];
  /** Every classifier defined on the dataset. */
  classifiers: string[];
  activeClassifier: string | null;
  imageDir: string | null;
  onPickImageFolder: () => void;
}) {
  const {
    styles, setStyle, resetStyles,
    symbolBy, setSymbolBy, symbolStyles, setSymbolStyle,
    axisMode, setAxisMode, manualLimits, setManualLimits,
    refShapesX, refShapesY, setRefShapes,
    refSource, setRefSource, refShowIds, setRefShowIds,
    showLegend, setShowLegend,
  } = usePlotStyleStore();

  const splitEncoding = !!symbolBy;
  const otherClassifiers = classifiers.filter((c) => c !== activeClassifier);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <Palette size={13} /> Groups
            <Button size="sm" variant="ghost" className="ml-auto h-6 px-1.5 text-xs" onClick={resetStyles} title="Back to default colours and symbols">
              <RotateCcw size={11} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {groups.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Extract a classifier in Data Manager to colour the plot by group.
            </p>
          )}
          {groups.map((g) => {
            const st = styles[g];
            if (!st) return null;
            const stroke = isStrokeOnly(st.symbol) || !st.filled;
            return (
              <div key={g} className="space-y-1.5 border-b pb-2 last:border-0 last:pb-0">
                <div className="flex items-center gap-1.5">
                  <svg width={18} height={18} viewBox="-9 -9 18 18" className="shrink-0">
                    <path d={symbolPath(st.symbol, 6)} fill={stroke ? "none" : st.color} stroke={st.color} strokeWidth={stroke ? 1.8 : 0.8} />
                  </svg>
                  <Input
                    className="h-7 flex-1 text-xs"
                    value={st.label}
                    onChange={(e) => setStyle(g, { label: e.target.value })}
                    title={`Legend name for "${g}"`}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={st.color}
                    onChange={(e) => setStyle(g, { color: e.target.value })}
                    className="h-7 w-8 cursor-pointer rounded border bg-background"
                    title="Colour"
                  />
                  {/* When a second classifier drives the symbols, shape is no
                      longer this classifier's to set. */}
                  {!splitEncoding && (
                    <>
                      <select
                        className="h-7 flex-1 rounded border bg-background px-1 text-xs"
                        value={st.symbol}
                        onChange={(e) => setStyle(g, { symbol: e.target.value as SymbolKind })}
                      >
                        {SYMBOL_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <button
                        onClick={() => setStyle(g, { filled: !st.filled })}
                        disabled={isStrokeOnly(st.symbol)}
                        className="h-7 rounded border px-2 text-xs transition-colors hover:bg-muted disabled:opacity-40"
                        title="Filled or open symbol"
                      >
                        {st.filled ? "solid" : "open"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {otherClassifiers.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Second classifier</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            <select
              className="w-full rounded border bg-background px-1.5 py-1"
              value={symbolBy ?? ""}
              onChange={(e) => setSymbolBy(e.target.value || null)}
            >
              <option value="">Symbols follow the colours</option>
              {otherClassifiers.map((c) => (
                <option key={c} value={c}>Symbol by “{c}”</option>
              ))}
            </select>
            <p className="text-muted-foreground">
              {splitEncoding
                ? `Colour shows “${activeClassifier}”, symbol shape shows “${symbolBy}” — each point carries both.`
                : "Show a second classifier at the same time by giving it the symbol shapes."}
            </p>

            {splitEncoding && symbolValues.map((v) => {
              const st = symbolStyles[v];
              if (!st) return null;
              const stroke = isStrokeOnly(st.symbol) || !st.filled;
              return (
                <div key={v} className="flex items-center gap-1.5">
                  <svg width={18} height={18} viewBox="-9 -9 18 18" className="shrink-0">
                    <path d={symbolPath(st.symbol, 6)} fill={stroke ? "none" : "currentColor"} stroke="currentColor" strokeWidth={stroke ? 1.8 : 0.8} />
                  </svg>
                  <Input
                    className="h-7 w-20 text-xs"
                    value={st.label}
                    onChange={(e) => setSymbolStyle(v, { label: e.target.value })}
                    title={`Legend name for "${v}"`}
                  />
                  <select
                    className="h-7 flex-1 rounded border bg-background px-1 text-xs"
                    value={st.symbol}
                    onChange={(e) => setSymbolStyle(v, { symbol: e.target.value as SymbolKind })}
                  >
                    {SYMBOL_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <button
                    onClick={() => setSymbolStyle(v, { filled: !st.filled })}
                    disabled={isStrokeOnly(st.symbol)}
                    className="h-7 rounded border px-2 text-xs transition-colors hover:bg-muted disabled:opacity-40"
                    title="Filled or open symbol"
                  >
                    {st.filled ? "solid" : "open"}
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Axes</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          <select
            className="w-full rounded border bg-background px-1.5 py-1"
            value={axisMode}
            onChange={(e) => setAxisMode(e.target.value as AxisMode)}
          >
            <option value="auto">Fit to the data</option>
            <option value="symmetric">Symmetric around zero</option>
            <option value="manual">Set min and max</option>
          </select>
          <p className="text-muted-foreground">
            {axisMode === "symmetric"
              ? "Equal range either side of zero on both axes — spread stays comparable between plots."
              : axisMode === "manual"
                ? "Fixed limits, so several plots can share one scale."
                : "Limits follow the range of the scores."}
          </p>
          {axisMode === "manual" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[10px]">X min</Label>
                <NumberInput className="h-7 text-xs" allowDecimal value={manualLimits.xMin} onChange={(xMin) => setManualLimits({ xMin })} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">X max</Label>
                <NumberInput className="h-7 text-xs" allowDecimal value={manualLimits.xMax} onChange={(xMax) => setManualLimits({ xMax })} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Y min</Label>
                <NumberInput className="h-7 text-xs" allowDecimal value={manualLimits.yMin} onChange={(yMin) => setManualLimits({ yMin })} />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Y max</Label>
                <NumberInput className="h-7 text-xs" allowDecimal value={manualLimits.yMax} onChange={(yMax) => setManualLimits({ yMax })} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Shape references</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          <select
            className="w-full rounded border bg-background px-1.5 py-1"
            value={refSource}
            onChange={(e) => setRefSource(e.target.value as RefSource)}
          >
            <option value="wireframe">Closest specimen — wireframe</option>
            <option value="photo">Closest specimen — photo</option>
            <option value="deformation">Average shape change</option>
          </select>
          <p className="text-muted-foreground">
            {refSource === "deformation"
              ? "The mean shape pushed along the axis — the overall trend rather than any one specimen."
              : "The specimen that sits closest to each point on the axis, so the drawings show shapes that really exist."}
          </p>

          {refSource === "photo" && (
            <div className="space-y-1 rounded border bg-muted/30 p-2">
              <Button size="sm" variant="outline" className="h-7 w-full text-xs" onClick={onPickImageFolder}>
                <FolderOpen size={12} /> {imageDir ? "Change image folder…" : "Choose image folder…"}
              </Button>
              {imageDir ? (
                <p className="break-all text-[10px] text-muted-foreground">{imageDir}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Point at the folder holding the specimen images. Without it the wireframe is drawn instead.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Along PC on x</Label>
            <NumberInput className="h-7 w-16 text-xs" min={0} max={8} value={refShapesX} onChange={(n) => setRefShapes("x", n)} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Along PC on y</Label>
            <NumberInput className="h-7 w-16 text-xs" min={0} max={8} value={refShapesY} onChange={(n) => setRefShapes("y", n)} />
          </div>
          {refSource !== "deformation" && (
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">Show specimen IDs</Label>
              <Switch checked={refShowIds} onCheckedChange={setRefShowIds} />
            </div>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            <Label className="text-xs">Legend</Label>
            <Switch checked={showLegend} onCheckedChange={setShowLegend} />
          </div>
          <p className="text-muted-foreground">Drag the legend to move it inside the plot.</p>
        </CardContent>
      </Card>
    </div>
  );
}
