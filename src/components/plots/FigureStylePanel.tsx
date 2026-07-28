import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePlotStyleStore, type AxisMode, type RefSource } from "@/store/plotStyleStore";
import { SYMBOL_KINDS, symbolPath, isStrokeOnly, type SymbolKind } from "@/lib/symbols";
import { Palette, RotateCcw, RotateCw, FolderOpen, FlipHorizontal, FlipVertical, X } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";

/** Controls for how the PCA figure looks: group appearance, axes, references. */
export function FigureStylePanel({
  groups, symbolValues, classifiers, activeClassifier, imageDir, onPickImageFolder,
  suggestedX, suggestedY, optionsX, optionsY,
}: {
  groups: string[];
  /** Distinct values of the second classifier, when one is chosen. */
  symbolValues: string[];
  /** Every classifier defined on the dataset. */
  classifiers: string[];
  activeClassifier: string | null;
  imageDir: string | null;
  onPickImageFolder: () => void;
  /** Default reference positions, used to seed the pinned list. */
  suggestedX: number[];
  suggestedY: number[];
  /** Axis tick values, offered as the positions a reference can sit at. */
  optionsX: number[];
  optionsY: number[];
}) {
  const {
    styles, setStyle, resetStyles,
    symbolBy, setSymbolBy, symbolStyles, setSymbolStyle,
    axisMode, setAxisMode, manualLimits, setManualLimits,
    invertX, invertY, setInvert,
    refShapesX, refShapesY, setRefShapes,
    refSource, setRefSource, refShowIds, setRefShowIds,
    refSize, setRefSize,
    refFlipX, refFlipY, setRefFlip, refRotation, setRefRotation,
    refPositionsX, refPositionsY, setRefPositions,
    figureWidth, figureHeight, setFigureSize, exportScale, setExportScale,
    showLegend, setShowLegend,
  } = usePlotStyleStore();

  const t = useT();
  const splitEncoding = !!symbolBy;
  const otherClassifiers = classifiers.filter((c) => c !== activeClassifier);


  return (
    <div className="space-y-3">
      <CollapsibleCard
        title={<><Palette size={13} /> {t("fig.groups")}</>}
        contentClassName="space-y-3"
        actions={
          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={resetStyles} title={t("fig.resetStyles")}>
            <RotateCcw size={11} />
          </Button>
        }
      >
          {groups.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t("fig.noClassifier")}
            </p>
          )}
          {groups.map((g) => {
            const st = styles[g];
            if (!st) return null;
            const stroke = isStrokeOnly(st.symbol) || !st.filled;
            // One row per value: swatch, name, and — unless a second
            // category owns the shapes — the symbol and its fill.
            return (
              <div key={g} className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={st.color}
                  onChange={(e) => setStyle(g, { color: e.target.value })}
                  className="h-7 w-7 shrink-0 cursor-pointer rounded border bg-background p-0.5"
                  title={t("fig.colour")}
                />
                <Input
                  className="h-7 min-w-0 flex-1 text-xs"
                  value={st.label}
                  onChange={(e) => setStyle(g, { label: e.target.value })}
                  title={`${t("fig.legend")}: ${g}`}
                />
                {!splitEncoding && (
                  <>
                    <select
                      className="h-7 w-20 shrink-0 rounded border bg-background px-1 text-xs"
                      value={st.symbol}
                      onChange={(e) => setStyle(g, { symbol: e.target.value as SymbolKind })}
                    >
                      {SYMBOL_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <button
                      onClick={() => setStyle(g, { filled: !st.filled })}
                      disabled={isStrokeOnly(st.symbol)}
                      className="h-7 w-7 shrink-0 rounded border transition-colors hover:bg-muted disabled:opacity-40"
                      title={t("fig.filledOrOpen")}
                    >
                      <svg width={16} height={16} viewBox="-8 -8 16 16" className="mx-auto">
                        <path d={symbolPath(st.symbol, 5)} fill={stroke ? "none" : st.color} stroke={st.color} strokeWidth={stroke ? 1.6 : 0.7} />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            );
          })}
      </CollapsibleCard>

      {otherClassifiers.length > 0 && (
        <CollapsibleCard title={t("fig.secondClassifier")} contentClassName="space-y-2 text-xs">
            <select
              className="w-full rounded border bg-background px-1.5 py-1"
              value={symbolBy ?? ""}
              onChange={(e) => setSymbolBy(e.target.value || null)}
            >
              <option value="">{t("fig.symbolsFollow")}</option>
              {otherClassifiers.map((c) => (
                <option key={c} value={c}>{t("fig.symbolBy")} “{c}”</option>
              ))}
            </select>
            <p className="text-muted-foreground">
              {splitEncoding
                ? t("fig.splitActive").replace("{a}", activeClassifier ?? "").replace("{b}", symbolBy ?? "")
                : t("fig.splitHint")}
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
                    title={`${t("fig.legend")}: ${v}`}
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
                    title={t("fig.filledOrOpen")}
                  >
                    {st.filled ? t("fig.solid") : t("fig.open")}
                  </button>
                </div>
              );
            })}
        </CollapsibleCard>
      )}

      <CollapsibleCard title={t("fig.axes")} contentClassName="space-y-2 text-xs">
          <select
            className="w-full rounded border bg-background px-1.5 py-1"
            value={axisMode}
            onChange={(e) => setAxisMode(e.target.value as AxisMode)}
          >
            <option value="auto">{t("fig.axisAuto")}</option>
            <option value="symmetric">{t("fig.axisSymmetric")}</option>
            <option value="manual">{t("fig.axisManual")}</option>
          </select>
          <p className="text-muted-foreground">
            {axisMode === "symmetric"
              ? t("fig.axisSymHint")
              : axisMode === "manual"
                ? t("fig.axisManualHint")
                : t("fig.axisAutoHint")}
          </p>

          {/* The sign of a principal component is arbitrary, so an axis may
              come out reversed from a figure published elsewhere. */}
          <div className="space-y-1 border-t pt-2">
            <p className="text-muted-foreground">{t("fig.invertAxis")}</p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setInvert("x", !invertX)}
                className={`h-7 flex-1 rounded border text-xs transition-colors ${
                  invertX ? "border-primary bg-primary/15 text-primary" : "hover:bg-muted"
                }`}
              >
                ↔ X
              </button>
              <button
                onClick={() => setInvert("y", !invertY)}
                className={`h-7 flex-1 rounded border text-xs transition-colors ${
                  invertY ? "border-primary bg-primary/15 text-primary" : "hover:bg-muted"
                }`}
              >
                ↕ Y
              </button>
            </div>
          </div>
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
      </CollapsibleCard>

      <CollapsibleCard title={t("fig.shapeRefs")} contentClassName="space-y-2 text-xs">
          <select
            className="w-full rounded border bg-background px-1.5 py-1"
            value={refSource}
            onChange={(e) => setRefSource(e.target.value as RefSource)}
          >
            <option value="wireframe">{t("fig.refWireframe")}</option>
            <option value="photo">{t("fig.refPhoto")}</option>
            <option value="deformation">{t("fig.refDeformation")}</option>
          </select>
          <p className="text-muted-foreground">
            {refSource === "deformation"
              ? t("fig.refDeformHint")
              : t("fig.refSpecimenHint")}
          </p>

          {refSource === "photo" && (
            <div className="space-y-1 rounded border bg-muted/30 p-2">
              <Button size="sm" variant="outline" className="h-7 w-full text-xs" onClick={onPickImageFolder}>
                <FolderOpen size={12} /> {imageDir ? t("fig.changeImageFolder") : t("fig.chooseImageFolder")}
              </Button>
              {imageDir ? (
                <p className="break-all text-[10px] text-muted-foreground">{imageDir}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  {t("fig.imageFolderHint")}
                </p>
              )}
            </div>
          )}

          <RefAxisControls
            axis="x" label={t("fig.alongX")} count={refShapesX} pinned={refPositionsX}
            suggested={suggestedX} options={optionsX}
            setRefShapes={setRefShapes} setRefPositions={setRefPositions} t={t}
          />
          <RefAxisControls
            axis="y" label={t("fig.alongY")} count={refShapesY} pinned={refPositionsY}
            suggested={suggestedY} options={optionsY}
            setRefShapes={setRefShapes} setRefPositions={setRefPositions} t={t}
          />

          <div className="space-y-1.5 border-t pt-2">
            <p className="text-muted-foreground">{t("fig.orientation")}</p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setRefFlip("x", !refFlipX)}
                className={`h-7 flex-1 rounded border text-xs transition-colors ${
                  refFlipX ? "border-primary bg-primary/15 text-primary" : "hover:bg-muted"
                }`}
                title={t("fig.flipXHint")}
              >
                <FlipHorizontal size={12} className="mx-auto" />
              </button>
              <button
                onClick={() => setRefFlip("y", !refFlipY)}
                className={`h-7 flex-1 rounded border text-xs transition-colors ${
                  refFlipY ? "border-primary bg-primary/15 text-primary" : "hover:bg-muted"
                }`}
                title={t("fig.flipYHint")}
              >
                <FlipVertical size={12} className="mx-auto" />
              </button>
              <button
                onClick={() => setRefRotation((refRotation + 90) % 360)}
                className="h-7 flex-1 rounded border text-xs transition-colors hover:bg-muted"
                title={t("fig.rotate90")}
              >
                <RotateCw size={12} className="mx-auto" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range" min={0} max={359} step={1}
                value={refRotation}
                onChange={(e) => setRefRotation(+e.target.value)}
                className="flex-1"
              />
              <div className="flex items-center gap-0.5">
                <NumberInput
                  className="h-7 w-14 text-xs"
                  min={0} max={359}
                  value={refRotation}
                  onChange={setRefRotation}
                />
                <span className="text-[10px] text-muted-foreground">°</span>
              </div>
            </div>
          </div>
          {(refShapesX > 0 || refShapesY > 0) && (
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">{t("fig.refSize")}</Label>
              <input
                type="range" min={48} max={200} step={4}
                value={refSize}
                onChange={(e) => setRefSize(+e.target.value)}
                className="w-28"
              />
            </div>
          )}
          {refSource !== "deformation" && (
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs">{t("fig.showIds")}</Label>
              <Switch checked={refShowIds} onCheckedChange={setRefShowIds} />
            </div>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            <Label className="text-xs">{t("fig.legend")}</Label>
            <Switch checked={showLegend} onCheckedChange={setShowLegend} />
          </div>
          <p className="text-muted-foreground">{t("fig.dragLegend")}</p>
      </CollapsibleCard>

      <CollapsibleCard title={t("fig.size")} defaultOpen={false} contentClassName="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[10px]">{t("fig.width")}</Label>
              <NumberInput
                className="h-7 text-xs" min={400} max={2400}
                value={figureWidth}
                onChange={(w) => setFigureSize(w, figureHeight)}
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px]">{t("fig.height")}</Label>
              <NumberInput
                className="h-7 text-xs" min={300} max={2400}
                value={figureHeight}
                onChange={(h) => setFigureSize(figureWidth, h)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">{t("fig.exportQuality")}</Label>
            <select
              className="rounded border bg-background px-1.5 py-1"
              value={exportScale}
              onChange={(e) => setExportScale(+e.target.value)}
            >
              {[2, 3, 4, 6, 8].map((s) => (
                <option key={s} value={s}>{s}×</option>
              ))}
            </select>
          </div>
          <p className="text-muted-foreground">
            {t("fig.exportQualityHint")
              .replace("{w}", String(Math.round(figureWidth * exportScale)))
              .replace("{h}", String(Math.round(figureHeight * exportScale)))}
          </p>
      </CollapsibleCard>
    </div>
  );
}

/**
 * Per-axis reference controls: how many drawings, or — once pinned — the
 * exact axis values each one sits at, which is what a figure for print
 * usually needs.
 */
function RefAxisControls({
  axis, label, count, pinned, suggested, options, setRefShapes, setRefPositions, t,
}: {
  axis: "x" | "y";
  label: string;
  count: number;
  pinned: number[] | null;
  suggested: number[];
  /** The axis tick values — the positions a reference can sit at. */
  options: number[];
  setRefShapes: (axis: "x" | "y", n: number) => void;
  setRefPositions: (axis: "x" | "y", positions: number[] | null) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-1">
          <Switch
            checked={pinned ? pinned.length > 0 : count > 0}
            onCheckedChange={(on) => {
              if (pinned) setRefPositions(axis, on ? suggested : []);
              else setRefShapes(axis, on ? 4 : 0);
            }}
          />
          {!pinned && (
            <NumberInput
              className="h-7 w-14 text-xs" min={0} max={8}
              value={count}
              onChange={(n) => setRefShapes(axis, n)}
            />
          )}
        </div>
      </div>

      {pinned ? (
        <div className="space-y-1 rounded border bg-muted/30 p-1.5">
          {pinned.map((value, i) => (
            <div key={i} className="flex items-center gap-1">
              <select
                className="h-6 flex-1 rounded border bg-background px-1 text-[11px]"
                value={value}
                onChange={(e) =>
                  setRefPositions(axis, pinned.map((p, j) => (j === i ? +e.target.value : p)))
                }
              >
                {(options.includes(value) ? options : [value, ...options]).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <button
                onClick={() => setRefPositions(axis, pinned.filter((_, j) => j !== i))}
                className="px-1 text-muted-foreground hover:text-destructive"
                title={t("fig.removePosition")}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <div className="flex gap-1">
            <button
              onClick={() => setRefPositions(axis, [...pinned, options[0] ?? 0])}
              className="flex-1 rounded border px-1 py-0.5 text-[10px] hover:bg-muted"
            >
              + {t("fig.addPosition")}
            </button>
            <button
              onClick={() => setRefPositions(axis, null)}
              className="flex-1 rounded border px-1 py-0.5 text-[10px] hover:bg-muted"
            >
              {t("fig.backToAuto")}
            </button>
          </div>
        </div>
      ) : (
        count > 0 && (
          <button
            onClick={() => setRefPositions(axis, suggested)}
            className="w-full rounded border px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
          >
            {t("fig.pinPositions")}
          </button>
        )
      )}
    </div>
  );
}
