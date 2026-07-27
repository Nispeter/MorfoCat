import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupScatterPlot } from "@/components/plots/GroupScatterPlot";
import { ConfusionMatrix } from "@/components/plots/ConfusionMatrix";
import { ChartFrame } from "@/components/plots/ChartFrame";
import { Badge } from "@/components/ui/badge";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { runLDA, runPairwiseDFA } from "@/lib/ipc";
import { downloadCSV } from "@/lib/export";
import { groupsOf, hasGroups } from "@/lib/groups";
import { ClassifierSelect } from "@/components/layout/ClassifierSelect";
import { Play, Loader2, Download } from "lucide-react";

export default function LDA() {
  const aligned = useDatasetStore((s) => s.aligned);
  const dataset = useDatasetStore((s) => s.dataset);
  const { lda, setLDA, setLoading, setError, loading, errors } = useAnalysisStore();
  const t = useT();

  const active = useDatasetStore((s) => s.activeClassifier);
  const included = dataset?.specimens.filter((s) => s.include) ?? [];
  const groups = groupsOf(included, active);
  const ids = included.map((s) => s.id);
  const groupsAvailable = hasGroups(included, active);

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
      title={t("page.lda.title")}
      description={t("page.lda.desc")}
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
          <ClassifierSelect label="Group by:" />
          <Button size="sm" onClick={run} disabled={loading["lda"] || !groupsAvailable}>
            {loading["lda"] ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {loading["lda"] ? t("action.running") : t("action.run") + " LDA"}
          </Button>
        </>
      }
    >
      {!groupsAvailable && <p className="mb-3 text-sm text-amber-600">Assign groups in Data Manager first (extract a classifier from the ID string).</p>}
      {errors["lda"] && <p className="mb-3 text-sm text-destructive">{errors["lda"]}</p>}

      {!lda ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">{t("action.run")} LDA</div>
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
              <TabsTrigger value="pairwise">Pairwise DFA</TabsTrigger>
            </TabsList>

            <TabsContent value="scores">
              <ChartFrame title="LD Score Plot" filename="lda_scores">
                <GroupScatterPlot scores={lda.ld_scores} groups={groups} xLabel="LD1" yLabel="LD2" ids={ids} />
                <div className="mt-3 text-xs text-muted-foreground">
                  Explained variance: {lda.explained_variance_ratio.map((v, i) => `LD${i + 1}: ${(v * 100).toFixed(1)}%`).join(" · ")}
                </div>
              </ChartFrame>
            </TabsContent>

            <TabsContent value="cm">
              <ChartFrame title="Training Confusion Matrix" filename="lda_confusion_matrix">
                <ConfusionMatrix matrix={lda.confusion_matrix} labels={lda.groups} title="Training set" />
              </ChartFrame>
            </TabsContent>

            <TabsContent value="loo">
              <ChartFrame title="Leave-One-Out Cross-Validation" filename="lda_loo_confusion_matrix">
                <ConfusionMatrix matrix={lda.loo_confusion_matrix} labels={lda.groups} title="LOO cross-validation" />
              </ChartFrame>
            </TabsContent>

            <TabsContent value="pairwise">
              <PairwiseDFACard aligned={aligned} groups={groups} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </PanelLayout>
  );
}

/**
 * Every pair of groups compared on its own: how far apart the means are and
 * how well a discriminant function trained without a specimen classifies it.
 */
function PairwiseDFACard({ aligned, groups }: { aligned: number[][][]; groups: string[] }) {
  const { pairwiseDFA, setPairwiseDFA, setLoading, setError, loading, errors } = useAnalysisStore();
  const [permutations, setPermutations] = useState(999);

  const run = async () => {
    setLoading("dfa", true);
    setError("dfa", null);
    try {
      const res = await runPairwiseDFA(aligned, groups, permutations);
      setPairwiseDFA(res);
      toast.success("Pairwise DFA complete", { description: `${res.pairs.length} group pairs compared` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("dfa", msg);
      toast.error("Pairwise DFA failed", { description: msg });
    } finally {
      setLoading("dfa", false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-3 text-sm">
          Pairwise Discriminant Analysis
          <span className="ml-auto flex items-center gap-2">
            {pairwiseDFA && (
              <Button size="sm" variant="outline" className="h-7" onClick={() => {
                downloadCSV(
                  "pairwise_dfa",
                  ["Group1", "Group2", "n1", "n2", "ProcrustesDistance", "p_Procrustes", "MahalanobisDistance", "p_Mahalanobis", "LOO_Accuracy"],
                  pairwiseDFA.pairs.map((p) => [
                    p.group1, p.group2, p.n1, p.n2,
                    p.procrustes_distance, p.p_procrustes,
                    p.mahalanobis_distance, p.p_mahalanobis, p.loo_accuracy,
                  ])
                );
                toast.success("Pairwise DFA exported");
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
            <Button size="sm" className="h-7" onClick={run} disabled={loading["dfa"]}>
              {loading["dfa"] ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {loading["dfa"] ? "Running…" : "Run"}
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {errors["dfa"] && <p className="mb-2 text-xs text-destructive">{errors["dfa"]}</p>}
        {!pairwiseDFA ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Run to compare every pair of groups.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Pair</th>
                <th className="p-2 text-right">n</th>
                <th className="p-2 text-right">Procrustes d</th>
                <th className="p-2 text-right">p</th>
                <th className="p-2 text-right">Mahalanobis d</th>
                <th className="p-2 text-right">p</th>
                <th className="p-2 text-right">Correctly classified</th>
              </tr>
            </thead>
            <tbody>
              {pairwiseDFA.pairs.map((p, i) => (
                <tr key={i} className="border-b hover:bg-muted/30">
                  <td className="p-2">{p.group1} vs {p.group2}</td>
                  <td className="p-2 text-right font-mono">{p.n1}/{p.n2}</td>
                  <td className="p-2 text-right font-mono">{p.procrustes_distance.toFixed(4)}</td>
                  <td className={`p-2 text-right font-mono ${p.p_procrustes < 0.05 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                    {p.p_procrustes < 0.001 ? "< 0.001" : p.p_procrustes.toFixed(3)}
                  </td>
                  <td className="p-2 text-right font-mono">{p.mahalanobis_distance.toFixed(4)}</td>
                  <td className={`p-2 text-right font-mono ${p.p_mahalanobis < 0.05 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                    {p.p_mahalanobis < 0.001 ? "< 0.001" : p.p_mahalanobis.toFixed(3)}
                  </td>
                  <td className="p-2 text-right font-mono">{(p.loo_accuracy * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function NeedsProcrustes({ title }: { title: string }) {
  return (
    <PanelLayout title={title}>
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Run Procrustes Fit first.</div>
    </PanelLayout>
  );
}
