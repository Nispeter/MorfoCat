import { useState } from "react";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScreePlot } from "@/components/plots/ScreePlot";
import { BiPlot } from "@/components/plots/BiPlot";
import { ShapeGrid } from "@/components/plots/ShapeGrid";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { runPCA } from "@/lib/ipc";
import { Play } from "lucide-react";

export default function PCA() {
  const aligned = useDatasetStore((s) => s.aligned);
  const consensus = useDatasetStore((s) => s.consensus);
  const dataset = useDatasetStore((s) => s.dataset);
  const { pca, setPCA, setLoading, setError, loading, errors } = useAnalysisStore();
  const [pcX, setPcX] = useState(0);
  const [pcY, setPcY] = useState(1);
  const [scale, setScale] = useState(2);

  const included = dataset?.specimens.filter((s) => s.include) ?? [];
  const groups = included.map((s) => s.group ?? "all");
  const ids = included.map((s) => s.id);

  const run = async () => {
    if (!aligned) return;
    setLoading("pca", true);
    setError("pca", null);
    try {
      const res = await runPCA(aligned);
      setPCA(res);
    } catch (e) {
      setError("pca", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading("pca", false);
    }
  };

  // Compute shape deformation for selected PC at ±scale SD
  const deformedPlus = pca && consensus ? computeDeformed(consensus, pca.loadings, pca.eigenvalues, pcX, scale) : null;
  const deformedMinus = pca && consensus ? computeDeformed(consensus, pca.loadings, pca.eigenvalues, pcX, -scale) : null;

  if (!aligned) {
    return (
      <PanelLayout title="Principal Component Analysis">
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Run Procrustes Fit first.</div>
      </PanelLayout>
    );
  }

  return (
    <PanelLayout
      title="Principal Component Analysis"
      description="PCA of Procrustes shape coordinates"
      actions={<Button size="sm" onClick={run} disabled={loading["pca"]}><Play size={14} /> {loading["pca"] ? "Running…" : "Run PCA"}</Button>}
    >
      {!pca ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          {errors["pca"] ? <span className="text-destructive">{errors["pca"]}</span> : "Click Run PCA to begin."}
        </div>
      ) : (
        <Tabs defaultValue="scree" className="h-full">
          <TabsList>
            <TabsTrigger value="scree">Scree Plot</TabsTrigger>
            <TabsTrigger value="biplot">Biplot</TabsTrigger>
            <TabsTrigger value="shapes">Shape Deformation</TabsTrigger>
            <TabsTrigger value="table">PC Scores</TabsTrigger>
          </TabsList>

          <TabsContent value="scree">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Variance Explained</CardTitle></CardHeader>
              <CardContent>
                <ScreePlot pctVariance={pca.pct_variance} cumulativePct={pca.cumulative_pct} selectedPC={pcX} onSelectPC={setPcX} />
                <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                  {pca.pct_variance.slice(0, 8).map((pct, i) => (
                    <div key={i} className={`rounded border p-2 cursor-pointer transition-colors ${pcX === i ? "border-primary bg-primary/5" : "hover:bg-muted"}`} onClick={() => setPcX(i)}>
                      <p className="font-medium">PC{i + 1}</p>
                      <p className="text-muted-foreground">{pct.toFixed(2)}%</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="biplot">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-3">
                  Biplot
                  <span className="text-xs font-normal text-muted-foreground">PC axes:</span>
                  <select className="text-xs border rounded px-1" value={pcX} onChange={(e) => setPcX(+e.target.value)}>
                    {pca.pct_variance.slice(0, 10).map((_, i) => <option key={i} value={i}>PC{i + 1}</option>)}
                  </select>
                  <span className="text-xs text-muted-foreground">vs</span>
                  <select className="text-xs border rounded px-1" value={pcY} onChange={(e) => setPcY(+e.target.value)}>
                    {pca.pct_variance.slice(0, 10).map((_, i) => <option key={i} value={i}>PC{i + 1}</option>)}
                  </select>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BiPlot scores={pca.scores} loadings={pca.loadings} groups={groups} pcX={pcX} pcY={pcY} pctVariance={pca.pct_variance} ids={ids} showLoadings={false} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shapes">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-3">
                  Shape Deformation along PC{pcX + 1}
                  <span className="text-xs text-muted-foreground">Scale: ±{scale}SD</span>
                  <input type="range" min={1} max={4} step={0.5} value={scale} onChange={(e) => setScale(+e.target.value)} className="w-24" />
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-around gap-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">−{scale}SD</p>
                  {deformedMinus && consensus && <ShapeGrid consensus={consensus} deformed={deformedMinus} />}
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">Consensus</p>
                  {consensus && <ShapeGrid consensus={consensus} />}
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">+{scale}SD</p>
                  {deformedPlus && consensus && <ShapeGrid consensus={consensus} deformed={deformedPlus} />}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="table">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">PC Scores (first 6 PCs)</CardTitle></CardHeader>
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

function computeDeformed(consensus: number[][], loadings: number[][], eigenvalues: number[], pcIdx: number, scale: number): number[][] {
  if (!loadings[0] || pcIdx >= loadings[0].length) return consensus;
  const sd = Math.sqrt(eigenvalues[pcIdx] || 0);
  const flat = consensus.flat();
  const n_dim = consensus[0].length;
  const loading = loadings.map((l) => l[pcIdx] ?? 0);
  const deformedFlat = flat.map((v, i) => v + scale * sd * loading[i]);
  const result: number[][] = [];
  for (let i = 0; i < consensus.length; i++) {
    result.push(deformedFlat.slice(i * n_dim, (i + 1) * n_dim));
  }
  return result;
}
