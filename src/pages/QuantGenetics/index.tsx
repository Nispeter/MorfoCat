import { useState } from "react";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { runGMatrix, runSelectionGradient } from "@/lib/ipc";
import { Play } from "lucide-react";

export default function QuantGenetics() {
  const aligned = useDatasetStore((s) => s.aligned);
  const dataset = useDatasetStore((s) => s.dataset);
  const { gMatrix, selectionGradient, setGMatrix, setSelectionGradient, setLoading, setError, loading, errors } = useAnalysisStore();

  const [sireCol, setSireCol] = useState("");
  const [damCol, setDamCol] = useState("");
  const [fitnessStr, setFitnessStr] = useState("");

  const included = dataset?.specimens.filter((s) => s.include) ?? [];

  const runG = async () => {
    if (!aligned) return;
    const sireIds = sireCol ? included.map((s) => ((s as unknown) as Record<string, string>)[sireCol] ?? s.id) : included.map((s) => s.id);
    const damIds = damCol ? included.map((s) => ((s as unknown) as Record<string, string>)[damCol] ?? s.id) : included.map((s) => s.id);
    setLoading("gMatrix", true);
    setError("gMatrix", null);
    try {
      const res = await runGMatrix(aligned, sireIds, damIds);
      setGMatrix(res);
    } catch (e) {
      setError("gMatrix", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading("gMatrix", false);
    }
  };

  const runSel = async () => {
    if (!aligned || !fitnessStr.trim()) return;
    const fitness = fitnessStr.trim().split(/[\s,;]+/).map(Number).filter(isFinite);
    if (fitness.length !== aligned.length) { setError("selection", `Need ${aligned.length} fitness values, got ${fitness.length}`); return; }
    setLoading("selection", true);
    setError("selection", null);
    try {
      const res = await runSelectionGradient(aligned, fitness);
      setSelectionGradient(res);
    } catch (e) {
      setError("selection", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading("selection", false);
    }
  };

  if (!aligned) return (
    <PanelLayout title="Quantitative Genetics">
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Run Procrustes Fit first.</div>
    </PanelLayout>
  );

  const gCov = gMatrix?.g_matrix ?? [];
  const maxAbs = Math.max(...gCov.flat().map(Math.abs), 1e-10);

  return (
    <PanelLayout title="Quantitative Genetics of Shape" description="G matrix estimation · Selection gradient analysis">
      <Tabs defaultValue="gmatrix">
        <TabsList>
          <TabsTrigger value="gmatrix">G Matrix</TabsTrigger>
          <TabsTrigger value="selection">Selection Gradient</TabsTrigger>
        </TabsList>

        <TabsContent value="gmatrix">
          <div className="grid grid-cols-[260px_1fr] gap-4 mt-4">
            <div className="space-y-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Half-Sib Analysis</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <Label className="text-xs">Sire column name (in metadata)</Label>
                    <Input value={sireCol} onChange={(e) => setSireCol(e.target.value)} placeholder="sire" className="text-xs h-8 mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Dam column name (optional)</Label>
                    <Input value={damCol} onChange={(e) => setDamCol(e.target.value)} placeholder="dam" className="text-xs h-8 mt-1" />
                  </div>
                  <p className="text-xs text-muted-foreground">Requires family structure data. At least 2 sires needed.</p>
                  <Button size="sm" className="w-full" onClick={runG} disabled={loading["gMatrix"]}>
                    <Play size={12} /> {loading["gMatrix"] ? "Running…" : "Estimate G"}
                  </Button>
                  {errors["gMatrix"] && <p className="text-xs text-destructive">{errors["gMatrix"]}</p>}
                </CardContent>
              </Card>
              {gMatrix && (
                <Card>
                  <CardContent className="pt-4 space-y-1 text-xs">
                    <p>Sires: {gMatrix.n_sires}</p>
                    <p>Specimens: {gMatrix.n_specimens}</p>
                    <p>Top eigenvalue: {gMatrix.eigenvalues[0]?.toExponential(3)}</p>
                  </CardContent>
                </Card>
              )}
            </div>
            <Card className="overflow-auto">
              <CardHeader className="pb-2"><CardTitle className="text-sm">G Matrix Heatmap (first 30 variables)</CardTitle></CardHeader>
              <CardContent>
                {!gCov.length ? (
                  <p className="text-sm text-muted-foreground">Click Estimate G to compute.</p>
                ) : (
                  <div className="overflow-auto">
                    <table className="border-collapse text-[9px]">
                      <tbody>
                        {gCov.slice(0, 30).map((row, i) => (
                          <tr key={i}>
                            {row.slice(0, 30).map((val, j) => {
                              const norm = val / maxAbs;
                              const bg = norm > 0 ? `rgba(59,130,246,${Math.min(Math.abs(norm), 0.9)})` : `rgba(239,68,68,${Math.min(Math.abs(norm), 0.9)})`;
                              return <td key={j} style={{ background: bg, width: 16, height: 16 }} title={`${val.toExponential(2)}`} />;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="selection">
          <div className="grid grid-cols-[260px_1fr] gap-4 mt-4">
            <div className="space-y-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Selection Gradient</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Fitness values (one per included specimen)</Label>
                    <textarea
                      value={fitnessStr}
                      onChange={(e) => setFitnessStr(e.target.value)}
                      placeholder="1.2 0.8 1.5 0.9 …"
                      className="w-full h-24 text-xs font-mono rounded border bg-muted p-2 resize-none mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Need {aligned.length} values (space or comma separated)</p>
                  </div>
                  <Button size="sm" className="w-full" onClick={runSel} disabled={loading["selection"] || !fitnessStr.trim()}>
                    <Play size={12} /> {loading["selection"] ? "Running…" : "Compute β"}
                  </Button>
                  {errors["selection"] && <p className="text-xs text-destructive">{errors["selection"]}</p>}
                </CardContent>
              </Card>
            </div>
            <Card className="overflow-auto">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Directional Selection Gradient (β)</CardTitle></CardHeader>
              <CardContent>
                {!selectionGradient ? (
                  <p className="text-sm text-muted-foreground">Enter fitness values and click Compute β.</p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Mean fitness: {selectionGradient.mean_fitness.toFixed(4)}</p>
                    <div className="overflow-auto max-h-72">
                      <table className="w-full text-xs">
                        <thead className="border-b"><tr><th className="text-left p-2">Variable</th><th className="text-right p-2">β (gradient)</th><th className="text-right p-2">Response R</th></tr></thead>
                        <tbody>
                          {selectionGradient.selection_gradient.slice(0, 20).map((b, i) => (
                            <tr key={i} className="border-b hover:bg-muted/30">
                              <td className="p-2">var_{i + 1}</td>
                              <td className="p-2 text-right font-mono">{b.toFixed(6)}</td>
                              <td className="p-2 text-right font-mono">{selectionGradient.response_to_selection[i]?.toFixed(6)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PanelLayout>
  );
}
