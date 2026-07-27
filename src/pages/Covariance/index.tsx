import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { computeCovariance, compareCovarianceMatrices } from "@/lib/ipc";
import { downloadCSV } from "@/lib/export";
import { groupsOf, hasGroups } from "@/lib/groups";
import { Play, Loader2, Download, HelpCircle } from "lucide-react";

export default function Covariance() {
  const aligned = useDatasetStore((s) => s.aligned);
  const dataset = useDatasetStore((s) => s.dataset);
  const { covariance, setCovariance, setLoading, setError, loading, errors } = useAnalysisStore();
  const t = useT();
  const [pooled, setPooled] = useState(false);

  const active = useDatasetStore((s) => s.activeClassifier);
  const included = dataset?.specimens.filter((s) => s.include) ?? [];
  const allGroups = groupsOf(included, active);
  const groupsAvailable = hasGroups(included, active);
  const groups = pooled ? allGroups : undefined;

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
      <PanelLayout title={t("page.covariance.title")}>
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
      title={t("page.covariance.title")}
      description={t("page.covariance.desc")}
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
            {loading["covariance"] ? t("action.running") : t("action.compute")}
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
                <p className="text-xs text-muted-foreground">
                  Grouped by <strong>{active ?? "group"}</strong> — change it in Data Manager.
                </p>
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

        <Tabs defaultValue="matrix" className="overflow-auto">
          <TabsList>
            <TabsTrigger value="matrix">Matrix</TabsTrigger>
            <TabsTrigger value="compare">Compare groups</TabsTrigger>
          </TabsList>

          <TabsContent value="matrix">
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
          </TabsContent>

          <TabsContent value="compare">
            <CompareGroupsCard aligned={aligned} groups={allGroups} available={groupsAvailable} />
          </TabsContent>
        </Tabs>
      </div>
    </PanelLayout>
  );
}

/**
 * Do two groups share the same covariance structure? Matrix correlation
 * compares the matrices entry by entry; random skewers asks whether they would
 * respond to selection in the same direction.
 */
function CompareGroupsCard({
  aligned, groups, available,
}: {
  aligned: number[][][];
  groups: string[];
  available: boolean;
}) {
  const { covComparison, setCovComparison, setLoading, setError, loading, errors } = useAnalysisStore();
  const [permutations, setPermutations] = useState(999);

  const run = async () => {
    setLoading("covCompare", true);
    setError("covCompare", null);
    try {
      const res = await compareCovarianceMatrices(aligned, groups, permutations);
      setCovComparison(res);
      toast.success("Comparison complete", { description: `${res.pairs.length} group pairs compared` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("covCompare", msg);
      toast.error("Comparison failed", { description: msg });
    } finally {
      setLoading("covCompare", false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-3 text-sm">
          Comparison of Covariance Matrices
          <span className="ml-auto flex items-center gap-2">
            {covComparison && (
              <Button size="sm" variant="outline" className="h-7" onClick={() => {
                downloadCSV(
                  "covariance_comparison",
                  ["Group1", "Group2", "n1", "n2", "r_with_diagonal", "r_without_diagonal", "p_matrix_correlation", "random_skewers", "p_random_skewers"],
                  covComparison.pairs.map((p) => [
                    p.group1, p.group2, p.n1, p.n2,
                    p.r_with_diagonal, p.r_without_diagonal, p.p_matrix_correlation,
                    p.random_skewers, p.p_random_skewers,
                  ])
                );
                toast.success("Comparison exported");
              }}>
                <Download size={12} /> CSV
              </Button>
            )}
            <span className="text-xs font-normal text-muted-foreground">Permutations</span>
            <select
              className="rounded border bg-background px-1 py-0.5 text-xs font-normal"
              value={permutations}
              onChange={(e) => setPermutations(+e.target.value)}
            >
              {[99, 499, 999].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <Button size="sm" className="h-7" onClick={run} disabled={loading["covCompare"] || !available}>
              {loading["covCompare"] ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {loading["covCompare"] ? "Running…" : "Run"}
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!available && (
          <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
            Assign groups in Data Manager first (extract a classifier from the ID string).
          </p>
        )}
        {errors["covCompare"] && <p className="mb-2 text-xs text-destructive">{errors["covCompare"]}</p>}
        {!covComparison ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Run to compare each group's covariance structure.
          </p>
        ) : (
          <>
            <table className="w-full text-xs">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="p-2 text-left">Pair</th>
                  <th className="p-2 text-right">n</th>
                  <th className="p-2 text-right">r (with diag.)</th>
                  <th className="p-2 text-right">r (off-diag.)</th>
                  <th className="p-2 text-right">p</th>
                  <th className="p-2 text-right">Random skewers</th>
                  <th className="p-2 text-right">p</th>
                </tr>
              </thead>
              <tbody>
                {covComparison.pairs.map((p, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="p-2">{p.group1} vs {p.group2}</td>
                    <td className="p-2 text-right font-mono">{p.n1}/{p.n2}</td>
                    <td className="p-2 text-right font-mono">{p.r_with_diagonal.toFixed(3)}</td>
                    <td className="p-2 text-right font-mono">{p.r_without_diagonal.toFixed(3)}</td>
                    <td className="p-2 text-right font-mono">{p.p_matrix_correlation.toFixed(3)}</td>
                    <td className="p-2 text-right font-mono">{p.random_skewers.toFixed(3)}</td>
                    <td className="p-2 text-right font-mono">{p.p_random_skewers.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              A high correlation means the two groups vary in similar ways. A small p-value means
              they are <em>more</em> alike than chance splits of the same specimens would be.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
