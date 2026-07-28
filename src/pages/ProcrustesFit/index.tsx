import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShapeGrid } from "@/components/plots/ShapeGrid";
import { ChartFrame } from "@/components/plots/ChartFrame";
import { LandmarkViewer2D } from "@/components/landmark/LandmarkViewer2D";
import { LandmarkViewer3D } from "@/components/landmark/LandmarkViewer3D";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { procrustesFit } from "@/lib/ipc";
import { alignPrincipalAxes } from "@/lib/shape";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer } from "recharts";
import { Play, Loader2, HelpCircle, Download } from "lucide-react";
import { downloadCSV } from "@/lib/export";

export default function ProcrustesFit() {
  const { dataset, setAligned } = useDatasetStore();
  const { setLoading, setError, loading, errors } = useAnalysisStore();
  const t = useT();
  const aligned = useDatasetStore((s) => s.aligned);
  const consensus = useDatasetStore((s) => s.consensus);
  const procDist = useDatasetStore((s) => s.procrustes_distances);
  const centroidSizes = useDatasetStore((s) => s.centroid_sizes);
  const wireframe = useDatasetStore((s) => s.wireframe);

  const symPairs = useDatasetStore((s) => s.symPairs);
  const midlineLms = useDatasetStore((s) => s.midlineLms);

  const [symmetry, setSymmetry] = useState(false);
  const [alignPCs, setAlignPCs] = useState(true);
  const [selectedSpec, setSelectedSpec] = useState(0);

  const included = dataset?.specimens.filter((s) => s.include) ?? [];
  const is3D = (dataset?.dimensions ?? 2) === 3;

  const run = async () => {
    if (!dataset) return;
    if (symmetry && symPairs.length === 0) {
      toast.error("Add at least one symmetric landmark pair", {
        description: "Object symmetry needs to know which landmarks mirror each other.",
      });
      return;
    }
    setLoading("procrustes", true);
    setError("procrustes", null);
    try {
      const lms = included.map((s) => s.landmarks);
      const res = await procrustesFit(
        lms,
        symmetry,
        symmetry ? symPairs.map(([a, b]) => [a, b]) : undefined,
        symmetry && midlineLms.length ? midlineLms : undefined
      );
      const { consensus, aligned: alignedCoords } = alignPCs
        ? alignPrincipalAxes(res.consensus, res.aligned)
        : { consensus: res.consensus, aligned: res.aligned };
      setAligned(alignedCoords, consensus, res.centroid_sizes, res.procrustes_distances);
      toast.success("GPA complete", { description: `${included.length} specimens aligned` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("procrustes", msg);
      toast.error("GPA failed", { description: msg });
    } finally {
      setLoading("procrustes", false);
    }
  };

  if (!dataset) return <NoData />;

  const chartData = procDist?.map((d, i) => ({ id: included[i]?.id ?? `sp_${i}`, d: +d.toFixed(5) })) ?? [];

  return (
    <PanelLayout
      title={t("page.procrustes.title")}
      description={t("page.procrustes.desc")}
      actions={
        <>
        {aligned && consensus && (
          <Button size="sm" variant="outline" onClick={() => {
            const dim = aligned[0]?.[0]?.length ?? 2;
            const axes = dim === 3 ? ["x", "y", "z"] : ["x", "y"];
            const headers = [
              "ID", "CentroidSize", "ProcrustesDistance",
              ...aligned[0].flatMap((_, li) => axes.map((a) => `lm${li + 1}_${a}`)),
            ];
            const rows = aligned.map((sp, i) => [
              included[i]?.id ?? `sp_${i + 1}`,
              centroidSizes?.[i] ?? "",
              procDist?.[i] ?? "",
              ...sp.flat(),
            ]);
            downloadCSV("procrustes_aligned", headers, rows);
            toast.success(t("msg.exported"));
          }}>
            <Download size={14} /> {t("action.exportCSV")}
          </Button>
        )}
        <Button size="sm" onClick={run} disabled={loading["procrustes"]}>
          {loading["procrustes"] ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {loading["procrustes"] ? t("action.running") : t("action.run") + " GPA"}
        </Button>
        </>
      }
    >
      <div className="grid grid-cols-[240px_1fr] gap-4 h-full">
        {/* Options */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t("ui.options")}</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  <Label htmlFor="sym">{t("procrustes.symmetry")}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle size={12} className="text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-56 text-xs">
                        {t("proc.symmetryHelp")}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <Switch id="sym" checked={symmetry} onCheckedChange={setSymmetry} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  <Label htmlFor="align-pcs">{t("procrustes.alignPCs")}</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle size={12} className="text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-56 text-xs">
                        {t("proc.alignHelp")}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
                <Switch id="align-pcs" checked={alignPCs} onCheckedChange={setAlignPCs} />
              </div>
              <p className="text-xs text-muted-foreground">{included.length} {t("proc.included")}</p>
            </CardContent>
          </Card>

          {symmetry && <SymmetryCard nLandmarks={dataset.n_landmarks} />}
          {errors["procrustes"] && (
            <p className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errors["procrustes"]}
            </p>
          )}
          {aligned && consensus && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t("ui.result")}</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-1">
                <p>{t("ui.specimens")}: {aligned.length}</p>
                <p>{t("ui.landmarks")}: {consensus.length}</p>
                <p>{t("proc.meanDistance")}: {(procDist!.reduce((a, b) => a + b, 0) / procDist!.length).toExponential(3)}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Results */}
        <div className="space-y-4 overflow-auto">
          {!aligned ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              {t("action.run")} GPA
            </div>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{t("proc.consensusShape")}</CardTitle></CardHeader>
                <CardContent>
                  {is3D ? (
                    <LandmarkViewer3D landmarks={consensus!} showLabels />
                  ) : (
                    <LandmarkViewer2D landmarks={consensus!} showLabels edges={wireframe} />
                  )}
                </CardContent>
              </Card>

              <ChartFrame
                title={t("proc.distances")}
                filename="procrustes_distances"
                controls={
                  <select className="rounded border bg-background px-1 py-0.5 text-xs" value={selectedSpec} onChange={(e) => setSelectedSpec(+e.target.value)}>
                    {included.map((s, i) => <option key={i} value={i}>{s.id}</option>)}
                  </select>
                }
              >
                <div className="grid grid-cols-[1fr_240px] gap-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="id" tick={false} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <RechartTooltip />
                      <Bar dataKey="d" name="Procr. dist." fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">{t("proc.selectedSpecimen")}</p>
                    {is3D ? (
                      <LandmarkViewer3D landmarks={aligned[selectedSpec]} consensus={consensus!} showLabels={false} />
                    ) : (
                      <LandmarkViewer2D landmarks={aligned[selectedSpec]} consensus={consensus!} showLabels={false} width={230} height={180} edges={wireframe} />
                    )}
                  </div>
                </div>
              </ChartFrame>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{t("proc.shapeVariation")}</CardTitle></CardHeader>
                <CardContent className="flex gap-6">
                  <ShapeGrid consensus={consensus!} edges={wireframe} />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </PanelLayout>
  );
}

/**
 * Pick which landmarks mirror each other (and which sit on the midline) so
 * object symmetry knows how to reflect a specimen onto itself.
 */
function SymmetryCard({ nLandmarks }: { nLandmarks: number }) {
  const t = useT();
  const symPairs = useDatasetStore((s) => s.symPairs);
  const midlineLms = useDatasetStore((s) => s.midlineLms);
  const addSymPair = useDatasetStore((s) => s.addSymPair);
  const removeSymPair = useDatasetStore((s) => s.removeSymPair);
  const toggleMidline = useDatasetStore((s) => s.toggleMidline);
  const clearSymmetry = useDatasetStore((s) => s.clearSymmetry);

  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(1);

  const paired = new Set(symPairs.flat());
  const free = Array.from({ length: nLandmarks }, (_, i) => i).filter(
    (i) => !paired.has(i) && !midlineLms.includes(i)
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t("procrustes.symLandmarks")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <p className="text-muted-foreground">
          {t("proc.pairEach")}
        </p>

        <div className="flex items-center gap-1.5">
          <select
            className="flex-1 rounded border bg-background px-1.5 py-1"
            value={left}
            onChange={(e) => setLeft(+e.target.value)}
          >
            {Array.from({ length: nLandmarks }, (_, i) => (
              <option key={i} value={i} disabled={paired.has(i) || midlineLms.includes(i)}>
                {i + 1}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">↔</span>
          <select
            className="flex-1 rounded border bg-background px-1.5 py-1"
            value={right}
            onChange={(e) => setRight(+e.target.value)}
          >
            {Array.from({ length: nLandmarks }, (_, i) => (
              <option key={i} value={i} disabled={paired.has(i) || midlineLms.includes(i)}>
                {i + 1}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            className="h-7 px-2"
            disabled={left === right || paired.has(left) || paired.has(right)}
            onClick={() => {
              addSymPair(left, right);
              const next = free.filter((i) => i !== left && i !== right);
              if (next.length >= 2) { setLeft(next[0]); setRight(next[1]); }
            }}
          >
            Add
          </Button>
        </div>

        {symPairs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {symPairs.map(([a, b], i) => (
              <span key={i} className="flex items-center gap-1 rounded-full border px-2 py-0.5">
                {a + 1} ↔ {b + 1}
                <button
                  onClick={() => removeSymPair(i)}
                  className="text-muted-foreground hover:text-destructive"
                  title={t("proc.removePair")}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="space-y-1 border-t pt-2">
          <p className="text-muted-foreground">{t("procrustes.midline")}</p>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: nLandmarks }, (_, i) => {
              const isMid = midlineLms.includes(i);
              const isPaired = paired.has(i);
              return (
                <button
                  key={i}
                  disabled={isPaired}
                  onClick={() => toggleMidline(i)}
                  className={`h-6 w-6 rounded border transition-colors ${
                    isMid
                      ? "border-primary bg-primary/15 text-primary"
                      : isPaired
                        ? "opacity-30"
                        : "hover:bg-muted"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {(symPairs.length > 0 || midlineLms.length > 0) && (
          <Button size="sm" variant="ghost" className="h-6 w-full text-xs" onClick={clearSymmetry}>
            {t("proc.clearAll")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function NoData() {
  const t = useT();
  return (
    <PanelLayout title={t("page.procrustes.title")}>
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {t("ui.needDataset")}
      </div>
    </PanelLayout>
  );
}
