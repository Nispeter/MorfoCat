import { toast } from "sonner";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupScatterPlot } from "@/components/plots/GroupScatterPlot";
import { ConfusionMatrix } from "@/components/plots/ConfusionMatrix";
import { Badge } from "@/components/ui/badge";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { runLDA } from "@/lib/ipc";
import { downloadCSV } from "@/lib/export";
import { Play, Loader2, Download } from "lucide-react";

export default function LDA() {
  const aligned = useDatasetStore((s) => s.aligned);
  const dataset = useDatasetStore((s) => s.dataset);
  const { lda, setLDA, setLoading, setError, loading, errors } = useAnalysisStore();

  const included = dataset?.specimens.filter((s) => s.include) ?? [];
  const groups = included.map((s) => s.group ?? "unassigned");
  const ids = included.map((s) => s.id);
  const hasGroups = included.some((s) => s.group);

  const run = async () => {
    if (!aligned) return;
    setLoading("lda", true);
    setError("lda", null);
    try {
      const res = await runLDA(aligned, groups);
      setLDA(res);
      toast.success("LDA complete", { description: `LOO accuracy: ${(res.loo_accuracy * 100).toFixed(1)}%` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("lda", msg);
      toast.error("LDA failed", { description: msg });
    } finally {
      setLoading("lda", false);
    }
  };

  if (!aligned) return <NeedsProcrustes title="LDA / Cross-Validation" />;

  return (
    <PanelLayout
      title="Linear Discriminant Analysis"
      description="LDA with leave-one-out cross-validation"
      actions={
        <>
          {lda && (
            <Button size="sm" variant="outline" onClick={() => {
              const headers = ["ID", "TrueGroup", ...lda.groups.map((g) => `LOO_pred_${g}`)];
              const rows = ids.map((id, i) => [
                id,
                groups[i],
                ...lda.groups.map((g) => lda.loo_confusion_matrix[lda.groups.indexOf(groups[i])]?.[lda.groups.indexOf(g)] ?? ""),
              ]);
              downloadCSV("lda_loo_predictions", headers, rows);
              toast.success("LDA LOO predictions exported");
            }}>
              <Download size={14} /> Export CSV
            </Button>
          )}
          <Button size="sm" onClick={run} disabled={loading["lda"] || !hasGroups}>
            {loading["lda"] ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {loading["lda"] ? "Running…" : "Run LDA"}
          </Button>
        </>
      }
    >
      {!hasGroups && <p className="mb-3 text-sm text-amber-600">Assign groups in Data Manager first.</p>}
      {errors["lda"] && <p className="mb-3 text-sm text-destructive">{errors["lda"]}</p>}

      {!lda ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Run LDA to see results.</div>
      ) : (
        <>
          <div className="mb-4 flex gap-3">
            <Badge variant="secondary">Groups: {lda.groups.length}</Badge>
            <Badge variant={lda.loo_accuracy > 0.8 ? "default" : "secondary"}>
              LOO Accuracy: {(lda.loo_accuracy * 100).toFixed(1)}%
            </Badge>
          </div>
          <Tabs defaultValue="scores">
            <TabsList>
              <TabsTrigger value="scores">LD Scores</TabsTrigger>
              <TabsTrigger value="cm">Confusion Matrix</TabsTrigger>
              <TabsTrigger value="loo">LOO Confusion Matrix</TabsTrigger>
            </TabsList>

            <TabsContent value="scores">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">LD Score Plot</CardTitle></CardHeader>
                <CardContent>
                  <GroupScatterPlot scores={lda.ld_scores} groups={groups} xLabel="LD1" yLabel="LD2" ids={ids} />
                  <div className="mt-3 text-xs text-muted-foreground">
                    Explained variance: {lda.explained_variance_ratio.map((v, i) => `LD${i + 1}: ${(v * 100).toFixed(1)}%`).join(" · ")}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cm">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Training Confusion Matrix</CardTitle></CardHeader>
                <CardContent>
                  <ConfusionMatrix matrix={lda.confusion_matrix} labels={lda.groups} title="Training set" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="loo">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Leave-One-Out Cross-Validation</CardTitle></CardHeader>
                <CardContent>
                  <ConfusionMatrix matrix={lda.loo_confusion_matrix} labels={lda.groups} title="LOO cross-validation" />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
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
