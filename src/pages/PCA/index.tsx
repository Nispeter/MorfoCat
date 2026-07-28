import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScreePlot } from "@/components/plots/ScreePlot";
import { BiPlot } from "@/components/plots/BiPlot";
import { ShapeGrid } from "@/components/plots/ShapeGrid";
import { TpsGrid } from "@/components/plots/TpsGrid";
import { ChartFrame } from "@/components/plots/ChartFrame";
import { PCAFigure } from "@/components/plots/PCAFigure";
import { FigureStylePanel } from "@/components/plots/FigureStylePanel";
import { usePlotStyleStore } from "@/store/plotStyleStore";
import {
  figureDomain, referenceSpecimens, resolveRefPositions, refPositions, niceTicks,
} from "@/lib/figure";
import { useSpecimenImages } from "@/lib/useSpecimenImages";
import { open } from "@tauri-apps/plugin-dialog";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { runPCA } from "@/lib/ipc";
import { downloadCSV } from "@/lib/export";
import { groupsOf } from "@/lib/groups";
import { ClassifierSelect } from "@/components/layout/ClassifierSelect";
import { Play, Loader2, Download } from "lucide-react";

export default function PCA() {
  const aligned = useDatasetStore((s) => s.aligned);
  const consensus = useDatasetStore((s) => s.consensus);
  const dataset = useDatasetStore((s) => s.dataset);
  const { pca, setPCA, setLoading, setError, loading, errors } = useAnalysisStore();
  const t = useT();
  const [pcX, setPcX] = useState(0);
  const [pcY, setPcY] = useState(1);
  const [scale, setScale] = useState(2);
  const [scaleMode, setScaleMode] = useState<"sd" | "value">("sd");
  const [pcValue, setPcValue] = useState(0.1);
  const [gridDivisions, setGridDivisions] = useState(12);

  const active = useDatasetStore((s) => s.activeClassifier);
  const wireframe = useDatasetStore((s) => s.wireframe);
  const included = dataset?.specimens.filter((s) => s.include) ?? [];
  const groups = groupsOf(included, active);
  const ids = included.map((s) => s.id);

  // Photos for the specimens the figure uses as axis references. Only those
  // are read off disk — loading the whole sample would be wasteful.
  const imageDir = dataset?.imageDir ?? null;
  const setImageDir = useDatasetStore((s) => s.setImageDir);
  const refSource = usePlotStyleStore((s) => s.refSource);
  const refShapesX = usePlotStyleStore((s) => s.refShapesX);
  const refShapesY = usePlotStyleStore((s) => s.refShapesY);
  const refPositionsX = usePlotStyleStore((s) => s.refPositionsX);
  const refPositionsY = usePlotStyleStore((s) => s.refPositionsY);
  const axisMode = usePlotStyleStore((s) => s.axisMode);
  const figureWidth = usePlotStyleStore((s) => s.figureWidth);
  const figureHeight = usePlotStyleStore((s) => s.figureHeight);
  const exportScale = usePlotStyleStore((s) => s.exportScale);
  const manualLimits = usePlotStyleStore((s) => s.manualLimits);

  const refIndices = useMemo(() => {
    if (refSource !== "photo" || !pca) return [];
    const xs = pca.scores.map((s) => s[pcX] ?? 0);
    const ys = pca.scores.map((s) => s[pcY] ?? 0);
    const domain = figureDomain(xs, ys, axisMode, manualLimits);
    return [
      ...referenceSpecimens(pca.scores, pcX, resolveRefPositions(refPositionsX, refShapesX, domain.x[0], domain.x[1])),
      ...referenceSpecimens(pca.scores, pcY, resolveRefPositions(refPositionsY, refShapesY, domain.y[0], domain.y[1])),
    ].map((r) => r.index);
  }, [refSource, pca, pcX, pcY, refShapesX, refShapesY, refPositionsX, refPositionsY, axisMode, manualLimits]);

  const refPaths = useMemo(() => {
    if (!imageDir) return [];
    return [...new Set(refIndices)]
      .map((i) => included[i]?.image)
      .filter((name): name is string => !!name)
      .map((name) => `${imageDir}/${name}`);
  }, [refIndices, imageDir, included]);

  const imageUrls = useSpecimenImages(refPaths);
  const photos = useMemo(() => {
    const out: Record<number, string> = {};
    if (!imageDir) return out;
    for (const i of new Set(refIndices)) {
      const name = included[i]?.image;
      const url = name ? imageUrls[`${imageDir}/${name}`] : undefined;
      if (url) out[i] = url;
    }
    return out;
  }, [refIndices, imageUrls, imageDir, included]);

  // Where evenly spaced references would land, used to seed the pinned list.
  const suggested = useMemo(() => {
    if (!pca) return { x: [] as number[], y: [] as number[], ticksX: [] as number[], ticksY: [] as number[] };
    const xs = pca.scores.map((s) => s[pcX] ?? 0);
    const ys = pca.scores.map((s) => s[pcY] ?? 0);
    const domain = figureDomain(xs, ys, axisMode, manualLimits);
    return {
      x: refPositions(Math.max(refShapesX, 1), domain.x[0], domain.x[1]).map((v) => +v.toFixed(4)),
      y: refPositions(Math.max(refShapesY, 1), domain.y[0], domain.y[1]).map((v) => +v.toFixed(4)),
      ticksX: niceTicks(domain.x[0], domain.x[1]).map((v) => +v.toFixed(4)),
      ticksY: niceTicks(domain.y[0], domain.y[1]).map((v) => +v.toFixed(4)),
    };
  }, [pca, pcX, pcY, refShapesX, refShapesY, axisMode, manualLimits]);

  const pickImageFolder = async () => {
    const folder = await open({ directory: true, multiple: false });
    if (folder && !Array.isArray(folder)) setImageDir(folder);
  };

  // Keep the figure's per-group colours and symbols in step with the data.
  // The key is JSON so group values containing spaces survive intact.
  const groupKey = JSON.stringify(groups);
  const uniqueGroups = useMemo(
    () => [...new Set(JSON.parse(groupKey) as string[])],
    [groupKey]
  );
  const ensureGroups = usePlotStyleStore((s) => s.ensureGroups);
  useEffect(() => { ensureGroups(uniqueGroups); }, [uniqueGroups, ensureGroups]);

  // A specimen carries one value per classifier but can have several
  // classifiers, so a second one can drive the symbol shapes.
  const symbolBy = usePlotStyleStore((s) => s.symbolBy);
  const setSymbolBy = usePlotStyleStore((s) => s.setSymbolBy);
  const ensureSymbolGroups = usePlotStyleStore((s) => s.ensureSymbolGroups);
  const classifiers = dataset?.classifierNames ?? [];
  const symbolGroups = symbolBy ? groupsOf(included, symbolBy) : null;
  const symbolKey = JSON.stringify(symbolGroups ?? []);
  const uniqueSymbolGroups = useMemo(
    () => [...new Set(JSON.parse(symbolKey) as string[])],
    [symbolKey]
  );
  useEffect(() => { ensureSymbolGroups(uniqueSymbolGroups); }, [uniqueSymbolGroups, ensureSymbolGroups]);

  // Drop the second classifier if it disappears (deleted, renamed, or made active).
  useEffect(() => {
    if (symbolBy && (!classifiers.includes(symbolBy) || symbolBy === active)) setSymbolBy(null);
  }, [symbolBy, JSON.stringify(classifiers), active, setSymbolBy]);

  const run = async () => {
    if (!aligned) return;
    setLoading("pca", true);
    setError("pca", null);
    try {
      const res = await runPCA(aligned);
      setPCA(res);
      toast.success("PCA complete", { description: `PC1 explains ${res.pct_variance[0]?.toFixed(1)}% of variance` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("pca", msg);
      toast.error("PCA failed", { description: msg });
    } finally {
      setLoading("pca", false);
    }
  };

  // How far along the PC axis the shape drawings sit. In "sd" mode the slider
  // is a multiple of the PC's standard deviation; in "value" mode the user
  // types the PC score directly (MorphoJ's "scale to factor" option).
  const pcSD = pca ? Math.sqrt(pca.eigenvalues[pcX] ?? 0) : 0;
  const amount = scaleMode === "sd" ? scale * pcSD : Math.abs(pcValue);
  const deformedPlus = pca && consensus ? computeDeformed(consensus, pca.loadings, pcX, amount) : null;
  const deformedMinus = pca && consensus ? computeDeformed(consensus, pca.loadings, pcX, -amount) : null;
  const amountLabel = scaleMode === "sd" ? `${scale}SD` : amount.toPrecision(3);

  if (!aligned) {
    return (
      <PanelLayout title={t("page.pca.title")}>
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">{t("ui.needProcrustes")}</div>
      </PanelLayout>
    );
  }

  return (
    <PanelLayout
      title={t("page.pca.title")}
      description={t("page.pca.desc")}
      actions={
        <>
          {pca && (
            <Button size="sm" variant="outline" onClick={() => {
              const nPCs = Math.min(pca.scores[0]?.length ?? 0, 10);
              const headers = ["ID", ...Array.from({ length: nPCs }, (_, i) => `PC${i + 1}`)];
              const rows = pca.scores.map((row, i) => [ids[i], ...row.slice(0, nPCs)]);
              downloadCSV("pca_scores", headers, rows);
              toast.success("PC scores exported");
            }}>
              <Download size={14} /> Export CSV
            </Button>
          )}
          <Button size="sm" onClick={run} disabled={loading["pca"]}>
            {loading["pca"] ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {loading["pca"] ? t("action.running") : t("action.run") + " PCA"}
          </Button>
        </>
      }
    >
      {!pca ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          {errors["pca"] ? <span className="text-destructive">{errors["pca"]}</span> : t("action.run") + " PCA"}
        </div>
      ) : (
        <Tabs defaultValue="scree" className="h-full">
          <TabsList>
            <TabsTrigger value="scree">{t("pca.scree")}</TabsTrigger>
            <TabsTrigger value="biplot">{t("pca.biplot")}</TabsTrigger>
            <TabsTrigger value="figure">{t("pca.figure")}</TabsTrigger>
            <TabsTrigger value="shapes">{t("pca.shapeDeform")}</TabsTrigger>
            <TabsTrigger value="grid">{t("pca.transformGrid")}</TabsTrigger>
            <TabsTrigger value="table">{t("pca.scoresTab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="scree">
            <ChartFrame title={t("pca.varianceExplained")} filename="pca_scree">
              <ScreePlot pctVariance={pca.pct_variance} cumulativePct={pca.cumulative_pct} selectedPC={pcX} onSelectPC={setPcX} />
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                {pca.pct_variance.slice(0, 8).map((pct, i) => (
                  <div key={i} className={`rounded border p-2 cursor-pointer transition-colors ${pcX === i ? "border-primary bg-primary/5" : "hover:bg-muted"}`} onClick={() => setPcX(i)}>
                    <p className="font-medium">PC{i + 1}</p>
                    <p className="text-muted-foreground">{pct.toFixed(2)}%</p>
                  </div>
                ))}
              </div>
            </ChartFrame>
          </TabsContent>

          <TabsContent value="biplot">
            <ChartFrame
              title={t("pca.biplot")}
              filename={`pca_biplot_pc${pcX + 1}_pc${pcY + 1}`}
              controls={
                <>
                  <span className="text-xs font-normal text-muted-foreground">{t("pca.pcAxes")}</span>
                  <select className="rounded border bg-background px-1 py-0.5 text-xs" value={pcX} onChange={(e) => setPcX(+e.target.value)}>
                    {pca.pct_variance.slice(0, 10).map((_, i) => <option key={i} value={i}>PC{i + 1}</option>)}
                  </select>
                  <span className="text-xs font-normal text-muted-foreground">{t("pca.vs")}</span>
                  <select className="rounded border bg-background px-1 py-0.5 text-xs" value={pcY} onChange={(e) => setPcY(+e.target.value)}>
                    {pca.pct_variance.slice(0, 10).map((_, i) => <option key={i} value={i}>PC{i + 1}</option>)}
                  </select>
                  <ClassifierSelect />
                </>
              }
            >
              <BiPlot scores={pca.scores} loadings={pca.loadings} groups={groups} symbolGroups={symbolGroups} pcX={pcX} pcY={pcY} pctVariance={pca.pct_variance} ids={ids} showLoadings={false} />
            </ChartFrame>
          </TabsContent>

          <TabsContent value="figure">
            <div className="grid grid-cols-[1fr_320px] gap-4">
              <ChartFrame
                title={`PC${pcX + 1} vs PC${pcY + 1}`}
                filename={`pca_figure_pc${pcX + 1}_pc${pcY + 1}`}
                exportScale={exportScale}
                controls={
                  <>
                    <select className="rounded border bg-background px-1 py-0.5 text-xs font-normal" value={pcX} onChange={(e) => setPcX(+e.target.value)}>
                      {pca.pct_variance.slice(0, 10).map((_, i) => <option key={i} value={i}>PC{i + 1}</option>)}
                    </select>
                    <span className="text-xs font-normal text-muted-foreground">{t("pca.vs")}</span>
                    <select className="rounded border bg-background px-1 py-0.5 text-xs font-normal" value={pcY} onChange={(e) => setPcY(+e.target.value)}>
                      {pca.pct_variance.slice(0, 10).map((_, i) => <option key={i} value={i}>PC{i + 1}</option>)}
                    </select>
                    <ClassifierSelect />
                  </>
                }
              >
                <PCAFigure
                  scores={pca.scores}
                  loadings={pca.loadings}
                  pctVariance={pca.pct_variance}
                  consensus={consensus}
                  aligned={aligned}
                  wireframe={wireframe}
                  groups={groups}
                  symbolGroups={symbolGroups}
                  activeLabel={active ?? t("ui.category")}
                  ids={ids}
                  photos={photos}
                  pcX={pcX}
                  pcY={pcY}
                  width={figureWidth}
                  height={figureHeight}
                />
              </ChartFrame>
              <FigureStylePanel
                groups={uniqueGroups}
                symbolValues={uniqueSymbolGroups}
                classifiers={classifiers}
                activeClassifier={active}
                imageDir={imageDir}
                onPickImageFolder={pickImageFolder}
                suggestedX={suggested.x}
                suggestedY={suggested.y}
                optionsX={suggested.ticksX}
                optionsY={suggested.ticksY}
              />
            </div>
          </TabsContent>

          <TabsContent value="shapes">
            <ChartFrame
              title={`${t("pca.deformAlong")} PC${pcX + 1}`}
              filename={`pca_shapes_pc${pcX + 1}`}
              controls={
                <ShapeAmountControls
                  mode={scaleMode} onMode={setScaleMode}
                  sd={scale} onSd={setScale}
                  value={pcValue} onValue={setPcValue}
                  pcSD={pcSD}
                />
              }
            >
              <div className="flex justify-around gap-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">−{amountLabel}</p>
                  {deformedMinus && consensus && <ShapeGrid consensus={consensus} deformed={deformedMinus} edges={wireframe} />}
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">{t("pca.consensus")}</p>
                  {consensus && <ShapeGrid consensus={consensus} edges={wireframe} />}
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">+{amountLabel}</p>
                  {deformedPlus && consensus && <ShapeGrid consensus={consensus} deformed={deformedPlus} edges={wireframe} />}
                </div>
              </div>
            </ChartFrame>
          </TabsContent>

          <TabsContent value="grid">
            <div className="grid grid-cols-2 gap-4">
              {([["−", deformedMinus], ["+", deformedPlus]] as const).map(([sign, target]) => (
                <ChartFrame
                  key={sign}
                  title={`PC${pcX + 1} ${t("pca.at")} ${sign}${amountLabel}`}
                  filename={`pca_grid_pc${pcX + 1}_${sign === "+" ? "plus" : "minus"}`}
                  controls={
                    <>
                      <span className="text-xs font-normal text-muted-foreground">{t("pca.grid")} {gridDivisions}</span>
                      <input type="range" min={6} max={24} step={2} value={gridDivisions} onChange={(e) => setGridDivisions(+e.target.value)} className="w-20" />
                    </>
                  }
                >
                  <div className="flex justify-center">
                    {target && consensus && (
                      <TpsGrid source={consensus} target={target} edges={wireframe} divisions={gridDivisions} width={360} height={300} />
                    )}
                  </div>
                </ChartFrame>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="table">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t("pca.scoresFirst6")}</CardTitle></CardHeader>
              <CardContent className="overflow-auto max-h-96">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card border-b">
                    <tr>
                      <th className="text-left p-2">ID</th>
                      {pca.scores[0]?.slice(0, 6).map((_, i) => <th key={i} className="text-right p-2">PC{i + 1}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {pca.scores.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-mono">{ids[i]}</td>
                        {row.slice(0, 6).map((v, j) => <td key={j} className="p-2 text-right font-mono">{v.toFixed(5)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </PanelLayout>
  );
}

/** Choose how far along the PC axis the shape drawings are taken. */
function ShapeAmountControls({
  mode, onMode, sd, onSd, value, onValue, pcSD,
}: {
  mode: "sd" | "value";
  onMode: (m: "sd" | "value") => void;
  sd: number;
  onSd: (v: number) => void;
  value: number;
  onValue: (v: number) => void;
  pcSD: number;
}) {
  const t = useT();
  return (
    <>
      <select
        className="rounded border bg-background px-1 py-0.5 text-xs font-normal"
        value={mode}
        onChange={(e) => onMode(e.target.value as "sd" | "value")}
      >
        <option value="sd">{t("pca.bySD")}</option>
        <option value="value">{t("pca.byValue")}</option>
      </select>
      {mode === "sd" ? (
        <>
          <span className="text-xs font-normal text-muted-foreground">±{sd}SD</span>
          <input type="range" min={1} max={4} step={0.5} value={sd} onChange={(e) => onSd(+e.target.value)} className="w-24" />
          <span className="text-xs font-normal text-muted-foreground">= {(sd * pcSD).toPrecision(3)}</span>
        </>
      ) : (
        <>
          <span className="text-xs font-normal text-muted-foreground">±</span>
          <input
            type="number" step="any" min={0}
            value={value}
            onChange={(e) => onValue(Math.abs(parseFloat(e.target.value) || 0))}
            className="w-20 rounded border bg-background px-1 py-0.5 text-xs"
          />
          <span className="text-xs font-normal text-muted-foreground">= {pcSD > 0 ? (value / pcSD).toFixed(2) : "—"}SD</span>
        </>
      )}
    </>
  );
}

/** Consensus shifted `amount` units along the PC's loading vector. */
function computeDeformed(consensus: number[][], loadings: number[][], pcIdx: number, amount: number): number[][] {
  if (!loadings[0] || pcIdx >= loadings[0].length) return consensus;
  const flat = consensus.flat();
  const n_dim = consensus[0].length;
  const loading = loadings.map((l) => l[pcIdx] ?? 0);
  const deformedFlat = flat.map((v, i) => v + amount * loading[i]);
  const result: number[][] = [];
  for (let i = 0; i < consensus.length; i++) {
    result.push(deformedFlat.slice(i * n_dim, (i + 1) * n_dim));
  }
  return result;
}
