import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LandmarkViewer2D } from "@/components/landmark/LandmarkViewer2D";
import { ChartFrame } from "@/components/plots/ChartFrame";
import { DistancePlot } from "@/components/plots/DistancePlot";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { detectOutliers } from "@/lib/ipc";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from "recharts";
import { RefreshCw, Loader2, ArrowLeftRight, Eye, Download } from "lucide-react";
import { downloadCSV } from "@/lib/export";

export default function Outliers() {
  const aligned = useDatasetStore((s) => s.aligned);
  const consensus = useDatasetStore((s) => s.consensus);
  const dataset = useDatasetStore((s) => s.dataset);
  const toggleSpecimen = useDatasetStore((s) => s.toggleSpecimen);
  const swapLandmarks = useDatasetStore((s) => s.swapLandmarks);
  const { outliers, setOutliers, setLoading, setError, loading, errors } = useAnalysisStore();
  const t = useT();
  const [threshold, setThreshold] = useState(3);
  const [metric, setMetric] = useState<"procrustes" | "mahalanobis">("procrustes");
  const [reviewIdx, setReviewIdx] = useState<number | null>(null);
  const nLm = dataset?.n_landmarks ?? 0;
  const [swapA, setSwapA] = useState(0);
  const [swapB, setSwapB] = useState(1);

  const included = dataset?.specimens.filter((s) => s.include) ?? [];

  const run = async () => {
    if (!aligned) return;
    setLoading("outliers", true);
    setError("outliers", null);
    try {
      const res = await detectOutliers(aligned);
      setOutliers(res);
      const nFlagged = res.z_scores.filter((z) => Math.abs(z) > threshold).length;
      toast.success(t("msg.analysisDone", { a: t("nav.outliers") }), {
        description: nFlagged > 0 ? t("msg.nFlagged", { n: nFlagged }) : t("msg.noOutliers"),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("outliers", msg);
      toast.error(t("msg.analysisFailed", { a: t("nav.outliers") }), { description: msg });
    } finally {
      setLoading("outliers", false);
    }
  };

  useEffect(() => { if (aligned && !outliers) run(); }, [aligned]);

  if (!aligned) {
    return (
      <PanelLayout title={t("page.outliers.title")}>
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          {t("ui.needProcrustes")}
        </div>
      </PanelLayout>
    );
  }

  const chartData = outliers?.z_scores.map((z, i) => ({
    id: included[i]?.id ?? `sp_${i}`,
    z: +z.toFixed(3),
    d: +(outliers.procrustes_distances[i]).toFixed(5),
    md: outliers.mahalanobis_distances?.[i] ?? 0,
    idx: i,
  })) ?? [];

  const flagged = chartData.filter((d) => Math.abs(d.z) > threshold);

  const distanceData = chartData.map((d) => ({
    id: d.id,
    idx: d.idx,
    procrustes: outliers?.procrustes_distances[d.idx] ?? 0,
    mahalanobis: d.md,
    flagged: Math.abs(d.z) > threshold,
  }));
  // The z-score cut-off, expressed back in Procrustes distance units, so the
  // stem plot and the z-score chart flag the same specimens.
  const distanceThreshold = metric === "procrustes" && outliers
    ? outliers.mean_distance + threshold * outliers.std_distance
    : undefined;

  return (
    <PanelLayout
      title={t("page.outliers.title")}
      description={t("page.outliers.desc")}
      actions={
        <>
        {outliers && (
          <Button size="sm" variant="outline" onClick={() => {
            downloadCSV(
              "outlier_distances",
              ["ID", "ProcrustesDistance", "Mahalanobis", "ZScore", "Flagged"],
              chartData.map((d) => [d.id, d.d, d.md, d.z, Math.abs(d.z) > threshold ? "yes" : "no"])
            );
            toast.success(t("msg.exported"));
          }}>
            <Download size={14} /> {t("action.exportCSV")}
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={run} disabled={loading["outliers"]}>
          {loading["outliers"] ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {loading["outliers"] ? t("action.running") : t("action.refresh")}
        </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm">{t("out.threshold")}</label>
          <input type="range" min={1} max={5} step={0.5} value={threshold} onChange={(e) => setThreshold(+e.target.value)} className="w-32" />
          <span className="text-sm font-mono">±{threshold}</span>
          <Badge variant={flagged.length > 0 ? "destructive" : "secondary"}>
            {flagged.length} {t("out.flagged")}
          </Badge>
        </div>

        {errors["outliers"] && <p className="text-xs text-destructive">{errors["outliers"]}</p>}

        <ChartFrame
          title={t("out.distanceTitle")}
          filename={`outlier_${metric}_distances`}
          controls={
            <select
              className="rounded border bg-background px-1 py-0.5 text-xs font-normal"
              value={metric}
              onChange={(e) => setMetric(e.target.value as "procrustes" | "mahalanobis")}
            >
              <option value="procrustes">{t("plot.procrustesDist")}</option>
              <option value="mahalanobis">{t("plot.mahalanobisDist")}</option>
            </select>
          }
        >
          <DistancePlot
            data={distanceData}
            metric={metric}
            threshold={distanceThreshold}
            onSelect={setReviewIdx}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t("out.oneLine")}{" "}
            {metric === "mahalanobis" &&
              t("out.mahalanobisNote")}
          </p>
        </ChartFrame>

        <ChartFrame title={t("out.zscoresTitle")} filename="outlier_zscores">
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
        </ChartFrame>

        {flagged.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t("out.flaggedSpecimens")}</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="text-left pb-2">ID</th><th className="text-right pb-2">Z</th><th className="text-right pb-2">{t("out.procDist")}</th><th className="text-right pb-2">Mahalanobis</th><th className="text-right pb-2">{t("ui.action")}</th></tr>
                </thead>
                <tbody>
                  {flagged.map((d) => (
                    <tr key={d.idx} className="border-t">
                      <td className="py-1.5 font-mono text-xs">{d.id}</td>
                      <td className="py-1.5 text-right font-mono text-xs text-destructive">{d.z.toFixed(3)}</td>
                      <td className="py-1.5 text-right font-mono text-xs">{d.d.toExponential(3)}</td>
                      <td className="py-1.5 text-right font-mono text-xs">{d.md.toFixed(3)}</td>
                      <td className="py-1.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" className="h-6 px-2 text-xs"
                            onClick={() => setReviewIdx(d.idx)}>
                            <Eye size={11} /> {t("action.review")}
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 px-2 text-xs"
                            onClick={() => toggleSpecimen(dataset!.specimens.findIndex((s) => s.id === d.id))}>
                            {t("action.exclude")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {reviewIdx !== null && aligned[reviewIdx] && consensus && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{t("out.reviewLandmarks")} · {chartData[reviewIdx]?.id ?? `#${reviewIdx + 1}`}</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setReviewIdx(null)}>{t("ui.close")}</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-[1fr_260px] items-start justify-items-center gap-4">
              <LandmarkViewer2D landmarks={aligned[reviewIdx]} consensus={consensus} showLabels width={420} height={320} />
              <div className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {t("out.swapHint")}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs">{t("out.swapLandmark")}</span>
                  <select className="rounded border px-2 py-1 text-xs" value={swapA} onChange={(e) => setSwapA(+e.target.value)}>
                    {Array.from({ length: nLm }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
                  </select>
                  <span className="text-xs">{t("out.swapWith")}</span>
                  <select className="rounded border px-2 py-1 text-xs" value={swapB} onChange={(e) => setSwapB(+e.target.value)}>
                    {Array.from({ length: nLm }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
                  </select>
                </div>
                <Button
                  size="sm"
                  disabled={swapA === swapB}
                  onClick={() => {
                    swapLandmarks(swapA, swapB);
                    setReviewIdx(null);
                    toast.success(t("msg.swapped", { a: swapA + 1, b: swapB + 1 }), {
                      description: t("msg.rerunProcrustes"),
                    });
                  }}
                >
                  <ArrowLeftRight size={13} /> {t("out.swapBtn")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PanelLayout>
  );
}
