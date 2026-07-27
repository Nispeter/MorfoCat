import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useDatasetStore } from "@/store/datasetStore";
import { Trash2, Spline, X } from "lucide-react";

const W = 520;
const H = 460;
const PAD = 40;

export default function Wireframe() {
  const t = useT();
  const dataset = useDatasetStore((s) => s.dataset);
  const consensus = useDatasetStore((s) => s.consensus);
  const wireframe = useDatasetStore((s) => s.wireframe);
  const addLink = useDatasetStore((s) => s.addLink);
  const removeLink = useDatasetStore((s) => s.removeLink);
  const clearWireframe = useDatasetStore((s) => s.clearWireframe);

  const [selected, setSelected] = useState<number | null>(null);

  // Reference shape: aligned consensus if available, else the first specimen's landmarks
  const shape: number[][] | null = useMemo(() => {
    if (consensus?.length) return consensus;
    const first = dataset?.specimens.find((s) => s.include) ?? dataset?.specimens[0];
    return first?.landmarks ?? null;
  }, [consensus, dataset]);

  if (!dataset) {
    return (
      <PanelLayout title={t("page.wireframe.title")} description={t("page.wireframe.desc")}>
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          Import a dataset in Data Manager first.
        </div>
      </PanelLayout>
    );
  }
  if (!shape) {
    return (
      <PanelLayout title={t("page.wireframe.title")} description={t("page.wireframe.desc")}>
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No landmark coordinates available.
        </div>
      </PanelLayout>
    );
  }

  // Fit transform (y-up → svg y-down)
  const xs = shape.map((p) => p[0]);
  const ys = shape.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((W - PAD * 2) / (maxX - minX || 1), (H - PAD * 2) / (maxY - minY || 1));
  const pts = shape.map((p) => ({
    cx: PAD + (p[0] - minX) * scale,
    cy: H - PAD - (p[1] - minY) * scale,
  }));

  const onLandmarkClick = (i: number) => {
    if (selected === null) {
      setSelected(i);
    } else if (selected === i) {
      setSelected(null);
    } else {
      addLink(selected, i);
      setSelected(null);
    }
  };

  return (
    <PanelLayout
      title={t("page.wireframe.title")}
      description={t("page.wireframe.desc")}
      actions={
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          onClick={() => { clearWireframe(); setSelected(null); }}
          disabled={wireframe.length === 0}
        >
          <Trash2 size={14} /> Clear all
        </Button>
      }
    >
      <div className="grid grid-cols-[1fr_260px] gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Spline size={14} /> Link landmarks
              <span className="text-xs font-normal text-muted-foreground">
                {selected === null ? "Click a landmark to start a link" : `Selected LM ${selected + 1} — click another to connect`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <svg width={W} height={H} className="max-w-full rounded border bg-card">
              {/* Existing links */}
              {wireframe.map(([a, b], i) => {
                const p = pts[a], q = pts[b];
                if (!p || !q) return null;
                return <line key={i} x1={p.cx} y1={p.cy} x2={q.cx} y2={q.cy} stroke="hsl(var(--primary))" strokeWidth={1.5} opacity={0.7} />;
              })}
              {/* Pending link from selected to nothing (just highlight) */}
              {/* Landmarks */}
              {pts.map((p, i) => (
                <g key={i} className="cursor-pointer" onClick={() => onLandmarkClick(i)}>
                  <circle
                    cx={p.cx} cy={p.cy} r={selected === i ? 8 : 6}
                    fill={selected === i ? "hsl(var(--primary))" : "hsl(var(--card))"}
                    stroke="hsl(var(--primary))" strokeWidth={1.5}
                  />
                  <text x={p.cx} y={p.cy} fontSize={9} textAnchor="middle" dominantBaseline="central"
                    fill={selected === i ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))"} className="pointer-events-none select-none">
                    {i + 1}
                  </text>
                </g>
              ))}
            </svg>
            <p className="mt-2 text-xs text-muted-foreground">
              {consensus?.length ? "Showing the Procrustes consensus shape." : "Showing the first specimen (run Procrustes to use the consensus)."}
            </p>
          </CardContent>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              Links <Badge variant="secondary">{wireframe.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-[380px]">
              <div className="space-y-1 px-3 pb-3">
                {wireframe.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">{t("wf.noLinks")}</p>
                ) : (
                  wireframe.map(([a, b], i) => (
                    <div key={i} className="flex items-center gap-2 rounded border px-2 py-1 text-xs">
                      <span className="font-mono">LM {a + 1} – LM {b + 1}</span>
                      <button onClick={() => removeLink(i)} className="ml-auto text-muted-foreground hover:text-destructive" title="Delete link">
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </PanelLayout>
  );
}
