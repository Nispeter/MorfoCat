import { useState } from "react";
import { toast } from "sonner";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupScatterPlot } from "@/components/plots/GroupScatterPlot";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { runCVA } from "@/lib/ipc";
import { downloadCSV } from "@/lib/export";
import { Play, Loader2, Download, HelpCircle } from "lucide-react";

export default function CVA() {
  const aligned = useDatasetStore((s) => s.aligned);
  const dataset = useDatasetStore((s) => s.dataset);
  const { cva, setCVA, setLoading, setError, loading, errors } = useAnalysisStore();
  const [permutations, setPermutations] = useState(999);

  const included = dataset?.specimens.filter((s) => s.include) ?? [];
  const groups = included.map((s) => s.group ?? "unassigned");
  const ids = included.map((s) => s.id);
  const hasGroups = included.some((s) => s.group);

  const run = async () => {
    if (!aligned) return;
    setLoading("cva", true);
    setError("cva", null);
    try {
      const res = await runCVA(aligned, groups, permutations);
      setCVA(res);
      toast.success("CVA complete", { description: `p = ${res.p_value < 0.001 ? "< 0.001" : res.p_value.toFixed(3)} · ${res.mahalanobis_distances.length} pairwise distances` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("cva", msg);
      toast.error("CVA failed", { description: msg });
    } finally {
      setLoading("cva", false);
    }
  };

  if (!aligned) return <NeedsProcrustes title="CVA" />;

  return (
    <PanelLayout
      title="Canonical Variate Analysis"
      description="Maximise among-group to within-group variation"
      actions={
        <div className="flex items-center gap-2">
          {cva && (
            <Button size="sm" variant="outline" onClick={() => {
              const headers = ["Group1", "Group2", "MahalanobisDistance"];
              const rows = cva.mahalanobis_distances.map((d) => [d.group1, d.group2, d.distance]);
              downloadCSV("cva_mahalanobis_distances", headers, rows);
              toast.success("Mahalanobis distances exported");
            }}>
              <Download size={14} /> Export CSV
            </Button>
          )}
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <HelpCircle size={13} className="text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-56 text-xs">
                Number of random permutations to assess significance of group separation (Bookstein et al. 1985).
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
          <label className="text-xs text-muted-foreground">Permutations:</label>
          <select className="text-xs border rounded px-2 py-1" value={permutations} onChange={(e) => setPermutations(+e.target.value)}>
            {[99, 499, 999, 4999].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <Button size="sm" onClick={run} disabled={loading["cva"] || !hasGroups}>
            {loading["cva"] ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {loading["cva"] ? "Running…" : "Run CVA"}
          </Button>
        </div>
      }
    >
      {!hasGroups && <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">Assign groups to specimens in Data Manager first.</p>}
      {errors["cva"] && <p className="mb-3 text-sm text-destructive">{errors["cva"]}</p>}

      {!cva ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Run CVA to see results.</div>
      ) : (
        <Tabs defaultValue="scores">
          <TabsList>
            <TabsTrigger value="scores">CV Scores</TabsTrigger>
            <TabsTrigger value="distances">Mahalanobis Distances</TabsTrigger>
            <TabsTrigger value="variance">Variance Explained</TabsTrigger>
          </TabsList>

          <TabsContent value="scores">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  CV Score Plot
                  <Badge variant={cva.p_value < 0.05 ? "default" : "secondary"}>
                    p = {cva.p_value.toFixed(3)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GroupScatterPlot scores={cva.cv_scores} groups={groups} xLabel="CV1" yLabel="CV2" ids={ids} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distances">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Pairwise Mahalanobis Distances</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr><th className="text-left pb-2">Group 1</th><th className="text-left pb-2">Group 2</th><th className="text-right pb-2">Distance</th></tr>
                  </thead>
                  <tbody>
                    {cva.mahalanobis_distances.map((d, i) => (
                      <tr key={i} className="border-b hover:bg-muted/30">
                        <td className="py-1.5">{d.group1}</td>
                        <td className="py-1.5">{d.group2}</td>
                        <td className="py-1.5 text-right font-mono">{d.distance.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="variance">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Eigenvalues & Variance</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr><th className="text-left pb-2">CV</th><th className="text-right pb-2">Eigenvalue</th><th className="text-right pb-2">% Variance</th></tr>
                  </thead>
                  <tbody>
                    {cva.eigenvalues.map((ev, i) => (
                      <tr key={i} className="border-b hover:bg-muted/30">
                        <td className="py-1.5">CV{i + 1}</td>
                        <td className="py-1.5 text-right font-mono">{ev.toFixed(5)}</td>
                        <td className="py-1.5 text-right font-mono">{cva.pct_variance[i]?.toFixed(2)}%</td>
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

function NeedsProcrustes({ title }: { title: string }) {
  return (
    <PanelLayout title={title}>
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Run Procrustes Fit first.</div>
    </PanelLayout>
  );
}
