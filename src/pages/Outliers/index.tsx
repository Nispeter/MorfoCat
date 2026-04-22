import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { detectOutliers } from "@/lib/ipc";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";
import { RefreshCw, Loader2 } from "lucide-react";

export default function Outliers() {
  const aligned = useDatasetStore((s) => s.aligned);
  const dataset = useDatasetStore((s) => s.dataset);
  const toggleSpecimen = useDatasetStore((s) => s.toggleSpecimen);
  const { outliers, setOutliers, setLoading, setError, loading, errors } = useAnalysisStore();
  const [threshold, setThreshold] = useState(3);

  const included = dataset?.specimens.filter((s) => s.include) ?? [];

  const run = async () => {
    if (!aligned) return;
    setLoading("outliers", true);
    setError("outliers", null);
    try {
      const res = await detectOutliers(aligned);
      setOutliers(res);
      const nFlagged = res.z_scores.filter((z) => Math.abs(z) > threshold).length;
      toast.success("Outlier detection complete", { description: nFlagged > 0 ? `${nFlagged} specimen(s) flagged` : "No outliers detected" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("outliers", msg);
      toast.error("Outlier detection failed", { description: msg });
    } finally {
      setLoading("outliers", false);
    }
  };

  useEffect(() => { if (aligned && !outliers) run(); }, [aligned]);

  if (!aligned) {
    return (
      <PanelLayout title="Outlier Detection">
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Run Procrustes Fit first.
        </div>
      </PanelLayout>
    );
  }

  const chartData = outliers?.z_scores.map((z, i) => ({
    id: included[i]?.id ?? `sp_${i}`,
    z: +z.toFixed(3),
    d: +(outliers.procrustes_distances[i]).toFixed(5),
    idx: i,
  })) ?? [];

  const flagged = chartData.filter((d) => Math.abs(d.z) > threshold);

  return (
    <PanelLayout
      title="Outlier Detection"
      description="Specimens with unusually large Procrustes distances from the mean"
      actions={
        <Button size="sm" variant="outline" onClick={run} disabled={loading["outliers"]}>
          {loading["outliers"] ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {loading["outliers"] ? "Running…" : "Refresh"}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm">Z-score threshold:</label>
          <input type="range" min={1} max={5} step={0.5} value={threshold} onChange={(e) => setThreshold(+e.target.value)} className="w-32" />
          <span className="text-sm font-mono">±{threshold}</span>
          <Badge variant={flagged.length > 0 ? "destructive" : "secondary"}>
            {flagged.length} flagged
          </Badge>
        </div>

        {errors["outliers"] && <p className="text-xs text-destructive">{errors["outliers"]}</p>}

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Z-scores of Procrustes Distances</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 24, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="id" tick={false} label={{ value: "Specimens", position: "insideBottom", offset: -4, fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: "Z-score", angle: -90, position: "insideLeft", fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v.toFixed(3), "Z-score"]} labelFormatter={(l) => `ID: ${l}`} />
                <ReferenceLine y={threshold} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: `+${threshold}σ`, fontSize: 10 }} />
                <ReferenceLine y={-threshold} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: `-${threshold}σ`, fontSize: 10 }} />
                <Bar dataKey="z" radius={[2, 2, 0, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.idx} fill={Math.abs(d.z) > threshold ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {flagged.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Flagged Specimens</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="text-left pb-2">ID</th><th className="text-right pb-2">Z-score</th><th className="text-right pb-2">Procrustean dist.</th><th className="text-right pb-2">Action</th></tr>
                </thead>
                <tbody>
                  {flagged.map((d) => (
                    <tr key={d.idx} className="border-t">
                      <td className="py-1.5 font-mono text-xs">{d.id}</td>
                      <td className="py-1.5 text-right font-mono text-xs text-destructive">{d.z.toFixed(3)}</td>
                      <td className="py-1.5 text-right font-mono text-xs">{d.d.toExponential(3)}</td>
                      <td className="py-1.5 text-right">
                        <Button size="sm" variant="outline" className="h-6 px-2 text-xs"
                          onClick={() => toggleSpecimen(dataset!.specimens.findIndex((s) => s.id === d.id))}>
                          Exclude
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </PanelLayout>
  );
}
