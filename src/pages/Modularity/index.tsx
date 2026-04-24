import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { testModularity } from "@/lib/ipc";
import { downloadCSV } from "@/lib/export";
import { Play, Plus, Trash2, Loader2, Download, HelpCircle } from "lucide-react";

export default function Modularity() {
  const aligned = useDatasetStore((s) => s.aligned);
  const dataset = useDatasetStore((s) => s.dataset);
  const { modularity, setModularity, setLoading, setError, loading, errors } = useAnalysisStore();
  const t = useT();
  const [permutations, setPermutations] = useState(999);
  const [modules, setModules] = useState<string[]>(["", ""]);

  const n_lm = dataset?.n_landmarks ?? 0;

  const parseModule = (s: string): number[] =>
    s.split(/[\s,;]+/).map(Number).filter((n) => !isNaN(n) && n >= 1 && n <= n_lm).map((n) => n - 1);

  const run = async () => {
    if (!aligned) return;
    const hypothesis = modules.map(parseModule).filter((m) => m.length > 0);
    if (hypothesis.length < 2) { setError("modularity", "Define at least 2 modules."); return; }
    setLoading("modularity", true);
    setError("modularity", null);
    try {
      const res = await testModularity(aligned, hypothesis, permutations);
      setModularity(res);
      toast.success("Modularity test complete", { description: `RV = ${res.rv_coefficient.toFixed(4)} · p = ${res.p_value_rv < 0.001 ? "< 0.001" : res.p_value_rv.toFixed(3)}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("modularity", msg);
      toast.error("Modularity test failed", { description: msg });
    } finally {
      setLoading("modularity", false);
    }
  };

  if (!aligned) return (
    <PanelLayout title="Modularity">
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Run Procrustes Fit first.</div>
    </PanelLayout>
  );

  const bins = binNullDist(modularity?.null_rv ?? []);

  return (
    <PanelLayout
      title={t("page.modularity.title")}
      description={t("page.modularity.desc")}
      actions={
        <div className="flex items-center gap-2">
          {modularity && (
            <Button size="sm" variant="outline" onClick={() => {
              const headers = ["RV_null"];
              const rows = modularity.null_rv.map((v) => [v]);
              downloadCSV("modularity_null_distribution", headers, rows);
              toast.success("Null distribution exported");
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
                Number of random permutations for testing modularity significance via the RV coefficient null distribution (Adams 2016).
              </TooltipContent>
            </UITooltip>
          </TooltipProvider>
          <select className="text-xs border rounded px-2 py-1" value={permutations} onChange={(e) => setPermutations(+e.target.value)}>
            {[99, 499, 999, 4999].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <Button size="sm" onClick={run} disabled={loading["modularity"]}>
            {loading["modularity"] ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {loading["modularity"] ? t("action.running") : t("action.run")}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-[280px_1fr] gap-4 h-full">
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Define Modules</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Enter landmark numbers (1-indexed, comma or space separated) for each module.</p>
              {modules.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Module {i + 1}</Label>
                    <Input value={m} onChange={(e) => setModules((ms) => ms.map((v, j) => j === i ? e.target.value : v))} placeholder="1 2 3 4" className="text-xs h-8 mt-1" />
                  </div>
                  {modules.length > 2 && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 mt-5" onClick={() => setModules((ms) => ms.filter((_, j) => j !== i))}>
                      <Trash2 size={12} />
                    </Button>
                  )}
                </div>
              ))}
              <Button size="sm" variant="outline" className="w-full" onClick={() => setModules((ms) => [...ms, ""])}>
                <Plus size={12} /> Add Module
              </Button>
              <p className="text-xs text-muted-foreground">Total landmarks: {n_lm}</p>
            </CardContent>
          </Card>
          {errors["modularity"] && <p className="text-xs text-destructive">{errors["modularity"]}</p>}
        </div>

        <div className="space-y-4 overflow-auto">
          {!modularity ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Define modules and click Test.</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <StatBadge label="RV" value={modularity.rv_coefficient.toFixed(4)} p={modularity.p_value_rv} />
                <StatBadge label="CR" value={modularity.cr_statistic.toFixed(4)} p={modularity.p_value_cr} />
                <Badge variant="secondary">{modularity.n_modules} modules · {modularity.permutations} permutations</Badge>
              </div>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Null Distribution (RV coefficient)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={bins} margin={{ top: 4, right: 4, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="bin" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <ReferenceLine x={modularity.rv_coefficient.toFixed(2)} stroke="hsl(var(--destructive))" strokeWidth={2} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" opacity={0.7} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </PanelLayout>
  );
}

function StatBadge({ label, value, p }: { label: string; value: string; p: number }) {
  return (
    <div className="rounded border p-2 text-sm flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
      <Badge variant={p < 0.05 ? "default" : "secondary"} className="text-[10px] h-4">p = {p < 0.001 ? "< 0.001" : p.toFixed(3)}</Badge>
    </div>
  );
}

function binNullDist(values: number[], bins = 30) {
  if (!values.length) return [];
  const min = Math.min(...values), max = Math.max(...values);
  const step = (max - min) / bins || 0.01;
  const counts = Array(bins).fill(0);
  values.forEach((v) => { const idx = Math.min(Math.floor((v - min) / step), bins - 1); counts[idx]++; });
  return counts.map((count, i) => ({ bin: (min + (i + 0.5) * step).toFixed(3), count }));
}
