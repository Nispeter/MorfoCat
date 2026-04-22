import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseTPS, parseNTS, parseMorphologika, writeTPS } from "@/lib/ipc";
import { useDatasetStore, type Specimen } from "@/store/datasetStore";
import { Upload, Download, Trash2, Eye, EyeOff } from "lucide-react";

export default function DataManager() {
  const { dataset, setDataset, toggleSpecimen, clear } = useDatasetStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      const file = acceptedFiles[0];
      const content = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase();

      setLoading(true);
      setError(null);
      try {
        let parsed;
        if (ext === "tps") parsed = await parseTPS(content);
        else if (ext === "nts") parsed = await parseNTS(content);
        else if (ext === "txt" || ext === "dat") parsed = await parseMorphologika(content);
        else throw new Error(`Unsupported format: .${ext}. Use .tps, .nts, or .txt (Morphologika).`);

        const specimens: Specimen[] = parsed.specimens.map((sp, i) => ({
          id: sp.id ?? `specimen_${i + 1}`,
          landmarks: sp.landmarks,
          scale: sp.scale,
          image: sp.image,
          include: true,
        }));

        setDataset({
          specimens,
          n_landmarks: parsed.n_landmarks,
          dimensions: parsed.dimensions,
          filename: file.name,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [setDataset]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/*": [".tps", ".nts", ".txt", ".dat"] },
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
            <Button variant="destructive" size="sm" onClick={clear}>
              <Trash2 size={14} /> Clear
            </Button>
          </>
        )
      }
    >
      {!dataset ? (
        <div className="flex h-full flex-col items-center justify-center gap-4">
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
          {error && <p className="max-w-lg rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
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
                      <SpecimenRow
                        key={i}
                        specimen={sp}
                        onToggle={() => toggleSpecimen(i)}
                      />
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
          </div>
        </div>
      )}
    </PanelLayout>
  );
}

function SpecimenRow({
  specimen,
  onToggle,
}: {
  specimen: Specimen;
  onToggle: () => void;
}) {
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
