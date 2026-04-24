import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { runRegression } from "@/lib/ipc";
import { downloadCSV } from "@/lib/export";
import { Play, Loader2, Download } from "lucide-react";

export default function Regression() {
  const aligned = useDatasetStore((s) => s.aligned);
  const dataset = useDatasetStore((s) => s.dataset);
  const centroid_sizes = useDatasetStore((s) => s.centroid_sizes);
  const { regression, setRegression, setLoading, setError, loading, errors } = useAnalysisStore();
  const t = useT();
  const [pooled, setPooled] = useState(false);
  const [useCS, setUseCS] = useState(true);

  const included = dataset?.specimens.filter((s) => s.include) ?? [];
  const groups = pooled ? included.map((s) => s.group ?? "unassigned") : undefined;
  const independent = useCS && centroid_sizes ? centroid_sizes : included.map((_, i) => i);

  const run = async () => {
    if (!aligned) return;
    setLoading("regression", true);
    setError("regression", null);
    try {
      const res = await runRegression(aligned, independent, groups, pooled);
      setRegression(res);
      toast.success("Regression complete", { description: `R² = ${res.r_squared.toFixed(4)}${res.p_value != null ? ` · p = ${res.p_value < 0.001 ? "< 0.001" : res.p_value.toFixed(3)}` : ""}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("regression", msg);
      toast.error("Regression failed", { description: msg });
    } finally {
      setLoading("regression", false);
    }
  };

  if (!aligned) return <NeedsProcrustes title={t("page.regression.title")} />;

  const logCS = centroid_sizes?.map(Math.log) ?? [];
  const regrScores = regression?.regression_scores as number[] | undefined;
  const chartData = regrScores?.map((rs, i) => ({ cs: logCS[i] ?? i, rs, id: included[i]?.id })) ?? [];

  return (
    <PanelLayout
      title={t("page.regression.title")}
      description={t("page.regression.desc")}
      actions={
        <>
          {regression && (
            <Button size="sm" variant="outline" onClick={() => {
              const rscores = regression.regression_scores as number[] | undefined;
              const headers = ["ID", "Predictor", "RegressionScore"];
              const rows = included.map((sp, i) => [sp.id, logCS[i] ?? i, rscores?.[i] ?? ""]);
              downloadCSV("regression_scores", headers, rows);
              toast.success("Regression scores exported");
            }}>
              <Download size={14} /> Export CSV
            </Button>
          )}
          <Button size="sm" onClick={run} disabled={loading["regression"]}>
            {loading["regression"] ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {loading["regression"] ? t("action.running") : t("action.run")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[220px_1fr] gap-4 h-full">
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Options</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Label>Use centroid size</Label>
                <Switch checked={useCS} onCheckedChange={setUseCS} disabled={!centroid_sizes} />
              </div>
              {!centroid_sizes && <p className="text-xs text-muted-foreground">Run Procrustes Fit to get centroid sizes.</p>}
              <div className="flex items-center justify-between gap-2">
                <Label>Pooled within-group</Label>
                <Switch checked={pooled} onCheckedChange={setPooled} />
              </div>
            </CardContent>
          </Card>
          {errors["regression"] && <p className="text-xs text-destructive">{errors["regression"]}</p>}
          {regression && (
            <Card>
              <CardContent className="pt-4 space-y-1 text-sm">
                <StatRow label="R²" value={regression.r_squared.toFixed(4)} />
                {regression.f_statistic != null && <StatRow label="F" value={regression.f_statistic.toFixed(3)} />}
                {regression.p_value != null && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">p-value</span>
                    <Badge variant={regression.p_value < 0.05 ? "default" : "secondary"}>
                      {regression.p_value < 0.001 ? "< 0.001" : regression.p_value.toFixed(3)}
                    </Badge>
                  </div>
                )}
                <StatRow label="Type" value={regression.type} />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4 overflow-auto">
          {!regression ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">{t("action.run")}</div>
          ) : (
            <Tabs defaultValue="plot">
              <TabsList>
                <TabsTrigger value="plot">Regression Plot</TabsTrigger>
                <TabsTrigger value="table">Coefficients</TabsTrigger>
              </TabsList>
              <TabsContent value="plot">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Shape ~ {useCS ? "log(Centroid Size)" : "Predictor"}</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="cs" name={useCS ? "log(CS)" : "Predictor"} tick={{ fontSize: 11 }} label={{ value: useCS ? "log(Centroid Size)" : "Predictor", position: "insideBottom", offset: -4, fontSize: 11 }} />
                        <YAxis dataKey="rs" name="Regression Score" tick={{ fontSize: 11 }} label={{ value: "Regression Score", angle: -90, position: "insideLeft", fontSize: 11 }} />
                        <Tooltip content={({ payload }) => {
                          if (!payload?.length) return null;
                          const d = payload[0].payload;
                          return <div className="rounded border bg-card px-2 py-1 text-xs"><p>{d.id}</p><p>x: {d.cs?.toFixed(4)}</p><p>y: {d.rs?.toFixed(5)}</p></div>;
                        }} />
                        <Scatter data={chartData} fill="hsl(var(--primary))" opacity={0.75} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="table">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Regression Coefficients (intercept + slopes)</CardTitle></CardHeader>
                  <CardContent className="overflow-auto max-h-80">
                    <table className="text-xs w-full">
                      <thead className="border-b"><tr><th className="text-left p-2">Term</th><th className="text-right p-2">Coefficient (mean)</th></tr></thead>
                      <tbody>
                        {regression.coefficients.slice(0, 2).map((row, i) => (
                          <tr key={i} className="border-b hover:bg-muted/30">
                            <td className="p-2">{i === 0 ? "Intercept" : "Slope"}</td>
                            <td className="p-2 text-right font-mono">{(Array.isArray(row) ? (row as number[]).reduce((a, b) => a + b, 0) / (row as number[]).length : row).toFixed(6)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </PanelLayout>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium font-mono">{value}</span></div>
  );
}

function NeedsProcrustes({ title }: { title: string }) {
  return (
    <PanelLayout title={title}>
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Run Procrustes Fit first.</div>
    </PanelLayout>
  );
}
