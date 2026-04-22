import { useState } from "react";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ShapeGrid } from "@/components/plots/ShapeGrid";
import { LandmarkViewer2D } from "@/components/landmark/LandmarkViewer2D";
import { LandmarkViewer3D } from "@/components/landmark/LandmarkViewer3D";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { procrustesFit } from "@/lib/ipc";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Play } from "lucide-react";

export default function ProcrustesFit() {
  const { dataset, setAligned } = useDatasetStore();
  const { setLoading, setError, loading, errors } = useAnalysisStore();
  const aligned = useDatasetStore((s) => s.aligned);
  const consensus = useDatasetStore((s) => s.consensus);
  const procDist = useDatasetStore((s) => s.procrustes_distances);

  const [symmetry, setSymmetry] = useState(false);
  const [selectedSpec, setSelectedSpec] = useState(0);

  const included = dataset?.specimens.filter((s) => s.include) ?? [];
  const is3D = (dataset?.dimensions ?? 2) === 3;

  const run = async () => {
    if (!dataset) return;
    setLoading("procrustes", true);
    setError("procrustes", null);
    try {
      const lms = included.map((s) => s.landmarks);
      const res = await procrustesFit(lms, symmetry);
      setAligned(res.aligned, res.consensus, res.centroid_sizes, res.procrustes_distances);
    } catch (e) {
      setError("procrustes", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading("procrustes", false);
    }
  };

  if (!dataset) return <NoData />;

  const chartData = procDist?.map((d, i) => ({ id: included[i]?.id ?? `sp_${i}`, d: +d.toFixed(5) })) ?? [];

  return (
    <PanelLayout
      title="Procrustes Fit"
      description="Generalized Procrustes Analysis — align all specimens to a common mean shape"
      actions={
        <Button size="sm" onClick={run} disabled={loading["procrustes"]}>
          <Play size={14} /> {loading["procrustes"] ? "Running…" : "Run GPA"}
        </Button>
      }
    >
      <div className="grid grid-cols-[240px_1fr] gap-4 h-full">
        {/* Options */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Options</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sym">Object symmetry</Label>
                <Switch id="sym" checked={symmetry} onCheckedChange={setSymmetry} />
              </div>
              <p className="text-xs text-muted-foreground">{included.length} specimens included</p>
            </CardContent>
          </Card>
          {errors["procrustes"] && (
            <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errors["procrustes"]}
            </p>
          )}
          {aligned && consensus && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Result</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-1">
                <p>Specimens: {aligned.length}</p>
                <p>Landmarks: {consensus.length}</p>
                <p>Mean Procrustean distance: {(procDist!.reduce((a, b) => a + b, 0) / procDist!.length).toExponential(3)}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4 overflow-auto">
          {!aligned ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Run GPA to see results
            </div>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Consensus Shape</CardTitle></CardHeader>
                <CardContent>
                  {is3D ? (
                    <LandmarkViewer3D landmarks={consensus!} showLabels />
                  ) : (
                    <LandmarkViewer2D landmarks={consensus!} showLabels />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex justify-between">
                    Procrustes Distances
                    <select className="text-xs border rounded px-1" value={selectedSpec} onChange={(e) => setSelectedSpec(+e.target.value)}>
                      {included.map((s, i) => <option key={i} value={i}>{s.id}</option>)}
                    </select>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-[1fr_240px] gap-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="id" tick={false} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="d" name="Procr. dist." fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Selected specimen</p>
                    {is3D ? (
                      <LandmarkViewer3D landmarks={aligned[selectedSpec]} consensus={consensus!} showLabels={false} />
                    ) : (
                      <LandmarkViewer2D landmarks={aligned[selectedSpec]} consensus={consensus!} showLabels={false} width={230} height={180} />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Shape Variation (PC1 extremes preview)</CardTitle></CardHeader>
                <CardContent className="flex gap-6">
                  <ShapeGrid consensus={consensus!} />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </PanelLayout>
  );
}

function NoData() {
  return (
    <PanelLayout title="Procrustes Fit">
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Import a dataset in Data Manager first.
      </div>
    </PanelLayout>
  );
}
