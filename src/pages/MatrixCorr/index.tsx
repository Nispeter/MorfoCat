import { useState } from "react";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { matrixCorrelation, computeCovariance } from "@/lib/ipc";
import { Play } from "lucide-react";

export default function MatrixCorr() {
  const aligned = useDatasetStore((s) => s.aligned);
  const dataset = useDatasetStore((s) => s.dataset);
  const { matrixCorr, setMatrixCorr, setLoading, setError, loading, errors } = useAnalysisStore();
  const [permutations, setPermutations] = useState(999);
  const [status, setStatus] = useState("");

  const run = async () => {
    if (!aligned) return;
    setLoading("matrixCorr", true);
    setError("matrixCorr", null);
    try {
      setStatus("Computing standard covariance matrix…");
      const cov1 = await computeCovariance(aligned);
      setStatus("Computing pooled within-group covariance matrix…");
      const groups = dataset?.specimens.filter((s) => s.include).map((s) => s.group ?? "all");
      const cov2 = await computeCovariance(aligned, groups, true);
      setStatus("Computing matrix correlation…");
      const res = await matrixCorrelation(cov1.covariance, cov2.covariance, permutations);
      setMatrixCorr(res);
      setStatus("");
    } catch (e) {
      setError("matrixCorr", e instanceof Error ? e.message : String(e));
      setStatus("");
    } finally {
      setLoading("matrixCorr", false);
    }
  };

  if (!aligned) return (
    <PanelLayout title="Matrix Correlation">
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Run Procrustes Fit first.</div>
    </PanelLayout>
  );

  const binned = binNullDist(matrixCorr?.null_distribution ?? []);

  return (
    <PanelLayout
      title="Matrix Correlation"
      description="Correlation between two covariance matrices with permutation test"
      actions={
        <div className="flex items-center gap-2">
          <select className="text-xs border rounded px-2 py-1" value={permutations} onChange={(e) => setPermutations(+e.target.value)}>
            {[99, 499, 999, 4999].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <Button size="sm" onClick={run} disabled={loading["matrixCorr"]}>
            <Play size={14} /> {loading["matrixCorr"] ? status || "Running…" : "Run"}
          </Button>
        </div>
      }
    >
      {errors["matrixCorr"] && <p className="mb-3 text-sm text-destructive">{errors["matrixCorr"]}</p>}

      {!matrixCorr ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Correlates standard vs. pooled within-group covariance matrices.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-4">
            <Card className="flex-1">
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Matrix r</span><span className="font-mono font-semibold">{matrixCorr.r.toFixed(5)}</span></div>
                <div className="flex justify-between text-sm items-center"><span className="text-muted-foreground">p-value</span>
                  <Badge variant={matrixCorr.p_value < 0.05 ? "default" : "secondary"}>
                    {matrixCorr.p_value < 0.001 ? "< 0.001" : matrixCorr.p_value.toFixed(3)}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Permutations</span><span className="font-mono">{matrixCorr.permutations}</span></div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Null Distribution (permutation test)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={binned} margin={{ top: 4, right: 4, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="bin" tick={{ fontSize: 10 }} label={{ value: "r", position: "insideBottom", offset: -4, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <ReferenceLine x={matrixCorr.r.toFixed(2)} stroke="hsl(var(--destructive))" strokeWidth={2} label={{ value: `r = ${matrixCorr.r.toFixed(3)}`, fontSize: 10 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" opacity={0.7} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </PanelLayout>
  );
}

function binNullDist(values: number[], bins = 30) {
  if (!values.length) return [];
  const min = Math.min(...values), max = Math.max(...values);
  const step = (max - min) / bins || 1;
  const counts = Array(bins).fill(0);
  values.forEach((v) => {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1);
    counts[idx]++;
  });
  return counts.map((count, i) => ({ bin: (min + (i + 0.5) * step).toFixed(2), count }));
}
