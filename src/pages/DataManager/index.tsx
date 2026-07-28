import { useCallback, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeTPS, procrustesFit, readTextFile, writeTextFile } from "@/lib/ipc";
import { buildProject, parseProject, defaultProjectName, PROJECT_EXTENSION } from "@/lib/project";
import { parseTPS, parseNTS, parseMorphologika } from "@/lib/parsers";
import { countMissing, estimateMissingLandmarks, isMissingPoint } from "@/lib/missing";
import { useDatasetStore, type Specimen } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { useRecentFilesStore } from "@/store/recentFilesStore";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Download, Trash2, Eye, EyeOff, Clock, X, Tags, Check, Wand2, Scissors, Sigma, Save, FolderOpen } from "lucide-react";

function formatRelTime(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * File name of an image reference, without directories or extension.
 *
 * tpsDig and TpsUtil often write the absolute path the images had on the
 * machine that digitized them, so the folders have to go — otherwise every
 * specimen ID starts with the same `C:\Users\…` prefix and classifiers
 * extracted from the ID are all identical.
 */
function imageStem(image: string): string {
  const base = image.replace(/\\/g, "/").split("/").pop() ?? image;
  return base.replace(/\.[^.]+$/, "");
}

function resolveId(id: string | null | undefined, image: string | null | undefined, fallbackIdx: number): string {
  if (id && !/^\d+$/.test(id.trim())) return id.trim();
  if (image) return imageStem(image);
  if (id) return id.trim();
  return `specimen_${fallbackIdx + 1}`;
}

function detectGroup(image: string | null | undefined): string | undefined {
  if (!image) return undefined;
  const base = imageStem(image).replace(/_[^_]+$/, "");
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
  const t = useT();
  const {
    dataset, setDataset, toggleSpecimen, clear,
    activeClassifier, extractClassifier, setSpecimenClassifier,
    renameClassifier, deleteClassifier, setActiveClassifier, appendSpecimens,
    subsetLandmarks, averageByClassifier, setAllLandmarks, loadProject,
  } = useDatasetStore();
  const [estimating, setEstimating] = useState(false);
  const clearAnalyses = useAnalysisStore((s) => s.clearAll);
  const { files: recentFiles, addRecentFile, removeRecentFile } = useRecentFilesStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const appendInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (name: string, content: string) => {
      setLoading(true);
      setError(null);
      try {
        const { parsed, format } = parseFile(name, content);
        if (parsed.n_landmarks === 0) {
          throw new Error(
            "This file is a digitizing template — it lists images but has no landmark coordinates yet. Open it in the Landmark Digitizer to place them."
          );
        }
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

  const appendFromFile = useCallback(
    async (name: string, content: string) => {
      try {
        const { parsed } = parseFile(name, content);
        const incoming: Specimen[] = parsed.specimens.map((sp, i) => ({
          id: resolveId(sp.id, sp.image, i),
          group: detectGroup(sp.image),
          landmarks: sp.landmarks,
          scale: sp.scale,
          image: sp.image,
          include: true,
        }));
        const res = appendSpecimens(incoming);
        if ("error" in res) {
          toast.error("Could not add specimens", { description: res.error });
          return;
        }
        clearAnalyses();
        toast.success(`Added ${res.added} specimen${res.added !== 1 ? "s" : ""}`, { description: `from ${name}` });
      } catch (e) {
        toast.error("Failed to read file", { description: e instanceof Error ? e.message : String(e) });
      }
    },
    [appendSpecimens, clearAnalyses]
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

  // Fill missing landmarks by warping the consensus of the complete specimens
  // onto each incomplete one (thin-plate spline).
  const handleEstimateMissing = useCallback(async () => {
    if (!dataset) return;
    if (dataset.dimensions !== 2) {
      toast.error("Estimation is 2D only", { description: "3D datasets are not supported yet." });
      return;
    }
    const all = dataset.specimens.map((sp) => sp.landmarks);
    const complete = all.filter((sp) => !sp.some(isMissingPoint));
    if (complete.length < 3) {
      toast.error("Not enough complete specimens", { description: "At least 3 specimens without missing landmarks are required." });
      return;
    }
    setEstimating(true);
    try {
      const { consensus } = await procrustesFit(complete);
      const res = estimateMissingLandmarks(all, consensus);
      setAllLandmarks(res.landmarks);
      toast.success(`Estimated ${res.filled} landmark${res.filled !== 1 ? "s" : ""}`, {
        description: res.skipped.length
          ? `${res.skipped.length} specimen(s) had too few observed landmarks and were left as-is.`
          : "Re-run Procrustes Fit to update the alignment.",
      });
    } catch (e) {
      toast.error("Estimation failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setEstimating(false);
    }
  }, [dataset, setAllLandmarks]);

  // ── Projects ────────────────────────────────────────────────────────────────
  const handleSaveProject = useCallback(async () => {
    const s = useDatasetStore.getState();
    if (!s.dataset) return;
    const path = await saveDialog({
      defaultPath: defaultProjectName(s.dataset.filename),
      filters: [{ name: "MorfoCat project", extensions: [PROJECT_EXTENSION, "json"] }],
    });
    if (!path) return;
    try {
      const project = buildProject({
        dataset: s.dataset,
        activeClassifier: s.activeClassifier,
        wireframe: s.wireframe,
        symPairs: s.symPairs,
        midlineLms: s.midlineLms,
        alignment: s.aligned && s.consensus && s.centroid_sizes && s.procrustes_distances
          ? {
              aligned: s.aligned,
              consensus: s.consensus,
              centroid_sizes: s.centroid_sizes,
              procrustes_distances: s.procrustes_distances,
            }
          : null,
      });
      await writeTextFile(path, JSON.stringify(project));
      toast.success("Project saved", { description: path });
    } catch (e) {
      toast.error("Could not save project", { description: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const handleOpenProject = useCallback(async () => {
    const picked = await openDialog({
      filters: [{ name: "MorfoCat project", extensions: [PROJECT_EXTENSION, "json"] }],
    });
    if (!picked || Array.isArray(picked)) return;
    try {
      const project = parseProject(await readTextFile(picked));
      clearAnalyses();
      loadProject(project);
      toast.success("Project opened", {
        description: `${project.dataset.specimens.length} specimens · ${project.dataset.n_landmarks} landmarks`,
      });
    } catch (e) {
      toast.error("Could not open project", { description: e instanceof Error ? e.message : String(e) });
    }
  }, [clearAnalyses, loadProject]);

  const handleClear = () => {
    clear();
    clearAnalyses();
    toast.info("Dataset cleared");
  };

  return (
    <PanelLayout
      title={t("page.data.title")}
      description={t("page.data.desc")}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={handleOpenProject}>
            <FolderOpen size={14} /> {t("action.openProject")}
          </Button>
          {dataset && (
            <Button variant="outline" size="sm" onClick={handleSaveProject}>
              <Save size={14} /> {t("action.saveProject")}
            </Button>
          )}
          {dataset && (
          <>
            <input
              ref={appendInputRef}
              type="file"
              accept=".tps,.nts,.txt,.dat"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await appendFromFile(file.name, await file.text());
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => appendInputRef.current?.click()}>
              <Upload size={14} /> {t("action.addSpecimens")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download size={14} /> {t("action.exportTPS")}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClear}>
              <Trash2 size={14} /> {t("action.clear")}
            </Button>
          </>
          )}
        </>
      }
    >
      {!dataset ? (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          {/* Recent files */}
          {recentFiles.length > 0 && (
            <div className="w-full max-w-lg">
              <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock size={11} /> {t("data.recentFiles")}
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
                      title={t("data.removeRecent")}
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
              <p className="text-sm font-medium">{t("data.dropHere")}</p>
            ) : (
              <>
                <p className="text-sm font-medium">{t("data.dropFile")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("data.supports")}</p>
              </>
            )}
            {loading && <p className="mt-2 text-xs text-primary">{t("data.parsing")}</p>}
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
                      <th className="px-4 py-2 text-left font-medium">{t("ui.include")}</th>
                      <th className="px-4 py-2 text-left font-medium">ID</th>
                      <th className="px-4 py-2 text-left font-medium">{activeClassifier ?? "Group"}</th>
                      <th className="px-4 py-2 text-left font-medium">{t("ui.scale")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.specimens.map((sp, i) => (
                      <SpecimenRow
                        key={i}
                        specimen={sp}
                        active={activeClassifier}
                        onToggle={() => toggleSpecimen(i)}
                        onSetClassifier={(value) => activeClassifier && setSpecimenClassifier(i, activeClassifier, value)}
                      />
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Summary card */}
          <div className="flex flex-col gap-3">
            <ClassifiersCard
              names={dataset.classifierNames ?? []}
              active={activeClassifier}
              ids={dataset.specimens.map((s) => s.id)}
              onExtract={extractClassifier}
              onActivate={setActiveClassifier}
              onRename={renameClassifier}
              onDelete={deleteClassifier}
            />
            <TransformCard
              nLandmarks={dataset.n_landmarks}
              classifiers={dataset.classifierNames ?? []}
              missing={countMissing(dataset.specimens.map((s) => s.landmarks))}
              estimating={estimating}
              onSubset={subsetLandmarks}
              onAverage={averageByClassifier}
              onEstimateMissing={handleEstimateMissing}
            />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("data.summary")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Row label={t("data.file")} value={dataset.filename} />
                <Row label={t("ui.specimens")} value={dataset.specimens.length} />
                <Row label={t("status.included")} value={dataset.specimens.filter((s) => s.include).length} />
                <Row label={t("ui.landmarks")} value={dataset.n_landmarks} />
                <Row label={t("data.dimensions")} value={dataset.dimensions} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("data.nextSteps")}</CardTitle>
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
                    <Clock size={12} /> {t("data.recent")}
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

function SpecimenRow({
  specimen, active, onToggle, onSetClassifier,
}: {
  specimen: Specimen;
  active: string | null;
  onToggle: () => void;
  onSetClassifier: (value: string) => void;
}) {
  const value = active ? specimen.classifiers?.[active] : specimen.group;
  return (
    <tr className={`border-b transition-colors hover:bg-muted/30 ${!specimen.include ? "opacity-50" : ""}`}>
      <td className="px-4 py-1.5">
        <button onClick={onToggle} className="text-muted-foreground hover:text-foreground">
          {specimen.include ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </td>
      <td className="px-4 py-1.5 font-mono text-xs">{specimen.id}</td>
      <td className="px-4 py-1.5">
        {active ? (
          <input
            className="w-full max-w-[10rem] rounded border bg-transparent px-1.5 py-0.5 text-xs focus:border-primary focus:outline-none"
            value={value ?? ""}
            placeholder="—"
            onChange={(e) => onSetClassifier(e.target.value)}
          />
        ) : specimen.group ? (
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

function ClassifiersCard({
  names, active, ids, onExtract, onActivate, onRename, onDelete,
}: {
  names: string[];
  active: string | null;
  /** Every specimen ID, so the preview can show the real groups. */
  ids: string[];
  onExtract: (name: string, first: number, last: number) => void;
  onActivate: (name: string | null) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [first, setFirst] = useState(1);
  const [last, setLast] = useState(2);

  // Preview the groups this split would actually create across the whole
  // sample — the useful question is "how many groups, and how big", not
  // "what do the first few IDs look like".
  const preview = useMemo(() => {
    const lo = Math.max(0, first - 1);
    const counts = new Map<string, number>();
    let empty = 0;
    for (const id of ids) {
      const value = id.slice(lo, last);
      if (!value) { empty++; continue; }
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return {
      groups: [...counts.entries()].sort((a, b) => b[1] - a[1]),
      empty,
      example: ids[0] ?? "",
      exampleValue: (ids[0] ?? "").slice(lo, last),
    };
  }, [ids, first, last]);

  const submit = () => {
    if (!name.trim()) {
      toast.error(t("data.errNoName"));
      return;
    }
    if (last < first) {
      toast.error(t("data.errRange"));
      return;
    }
    if (preview.groups.length === 0) {
      toast.error(t("data.errAllEmpty"));
      return;
    }
    onExtract(name, first, last);
    toast.success(`${t("data.extractBtn")}: ${name.trim()}`, {
      description: `${preview.groups.length} ${t("data.groupsFound")}`,
    });
    setName("");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Tags size={13} /> {t("data.classifiers")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Existing classifiers */}
        {names.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {names.map((n) => (
              <div
                key={n}
                className={`group flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                  active === n ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
              >
                <button onClick={() => onActivate(n)} className="flex items-center gap-1" title={t("data.setActive")}>
                  {active === n && <Check size={11} />}
                  {n}
                </button>
                <button
                  onClick={() => {
                    const nn = window.prompt(`Rename classifier "${n}" to:`, n);
                    if (nn && nn.trim()) onRename(n, nn.trim());
                  }}
                  className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                  title={t("data.rename")}
                >
                  ✎
                </button>
                <button
                  onClick={() => onDelete(n)}
                  className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  title={t("data.delete")}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Extract from ID */}
        <div className="space-y-2 border-t pt-2">
          <p className="text-xs text-muted-foreground">{t("data.extractFromId")}</p>
          <div className="space-y-1">
            <Label className="text-xs">{t("data.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. site" className="h-8" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">{t("data.firstChar")}</Label>
              <NumberInput min={1} value={first} onChange={setFirst} className="h-8" />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">{t("data.lastChar")}</Label>
              <NumberInput min={1} value={last} onChange={setLast} className="h-8" />
            </div>
          </div>
          {ids.length > 0 && (
            <div className="space-y-1.5 rounded border bg-muted/30 p-2">
              <p className="text-xs text-muted-foreground">
                {t("data.previewLabel")}{" "}
                <span className="font-mono text-foreground">
                  {preview.example.slice(0, 24)}
                  {preview.example.length > 24 ? "…" : ""}
                </span>
                {" → "}
                <span className="font-mono font-medium text-primary">
                  {preview.exampleValue || "∅"}
                </span>
              </p>

              {preview.groups.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {preview.groups.slice(0, 8).map(([value, count]) => (
                    <span key={value} className="rounded-full border bg-background px-1.5 py-0.5 text-[10px]">
                      <span className="font-mono font-medium">{value}</span>
                      <span className="ml-1 text-muted-foreground">{count}</span>
                    </span>
                  ))}
                  {preview.groups.length > 8 && (
                    <span className="px-1 py-0.5 text-[10px] text-muted-foreground">
                      +{preview.groups.length - 8}
                    </span>
                  )}
                </div>
              )}

              <p className="text-[10px] text-muted-foreground">
                {preview.groups.length} {t("data.groupsFound")}
                {preview.empty > 0 && ` · ${preview.empty} ${t("data.idsTooShort")}`}
              </p>

              {preview.groups.length === 1 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">{t("data.warnOneGroup")}</p>
              )}
              {preview.groups.length === ids.length && ids.length > 1 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">{t("data.warnAllUnique")}</p>
              )}
            </div>
          )}
          <Button size="sm" className="w-full" onClick={submit}>{t("data.extractBtn")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Dataset-wide transforms: keep a landmark subset, or collapse to group averages. */
function TransformCard({
  nLandmarks, classifiers, missing, estimating, onSubset, onAverage, onEstimateMissing,
}: {
  nLandmarks: number;
  classifiers: string[];
  missing: number;
  estimating: boolean;
  onSubset: (keep: number[]) => { kept: number } | { error: string };
  onAverage: (name: string) => { groups: number } | { error: string };
  onEstimateMissing: () => void;
}) {
  const t = useT();
  const [subsetOpen, setSubsetOpen] = useState(false);
  const [keep, setKeep] = useState<number[]>([]);
  const [avgBy, setAvgBy] = useState(classifiers[0] ?? "");

  const openSubset = () => {
    setKeep(Array.from({ length: nLandmarks }, (_, i) => i));
    setSubsetOpen(true);
  };

  const applySubset = () => {
    const res = onSubset(keep);
    if ("error" in res) {
      toast.error("Cannot subset landmarks", { description: res.error });
      return;
    }
    setSubsetOpen(false);
    toast.success(`Kept ${res.kept} landmarks`, { description: "Re-run Procrustes Fit to update the alignment." });
  };

  const applyAverage = () => {
    const res = onAverage(avgBy);
    if ("error" in res) {
      toast.error("Cannot average", { description: res.error });
      return;
    }
    toast.success(`Averaged into ${res.groups} specimens`, { description: `One per "${avgBy}" value.` });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Wand2 size={13} /> {t("data.transform")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button size="sm" variant="outline" className="w-full justify-start" onClick={openSubset}>
            <Scissors size={13} /> {t("data.chooseLandmarks")}
          </Button>
          {classifiers.length > 0 && (
            <div className="flex gap-1.5">
              <select
                className="flex-1 rounded border bg-background px-1.5 py-1 text-xs"
                value={avgBy}
                onChange={(e) => setAvgBy(e.target.value)}
              >
                {classifiers.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Button size="sm" variant="outline" className="h-8" onClick={applyAverage} title={t("data.averageHint")}>
                <Sigma size={13} /> {t("data.average")}
              </Button>
            </div>
          )}
          {missing > 0 && (
            <div className="space-y-1 border-t pt-2">
              <p className="text-xs text-muted-foreground">
                {missing} {t("data.missingFound")}
              </p>
              <Button size="sm" variant="outline" className="w-full justify-start" disabled={estimating} onClick={onEstimateMissing}>
                <Wand2 size={13} /> {estimating ? t("action.running") : t("data.estimateMissing")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={subsetOpen} onOpenChange={setSubsetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("data.chooseLmTitle")}</DialogTitle>
            <DialogDescription>
              {t("data.chooseLmDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: nLandmarks }, (_, i) => {
              const on = keep.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => setKeep((k) => (on ? k.filter((x) => x !== i) : [...k, i]))}
                  className={`h-7 w-8 rounded border text-xs transition-colors ${
                    on ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <button className="underline" onClick={() => setKeep(Array.from({ length: nLandmarks }, (_, i) => i))}>{t("ui.selectAll")}</button>
            <button className="underline" onClick={() => setKeep([])}>{t("ui.selectNone")}</button>
            <span className="ml-auto">{keep.length} {t("data.of")} {nLandmarks} {t("data.kept")}</span>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setSubsetOpen(false)}>{t("action.cancel")}</Button>
            <Button size="sm" disabled={keep.length < 3 || keep.length === nLandmarks} onClick={applySubset}>
              {t("ui.apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
