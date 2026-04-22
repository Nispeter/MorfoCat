import { useState } from "react";
import { toast } from "sonner";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { twoBlockPLS } from "@/lib/ipc";
import { Play, Loader2, HelpCircle } from "lucide-react";

export default function TwoBlockPLS() {
  const aligned = useDatasetStore((s) => s.aligned);
  const dataset = useDatasetStore((s) => s.dataset);
  const { pls, setPLS, setLoading, setError, loading, errors } = useAnalysisStore();
  const [permutations, setPermutations] = useState(999);
  const [splitIdx, setSplitIdx] = useState<number | null>(null);

  const n_lm = dataset?.n_landmarks ?? 0;
  const half = Math.floor(n_lm / 2);
  const split = splitIdx ?? half;

  const run = async () => {
    if (!aligned || n_lm < 2) return;
    setLoading("pls", true);
    setError("pls", null);
    try {
      const block1 = aligned.map((sp) => sp.slice(0, split));
      const block2 = aligned.map((sp) => sp.slice(split));
      const res = await twoBlockPLS(block1, block2, permutations);
      setPLS(res);
      toast.success("PLS complete", { description: `RV = ${res.rv_coefficient.toFixed(4)} · p = ${res.p_value_sv1 < 0.001 ? "< 0.001" : res.p_value_sv1.toFixed(3)}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("pls", msg);
      toast.error("PLS failed", { description: msg });
    } finally {
      setLoading("pls", false);
    }
  };

  if (!aligned) return (
    <PanelLayout title="Two-Block PLS">
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Run Procrustes Fit first.</div>
    </PanelLayout>
  );

  const scoresData = pls?.x_scores.map((xs, i) => ({
    x: xs[0] ?? 0, y: pls.y_scores[i]?.[0] ?? 0,
    id: dataset?.specimens.filter((s) => s.include)[i]?.id ?? `sp_${i}`,
  })) ?? [];

  return (
    <PanelLayout
      title="Two-Block Partial Least Squares"
      description="Covariation between two landmark blocks via SVD of the cross-covariance matrix"
      actions={
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Block split at LM:</label>
          <input type="number" min={1} max={n_lm - 1} value={split} onChange={(e) => setSplitIdx(+e.target.value)} className="w-16 text-xs border rounded px-2 py-1" />
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <HelpCircle size={13} className="text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-56 text-xs">
                Number of random permutations to test significance of the first singular value (Rohlf & Corti 2000).
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
          <select className="text-xs border rounded px-2 py-1" value={permutations} onChange={(e) => setPermutations(+e.target.value)}>
            {[99, 499, 999, 4999].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <Button size="sm" onClick={run} disabled={loading["pls"]}>
            {loading["pls"] ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {loading["pls"] ? "Running…" : "Run PLS"}
          </Button>
        </div>
      }
    >
      {errors["pls"] && <p className="mb-3 text-sm text-destructive">{errors["pls"]}</p>}

      {!pls ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Block 1: LM 1–{split} · Block 2: LM {split + 1}–{n_lm}
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <Badge variant="secondary">RV = {pls.rv_coefficient.toFixed(4)}</Badge>
            <Badge variant="secondary">SV1 = {pls.singular_values[0]?.toFixed(4)}</Badge>
            <Badge variant={pls.p_value_sv1 < 0.05 ? "default" : "secondary"}>
              p = {pls.p_value_sv1 < 0.001 ? "< 0.001" : pls.p_value_sv1.toFixed(3)}
            </Badge>
          </div>
          <Tabs defaultValue="scores">
            <TabsList>
              <TabsTrigger value="scores">Block Scores (SV1)</TabsTrigger>
              <TabsTrigger value="sv">Singular Values</TabsTrigger>
            </TabsList>

            <TabsContent value="scores">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Block 1 × Block 2 Scores (first singular axis)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="x" name="Block 1" tick={{ fontSize: 11 }} label={{ value: "Block 1 Score", position: "insideBottom", offset: -4, fontSize: 11 }} />
                      <YAxis dataKey="y" name="Block 2" tick={{ fontSize: 11 }} label={{ value: "Block 2 Score", angle: -90, position: "insideLeft", fontSize: 11 }} />
                      <Tooltip content={({ payload }) => payload?.length ? <div className="rounded border bg-card px-2 py-1 text-xs"><p>{payload[0].payload.id}</p></div> : null} />
                      <Scatter data={scoresData} fill="hsl(var(--primary))" opacity={0.8} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sv">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Singular Values & % Covariance</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b">
                      <tr><th className="text-left p-2">Axis</th><th className="text-right p-2">Singular Value</th><th className="text-right p-2">% Covariance</th></tr>
                    </thead>
                    <tbody>
                      {pls.singular_values.map((sv, i) => (
                        <tr key={i} className="border-b hover:bg-muted/30">
                          <td className="p-2">SV{i + 1}</td>
                          <td className="p-2 text-right font-mono">{sv.toFixed(5)}</td>
                          <td className="p-2 text-right font-mono">{pls.pct_covariance[i]?.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </PanelLayout>
  );
}
