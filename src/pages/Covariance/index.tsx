import { useState } from "react";
import { toast } from "sonner";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { computeCovariance } from "@/lib/ipc";
import { downloadCSV } from "@/lib/export";
import { Play, Loader2, Download, HelpCircle } from "lucide-react";

export default function Covariance() {
  const aligned = useDatasetStore((s) => s.aligned);
  const dataset = useDatasetStore((s) => s.dataset);
  const { covariance, setCovariance, setLoading, setError, loading, errors } = useAnalysisStore();
  const [pooled, setPooled] = useState(false);

  const groups = pooled
    ? dataset?.specimens.filter((s) => s.include).map((s) => s.group ?? "unassigned")
    : undefined;

  const run = async () => {
    if (!aligned) return;
    setLoading("covariance", true);
    setError("covariance", null);
    try {
      const res = await computeCovariance(aligned, groups, pooled && !!groups);
      setCovariance(res);
      toast.success("Covariance matrix computed", { description: `${res.n_variables}×${res.n_variables} · ${res.type}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("covariance", msg);
      toast.error("Covariance failed", { description: msg });
    } finally {
      setLoading("covariance", false);
    }
  };

  if (!aligned) {
    return (
      <PanelLayout title="Covariance Matrix">
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Run Procrustes Fit first.</div>
      </PanelLayout>
    );
  }

  const cov = covariance?.covariance;
  const dim = cov?.length ?? 0;
  // Compute colour scale from absolute values
  const flat = cov?.flat() ?? [];
  const maxAbs = Math.max(...flat.map(Math.abs), 1e-10);

  return (
    <PanelLayout
      title="Covariance Matrix"
      description="Variance-covariance matrix of Procrustes shape coordinates"
      actions={
        <>
          {covariance && (
            <Button size="sm" variant="outline" onClick={() => {
              const n = covariance.covariance.length;
              const headers = ["", ...Array.from({ length: n }, (_, i) => `var_${i + 1}`)];
              const rows = covariance.covariance.map((row, i) => [`var_${i + 1}`, ...row]);
              downloadCSV("covariance_matrix", headers, rows);
              toast.success("Covariance matrix exported");
            }}>
              <Download size={14} /> Export CSV
            </Button>
          )}
          <Button size="sm" onClick={run} disabled={loading["covariance"]}>
            {loading["covariance"] ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {loading["covariance"] ? "Computing…" : "Compute"}
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
                <span className="flex items-center gap-1">
                  <Label>Pooled within-group</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle size={12} className="text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-56 text-xs">
                        Removes between-group differences before computing the covariance matrix. Equivalent to the within-group scatter in MANOVA.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <Switch checked={pooled} onCheckedChange={setPooled} />
              </div>
              {pooled && (
                <p className="text-xs text-muted-foreground">Groups are taken from the Group column in Data Manager.</p>
              )}
            </CardContent>
          </Card>
          {errors["covariance"] && <p className="text-xs text-destructive">{errors["covariance"]}</p>}
          {covariance && (
            <Card>
              <CardContent className="pt-4 text-xs space-y-1">
                <p>Type: {covariance.type}</p>
                <p>Variables: {covariance.n_variables}</p>
                <p>Specimens: {covariance.n_specimens}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="overflow-auto">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Heatmap (first 30×30 variables)</CardTitle></CardHeader>
          <CardContent>
            {!cov ? (
              <p className="text-sm text-muted-foreground">Click Compute to generate</p>
            ) : (
              <div className="overflow-auto">
                <table className="border-collapse text-[9px]">
                  <tbody>
                    {cov.slice(0, 30).map((row, i) => (
                      <tr key={i}>
                        {row.slice(0, 30).map((val, j) => {
                          const norm = val / maxAbs;
                          const bg = norm > 0
                            ? `rgba(59,130,246,${Math.min(Math.abs(norm) * 0.9, 0.9)})`
                            : `rgba(239,68,68,${Math.min(Math.abs(norm) * 0.9, 0.9)})`;
                          return (
                            <td key={j} style={{ background: bg, width: 16, height: 16, border: "none" }} title={`[${i},${j}]: ${val.toExponential(2)}`} />
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dim > 30 && <p className="mt-2 text-xs text-muted-foreground">Showing 30×30 of {dim}×{dim}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PanelLayout>
  );
}
