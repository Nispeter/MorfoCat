import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { writeTPS } from "@/lib/ipc";
import { parseTPS, parseNTS, parseMorphologika } from "@/lib/parsers";
import { useDatasetStore, type Specimen } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { useRecentFilesStore } from "@/store/recentFilesStore";
import { Upload, Download, Trash2, Eye, EyeOff, Clock, X } from "lucide-react";

function formatRelTime(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function resolveId(id: string | null | undefined, image: string | null | undefined, fallbackIdx: number): string {
  if (id && !/^\d+$/.test(id.trim())) return id.trim();
  if (image) return image.replace(/\.[^.]+$/, "");
  if (id) return id.trim();
  return `specimen_${fallbackIdx + 1}`;
}

function detectGroup(image: string | null | undefined): string | undefined {
  if (!image) return undefined;
  const base = image.replace(/\.[^.]+$/, "").replace(/_[^_]+$/, "");
  const m = base.match(/^([A-Za-z]+?)[FM]\d/);
  return m ? m[1].toLowerCase() : undefined;
}

function detectFormat(content: string): "TPS" | "NTS" | "Morphologika" | null {
  // TPS: has a bare "LM=<number>" line (with optional * prefix)
  if (/^\*?LM=\d+/im.test(content)) return "TPS";
  // Morphologika: has [individuals] section header
  if (/^\[individuals\]/im.test(content)) return "Morphologika";
  // NTS: first non-comment line is 4–5 space/comma-separated integers
  const firstDataLine = content.split(/\r?\n/).find((l) => l.trim() && !l.trim().startsWith("'"));
  if (firstDataLine) {
    const parts = firstDataLine.trim().split(/[\s,]+/);
    if (parts.length >= 4 && parts.slice(0, 4).every((p) => /^\d+$/.test(p))) return "NTS";
  }
  return null;
}

function parseFile(name: string, content: string) {
  const ext = name.split(".").pop()?.toLowerCase();

  // Content-based detection first — more reliable than extension alone
  const detected = detectFormat(content);
  if (detected === "TPS") return { parsed: parseTPS(content), format: "TPS" };
  if (detected === "Morphologika") return { parsed: parseMorphologika(content), format: "Morphologika" };
  if (detected === "NTS") return { parsed: parseNTS(content), format: "NTS" };

  // Fallback to extension
  if (ext === "tps") return { parsed: parseTPS(content), format: "TPS" };
  if (ext === "nts") return { parsed: parseNTS(content), format: "NTS" };
  if (ext === "txt" || ext === "dat") return { parsed: parseMorphologika(content), format: "Morphologika" };

  throw new Error(`Cannot detect file format. Expected TPS (LM= lines), NTS, or Morphologika ([individuals] header). Got: .${ext ?? "unknown"}`);
}

export default function DataManager() {
  const { dataset, setDataset, toggleSpecimen, clear } = useDatasetStore();
  const clearAnalyses = useAnalysisStore((s) => s.clearAll);
  const { files: recentFiles, addRecentFile, removeRecentFile } = useRecentFilesStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (name: string, content: string) => {
      setLoading(true);
      setError(null);
      try {
        const { parsed, format } = parseFile(name, content);
        const specimens: Specimen[] = parsed.specimens.map((sp, i) => ({
          id: resolveId(sp.id, sp.image, i),
          group: detectGroup(sp.image),
          landmarks: sp.landmarks,
          scale: sp.scale,
          image: sp.image,
          include: true,
        }));
        clearAnalyses();
        setDataset({ specimens, n_landmarks: parsed.n_landmarks, dimensions: parsed.dimensions, filename: name });
        addRecentFile({ name, format, content });
        toast.success(`Loaded ${name}`, { description: `${specimens.length} specimens · ${parsed.n_landmarks} landmarks` });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error("Failed to load file", { description: msg });
      } finally {
        setLoading(false);
      }
    },
    [setDataset, addRecentFile, clearAnalyses]
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      const file = acceptedFiles[0];
      await load(file.name, await file.text());
    },
    [load]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/*": [".tps", ".nts", ".txt", ".dat"], "application/octet-stream": [".tps", ".nts"] },
    multiple: false,
  });

  const handleExport = async () => {
    if (!dataset) return;
    const lms = dataset.specimens.map((s) => s.landmarks);
    const ids = dataset.specimens.map((s) => s.id);
    const tps = await writeTPS(lms, ids);
    const blob = new Blob([tps], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = dataset.filename.replace(/\.[^.]+$/, "") + "_export.tps";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported TPS file");
  };

  const handleClear = () => {
    clear();
    clearAnalyses();
    toast.info("Dataset cleared");
  };

  return (
    <PanelLayout
      title="Data Manager"
      description="Import TPS, NTS, or Morphologika landmark files"
      actions={
        dataset && (
          <>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download size={14} /> Export TPS
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClear}>
              <Trash2 size={14} /> Clear
            </Button>
          </>
        )
      }
    >
      {!dataset ? (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          {/* Recent files */}
          {recentFiles.length > 0 && (
            <div className="w-full max-w-lg">
              <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock size={11} /> Recent files
              </p>
              <div className="flex flex-col gap-1">
                {recentFiles.map((rf) => (
                  <div key={rf.name} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/50">
                    <button
                      className="flex flex-1 items-center gap-2 text-left"
                      onClick={() => load(rf.name, rf.content)}
                      disabled={loading}
                    >
                      <span className="font-medium truncate">{rf.name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{rf.format}</Badge>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatRelTime(rf.timestamp)}</span>
                    </button>
                    <button
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => removeRecentFile(rf.name)}
                      title="Remove from recents"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`flex h-48 w-full max-w-lg cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload size={32} className="mb-3 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-sm font-medium">Drop the file here…</p>
            ) : (
              <>
                <p className="text-sm font-medium">Drop a landmark file or click to browse</p>
                <p className="mt-1 text-xs text-muted-foreground">Supports .tps · .nts · Morphologika (.txt)</p>
              </>
            )}
            {loading && <p className="mt-2 text-xs text-primary">Parsing…</p>}
          </div>
          {error && (
            <p className="max-w-lg rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="grid h-full grid-cols-[1fr_280px] gap-4">
          {/* Specimen list */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center justify-between text-base">
                <span>
                  {dataset.specimens.length} specimens · {dataset.n_landmarks} landmarks ·{" "}
                  {dataset.dimensions}D
                </span>
                <Badge variant="secondary">{dataset.filename}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b bg-card text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Include</th>
                      <th className="px-4 py-2 text-left font-medium">ID</th>
                      <th className="px-4 py-2 text-left font-medium">Group</th>
                      <th className="px-4 py-2 text-left font-medium">Scale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.specimens.map((sp, i) => (
                      <SpecimenRow key={i} specimen={sp} onToggle={() => toggleSpecimen(i)} />
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Summary card */}
          <div className="flex flex-col gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Dataset Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Row label="File" value={dataset.filename} />
                <Row label="Specimens" value={dataset.specimens.length} />
                <Row label="Included" value={dataset.specimens.filter((s) => s.include).length} />
                <Row label="Landmarks" value={dataset.n_landmarks} />
                <Row label="Dimensions" value={dataset.dimensions} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Next Steps</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p>1. Run <strong>Procrustes Fit</strong> to align landmarks</p>
                <p>2. Check <strong>Outlier Detection</strong></p>
                <p>3. Proceed with <strong>PCA</strong> or other analyses</p>
              </CardContent>
            </Card>
            {recentFiles.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Clock size={12} /> Recent
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {recentFiles.slice(0, 5).map((rf) => (
                    <button
                      key={rf.name}
                      onClick={() => load(rf.name, rf.content)}
                      className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs hover:bg-muted/50 transition-colors"
                    >
                      <span className="truncate text-foreground/80">{rf.name}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground">{formatRelTime(rf.timestamp)}</span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </PanelLayout>
  );
}

function SpecimenRow({ specimen, onToggle }: { specimen: Specimen; onToggle: () => void }) {
  return (
    <tr className={`border-b transition-colors hover:bg-muted/30 ${!specimen.include ? "opacity-50" : ""}`}>
      <td className="px-4 py-1.5">
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground">
          {specimen.include ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </td>
      <td className="px-4 py-1.5 font-mono text-xs">{specimen.id}</td>
      <td className="px-4 py-1.5">
        {specimen.group ? (
          <Badge variant="outline" className="text-xs">{specimen.group}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-1.5 text-xs text-muted-foreground">
        {specimen.scale != null ? specimen.scale.toFixed(4) : "—"}
      </td>
    </tr>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
