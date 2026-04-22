import { useState } from "react";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { runPhyloMapping, runIndependentContrasts } from "@/lib/ipc";
import { Play } from "lucide-react";

const EXAMPLE_NEWICK = "((A:1,B:1):1,(C:1,D:1):1);";

export default function Phylogenetics() {
  const aligned = useDatasetStore((s) => s.aligned);
  const dataset = useDatasetStore((s) => s.dataset);
  const { phyloMapping, pic, setPhyloMapping, setPIC, setLoading, setError, loading, errors } = useAnalysisStore();
  const [newick, setNewick] = useState("");

  const included = dataset?.specimens.filter((s) => s.include) ?? [];
  const ids = included.map((s) => s.id);

  const runMapping = async () => {
    if (!aligned || !newick.trim()) return;
    setLoading("phylo", true);
    setError("phylo", null);
    try {
      const res = await runPhyloMapping(aligned, newick.trim(), ids);
      setPhyloMapping(res);
    } catch (e) {
      setError("phylo", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading("phylo", false);
    }
  };

  const runPIC = async () => {
    if (!aligned || !newick.trim()) return;
    setLoading("pic", true);
    setError("pic", null);
    try {
      const res = await runIndependentContrasts(aligned, newick.trim(), ids);
      setPIC(res);
    } catch (e) {
      setError("pic", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading("pic", false);
    }
  };

  if (!aligned) return (
    <PanelLayout title="Phylogenetics">
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Run Procrustes Fit first.</div>
    </PanelLayout>
  );

  return (
    <PanelLayout title="Phylogenetic Comparative Methods" description="Map shape onto a phylogeny · Independent contrasts (Felsenstein 1985)">
      <div className="grid grid-cols-[300px_1fr] gap-4 h-full">
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Newick Tree</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <textarea
                value={newick}
                onChange={(e) => setNewick(e.target.value)}
                placeholder={EXAMPLE_NEWICK}
                className="w-full h-28 text-xs font-mono rounded border bg-muted p-2 resize-none"
              />
              <p className="text-xs text-muted-foreground">Tip labels must match specimen IDs. Branch lengths required for PIC.</p>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setNewick(EXAMPLE_NEWICK)}>
                Load example
              </Button>
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={runMapping} disabled={loading["phylo"] || !newick}>
              <Play size={12} /> Map shapes
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={runPIC} disabled={loading["pic"] || !newick}>
              <Play size={12} /> Contrasts
            </Button>
          </div>
          {(errors["phylo"] || errors["pic"]) && (
            <p className="text-xs text-destructive">{errors["phylo"] || errors["pic"]}</p>
          )}
        </div>

        <Tabs defaultValue="mapping">
          <TabsList>
            <TabsTrigger value="mapping">Shape Mapping</TabsTrigger>
            <TabsTrigger value="pic">Independent Contrasts</TabsTrigger>
          </TabsList>

          <TabsContent value="mapping">
            {!phyloMapping ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Click "Map shapes" to run ancestral reconstruction.</div>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Ancestral Shape Values
                    {phyloMapping.warning && <Badge variant="secondary" className="text-[10px]">ete3 not installed</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-2">Method: {phyloMapping.method}</p>
                  <div className="overflow-auto max-h-72">
                    <table className="w-full text-xs">
                      <thead className="border-b"><tr><th className="text-left p-2">Node/Tip</th><th className="text-right p-2">Mean shape value</th></tr></thead>
                      <tbody>
                        {Object.entries(phyloMapping.node_values).map(([node, vals]) => (
                          <tr key={node} className="border-b hover:bg-muted/30">
                            <td className="p-2 font-mono">{node}</td>
                            <td className="p-2 text-right font-mono">{((vals as number[]).reduce((a, b) => a + b, 0) / (vals as number[]).length).toFixed(5)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="pic">
            {!pic ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Click "Contrasts" to compute independent contrasts.</div>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Phylogenetic Independent Contrasts
                    <Badge variant="secondary">{pic.n_contrasts} contrasts</Badge>
                    {pic.warning && <Badge variant="secondary" className="text-[10px]">{pic.warning}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-72">
                    <table className="w-full text-xs">
                      <thead className="border-b"><tr><th className="text-left p-2">Contrast #</th><th className="text-right p-2">Variance</th><th className="text-right p-2">Mean contrast</th></tr></thead>
                      <tbody>
                        {pic.contrasts.map((c, i) => (
                          <tr key={i} className="border-b hover:bg-muted/30">
                            <td className="p-2">{i + 1}</td>
                            <td className="p-2 text-right font-mono">{c.variance.toFixed(4)}</td>
                            <td className="p-2 text-right font-mono">{((c.contrast as number[]).reduce((a, b) => a + b, 0) / (c.contrast as number[]).length).toFixed(5)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PanelLayout>
  );
}
