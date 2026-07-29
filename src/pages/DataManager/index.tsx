import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { imageStem, resolveSpecimenId as resolveId } from "@/lib/specimenId";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeTPS, procrustesFit, readTextFile, writeTextFile, listDirImages } from "@/lib/ipc";
import { basename, openTPSForDigitizing } from "@/lib/digitizeSession";
import { NewSessionDialog } from "@/components/NewSessionDialog";
import { useDigitizerStore } from "@/store/digitizerStore";
import { useNavStore } from "@/store/navStore";
import {
  buildProject, parseProject, defaultProjectName, PROJECT_EXTENSION, PROJECT_EXTENSIONS,
} from "@/lib/project";
import { parseTPS, parseNTS, parseMorphologika } from "@/lib/parsers";
import { countMissing, estimateMissingLandmarks, isMissingPoint } from "@/lib/missing";
import { useDatasetStore, type Specimen } from "@/store/datasetStore";
import {
  idFieldValue, guessSeparator, partCount, fieldColour, type IdField,
} from "@/lib/idFields";
import { useAnalysisStore } from "@/store/analysisStore";
import { usePlotStyleStore } from "@/store/plotStyleStore";
import { useRecentFilesStore } from "@/store/recentFilesStore";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Download, Trash2, Eye, EyeOff, Clock, X, Tags, Check, Wand2, Scissors, Sigma, Save, FolderOpen, Images } from "lucide-react";

type T = ReturnType<typeof useT>;

function formatRelTime(ts: number, t: T) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return t("time.justNow");
  if (s < 3600) return t("time.minutes", { n: Math.floor(s / 60) });
  if (s < 86400) return t("time.hours", { n: Math.floor(s / 3600) });
  return t("time.days", { n: Math.floor(s / 86400) });
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

function parseFile(name: string, content: string, t: T) {
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

  throw new Error(t("msg.unknownFormat", { a: ext ?? "unknown" }));
}

export default function DataManager() {
  const t = useT();
  const {
    dataset, setDataset, toggleSpecimen, clear,
    activeClassifier, extractClassifiers, setSpecimenClassifier,
    renameClassifier, deleteClassifier, setActiveClassifier, appendSpecimens,
    subsetLandmarks, averageByClassifier, setAllLandmarks, loadProject,
  } = useDatasetStore();
  const [estimating, setEstimating] = useState(false);
  const clearAnalyses = useAnalysisStore((s) => s.clearAll);
  const { files: recentFiles, addRecentFile, removeRecentFile } = useRecentFilesStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const appendInputRef = useRef<HTMLInputElement>(null);
  // Digitizing starts here, since this is where data enters the app; the
  // digitizer page only ever adds to a session that is already open.
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionImages, setSessionImages] = useState<string[]>([]);
  const navNavigate = useNavStore((s) => s.navigate);
  const setDigitizerSession = useDigitizerStore((s) => s.setSession);
  const setPendingTemplate = useDigitizerStore((s) => s.setPendingTemplate);

  const load = useCallback(
    async (name: string, content: string) => {
      setLoading(true);
      setError(null);
      try {
        const { parsed, format } = parseFile(name, content, t);
        if (parsed.n_landmarks === 0) {
          throw new Error(
            t("msg.templateNotData")
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
        toast.success(t("msg.loaded", { a: name }), {
          description: t("msg.specimensLandmarks", { n: specimens.length, m: parsed.n_landmarks }),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error(t("msg.loadFileFailed"), { description: msg });
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
        const { parsed } = parseFile(name, content, t);
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
          toast.error(t("msg.addSpecimensFailed"), { description: res.error });
          return;
        }
        clearAnalyses();
        toast.success(t("digi.addedSpecimens", { n: res.added }), {
          description: t("msg.fromFile", { a: name }),
        });
      } catch (e) {
        toast.error(t("msg.readFileFailed"), { description: e instanceof Error ? e.message : String(e) });
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
    toast.success(t("msg.exportedThing", { a: t("exp.tps") }));
  };

  // Fill missing landmarks by warping the consensus of the complete specimens
  // onto each incomplete one (thin-plate spline).
  const handleEstimateMissing = useCallback(async () => {
    if (!dataset) return;
    if (dataset.dimensions !== 2) {
      toast.error(t("msg.est2DOnly"), { description: t("msg.est2DOnlyDesc") });
      return;
    }
    const all = dataset.specimens.map((sp) => sp.landmarks);
    const complete = all.filter((sp) => !sp.some(isMissingPoint));
    if (complete.length < 3) {
      toast.error(t("msg.estNeedComplete"), { description: t("msg.estNeedCompleteDesc") });
      return;
    }
    setEstimating(true);
    try {
      const { consensus } = await procrustesFit(complete);
      const res = estimateMissingLandmarks(all, consensus);
      setAllLandmarks(res.landmarks);
      toast.success(t("msg.estimated", { n: res.filled }), {
        description: res.skipped.length
          ? t("msg.estSkipped", { n: res.skipped.length })
          : t("msg.rerunProcrustes"),
      });
    } catch (e) {
      toast.error(t("msg.estFailed"), { description: e instanceof Error ? e.message : String(e) });
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
      filters: [{ name: "MorphoCat project", extensions: [PROJECT_EXTENSION, "json"] }],
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
        plotStyle: usePlotStyleStore.getState().snapshot(),
        digitizer: useDigitizerStore.getState().snapshot(),
      });
      // Indented so the file can be read, diffed and hand-edited.
      await writeTextFile(path, JSON.stringify(project, null, 2));
      toast.success(t("msg.projectSaved"), { description: path });
    } catch (e) {
      toast.error(t("msg.projectSaveFailed"), { description: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const handleOpenProject = useCallback(async () => {
    const picked = await openDialog({
      filters: [{ name: "MorphoCat project", extensions: PROJECT_EXTENSIONS }],
    });
    if (!picked || Array.isArray(picked)) return;
    try {
      const project = parseProject(await readTextFile(picked));
      clearAnalyses();
      loadProject(project);
      if (project.plotStyle) usePlotStyleStore.getState().restore(project.plotStyle);
      // Always called, including with null: otherwise the previous project's
      // session would still be sitting in the digitizer.
      useDigitizerStore.getState().restore(project.digitizer);
      toast.success(t("msg.projectOpened"), {
        description: t("msg.specimensLandmarks", {
          n: project.dataset.specimens.length, m: project.dataset.n_landmarks,
        }),
      });
    } catch (e) {
      toast.error(t("msg.projectOpenFailed"), { description: e instanceof Error ? e.message : String(e) });
    }
  }, [clearAnalyses, loadProject]);

  const handleClear = () => {
    clear();
    clearAnalyses();
    toast.info(t("msg.datasetCleared"));
  };

  // ── Digitizing entry points ─────────────────────────────────────────────────
  const pickImagesToDigitize = useCallback(async () => {
    const result = await openDialog({
      multiple: true,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "tif", "tiff", "bmp"] }],
    });
    if (!result) return;
    setSessionImages(Array.isArray(result) ? result : [result]);
    setSessionOpen(true);
  }, []);

  const pickFolderToDigitize = useCallback(async () => {
    const folder = await openDialog({ directory: true, multiple: false });
    if (!folder || Array.isArray(folder)) return;
    try {
      const found = await listDirImages(folder);
      if (found.length === 0) {
        toast.error(t("imgimp.noneInFolder"), { description: t("imgimp.lookedFor") });
        return;
      }
      setSessionImages(found);
      setSessionOpen(true);
    } catch (e) {
      toast.error(t("imgimp.folderFailed"), { description: e instanceof Error ? e.message : String(e) });
    }
  }, [t]);

  /**
   * Open a TPS to carry on digitizing it — not to analyse it. A file that
   * already has coordinates becomes a session on those; one that only lists
   * images is a template, and the digitizer asks how many landmarks to place.
   * Dropping a file on the zone below is the path for analysis instead.
   */
  const openTPSToDigitize = useCallback(async () => {
    const picked = await openDialog({ filters: [{ name: "TPS files", extensions: ["tps"] }] });
    if (!picked || Array.isArray(picked)) return;
    try {
      const opened = await openTPSForDigitizing(picked as string);
      if (opened.noImageRefs) {
        toast.warning(t("digi.tpsNoImages"), { description: t("digi.tpsNoImagesDesc") });
      } else if (opened.missingImages.length > 0) {
        toast.warning(
          t("digi.tpsMissingImages", { n: opened.missingImages.length }),
          { description: t("digi.tpsSameFolder") }
        );
      }
      if (opened.nLandmarks === 0) {
        setPendingTemplate({ specimens: opened.specimens, dir: opened.dir, filePath: opened.filePath });
      } else {
        setDigitizerSession(
          opened.specimens, opened.nLandmarks, 0, opened.dir, opened.filePath
        );
        toast.success(basename(opened.filePath), {
          description: `${opened.specimens.length} ${t("status.specimens")} · ${opened.nLandmarks} ${t("ui.landmarks")}`,
        });
      }
      navNavigate("digitizer");
    } catch (e) {
      toast.error(t("digi.tpsFailed"), { description: String(e) });
    }
  }, [t, navNavigate, setDigitizerSession, setPendingTemplate]);

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
      <NewSessionDialog
        open={sessionOpen}
        onOpenChange={setSessionOpen}
        initialImages={sessionImages}
        onStarted={() => navNavigate("digitizer")}
      />
      {!dataset ? (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          {/* Start from photographs rather than from an existing landmark file */}
          <div className="w-full max-w-lg space-y-1.5">
            <p className="text-xs font-medium">{t("data.digitize")}</p>
            <div className="flex flex-wrap gap-2">
              <DigitizeButtons
                onImages={pickImagesToDigitize}
                onFolder={pickFolderToDigitize}
                onTPS={openTPSToDigitize}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("data.digitizeHint")}</p>
          </div>

          <div className="flex w-full max-w-lg items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("data.orLoad")}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

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
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatRelTime(rf.timestamp, t)}</span>
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
        <div className="grid h-full grid-cols-[1fr_320px] gap-4">
          {/* Specimen list */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="flex items-center justify-between text-base">
                <span>
                  {t("msg.specimensLandmarks", {
                    n: dataset.specimens.length, m: dataset.n_landmarks,
                  })} · {dataset.dimensions}D
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
                      <th className="px-4 py-2 text-right font-medium">ID</th>
                      <th className="px-4 py-2 text-left font-medium">{t("ui.name")}</th>
                      <th className="px-4 py-2 text-left font-medium">{activeClassifier ?? t("ui.category")}</th>
                      <th className="px-4 py-2 text-left font-medium">{t("ui.scale")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.specimens.map((sp, i) => (
                      <SpecimenRow
                        key={i}
                        number={i + 1}
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
            <CollapsibleCard
              title={<><Images size={13} /> {t("data.digitize")}</>}
              defaultOpen={false}
              contentClassName="space-y-2"
            >
              <DigitizeButtons
                stacked
                onImages={pickImagesToDigitize}
                onFolder={pickFolderToDigitize}
                onTPS={openTPSToDigitize}
              />
              <p className="text-[11px] text-muted-foreground">{t("data.digitizeReplaces")}</p>
            </CollapsibleCard>
            <ClassifiersCard
              names={dataset.classifierNames ?? []}
              active={activeClassifier}
              ids={dataset.specimens.map((s) => s.id)}
              scheme={dataset.idScheme ?? []}
              onExtractMany={extractClassifiers}
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
            <CollapsibleCard title={t("data.summary")} contentClassName="space-y-1 text-sm">
                <Row label={t("data.file")} value={dataset.filename} />
                <Row label={t("ui.specimens")} value={dataset.specimens.length} />
                <Row label={t("status.included")} value={dataset.specimens.filter((s) => s.include).length} />
                <Row label={t("ui.landmarks")} value={dataset.n_landmarks} />
                <Row label={t("data.dimensions")} value={dataset.dimensions} />
            </CollapsibleCard>
            <CollapsibleCard
              title={t("data.nextSteps")}
              defaultOpen={false}
              contentClassName="text-xs text-muted-foreground space-y-1"
            >
                <p>1. Run <strong>Procrustes Fit</strong> to align landmarks</p>
                <p>2. Check <strong>Outlier Detection</strong></p>
                <p>3. Proceed with <strong>PCA</strong> or other analyses</p>
            </CollapsibleCard>
            {recentFiles.length > 0 && (
              <CollapsibleCard
                title={<><Clock size={12} /> {t("data.recent")}</>}
                defaultOpen={false}
                contentClassName="space-y-1"
              >
                  {recentFiles.slice(0, 5).map((rf) => (
                    <button
                      key={rf.name}
                      onClick={() => load(rf.name, rf.content)}
                      className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs hover:bg-muted/50 transition-colors"
                    >
                      <span className="truncate text-foreground/80">{rf.name}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground">{formatRelTime(rf.timestamp, t)}</span>
                    </button>
                  ))}
              </CollapsibleCard>
            )}
          </div>
        </div>
      )}
    </PanelLayout>
  );
}

/** The three ways into a digitizing session, shared by both page states. */
function DigitizeButtons({
  stacked, onImages, onFolder, onTPS,
}: {
  stacked?: boolean;
  onImages: () => void;
  onFolder: () => void;
  onTPS: () => void;
}) {
  const t = useT();
  const cls = stacked ? "w-full justify-start" : "";
  return (
    <>
      <Button variant="outline" size="sm" className={cls} onClick={onImages}>
        <Images size={14} /> {t("action.pickFiles")}
      </Button>
      <Button variant="outline" size="sm" className={cls} onClick={onFolder}>
        <FolderOpen size={14} /> {t("action.pickFolder2")}
      </Button>
      <Button variant="outline" size="sm" className={cls} onClick={onTPS}>
        <FolderOpen size={14} /> {t("action.openTPS")}
      </Button>
    </>
  );
}

function SpecimenRow({
  number, specimen, active, onToggle, onSetClassifier,
}: {
  /** Position in the file — a short handle, since the name can be long. */
  number: number;
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
      <td className="px-4 py-1.5 text-right font-mono text-xs text-muted-foreground">{number}</td>
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
  names, active, ids, scheme, onExtractMany, onActivate, onRename, onDelete,
}: {
  names: string[];
  active: string | null;
  /** Every specimen ID, so the preview can show the real groups. */
  ids: string[];
  scheme: IdField[];
  onExtractMany: (fields: IdField[]) => { added: number } | { error: string };
  onActivate: (name: string | null) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
}) {
  const t = useT();
  // Remount the editor when the stored scheme changes, so it picks the spans up.
  const schemeKey = JSON.stringify(scheme);

  return (
    <CollapsibleCard
      title={<><Tags size={13} /> {t("data.classifiers")}</>}
      contentClassName="space-y-3"
    >
        {/* Existing classifiers */}
        {names.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("data.activeLabel")}
            </p>
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
            <p className="text-[10px] text-muted-foreground">{t("data.nextUse")}</p>
          </div>
        )}

        {/* Cut the ID into named fields */}
        <div className="space-y-2 border-t pt-2">
          <IdSchemeEditor
            key={schemeKey}
            ids={ids}
            scheme={scheme}
            onExtract={onExtractMany}
          />
        </div>

    </CollapsibleCard>
  );
}

/**
 * Carve the specimen ID into named classifiers.
 *
 * No layout is assumed: a field is read either from a span of characters
 * (`26-13MA020230`) or from a delimited part (`ficu_F_031`), and a scheme can
 * hold any number of them under any names. Whatever is not marked is ignored.
 */
function IdSchemeEditor({
  ids, scheme, onExtract,
}: {
  ids: string[];
  /** The fields already in use, so they can be adjusted rather than redrawn. */
  scheme: IdField[];
  onExtract: (fields: IdField[]) => { added: number } | { error: string };
}) {
  const t = useT();
  const [fields, setFields] = useState<Array<IdField & { key: number }>>(
    () => scheme.map((f, i) => ({ ...f, key: i + 1 }))
  );
  const [mode, setMode] = useState<"position" | "separator">(
    () => (scheme[0]?.by === "separator" ? "separator" : "position")
  );
  const [separator, setSeparator] = useState(
    () =>
      (scheme.find((f) => f.by === "separator") as { separator: string } | undefined)?.separator ||
      guessSeparator(ids) ||
      "_"
  );
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const nextKey = useRef(scheme.length + 1);

  const sample = ids[0] ?? "";
  const width = ids.reduce((w, id) => Math.max(w, id.length), 0);
  const parts = partCount(ids, separator);

  /** How many distinct values a field would produce across the sample. */
  const groupCount = (field: IdField) =>
    new Set(ids.map((id) => idFieldValue(id, field)).filter(Boolean)).size;

  const addField = (field: IdField) =>
    setFields((f) => [...f, { ...field, key: nextKey.current++ }]);

  const finishDrag = () => {
    if (!drag) return;
    addField({
      name: "", by: "position",
      first: Math.min(drag.from, drag.to),
      last: Math.max(drag.from, drag.to),
    });
    setDrag(null);
  };

  const inDrag = (pos: number) =>
    drag !== null && pos >= Math.min(drag.from, drag.to) && pos <= Math.max(drag.from, drag.to);
  const fieldAt = (pos: number) =>
    fields.findIndex((f) => f.by === "position" && pos >= f.first && pos <= f.last);
  const partOwner = (index: number) =>
    fields.findIndex((f) => f.by === "separator" && f.separator === separator && f.part === index);
  const partTaken = (index: number) => partOwner(index) >= 0;

  const rename = (i: number, name: string) =>
    setFields((fs) => fs.map((x, j) => (j === i ? { ...x, name } : x)));

  const apply = () => {
    const res = onExtract(fields.map(({ key: _key, ...f }) => f));
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success(`${res.added} ${t("data.classifiers")}`);
  };

  if (ids.length === 0) return null;

  // Nothing to slice: bare numeric IDs carry no code to pull apart.
  if (width < 3) {
    return (
      <p className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
        {t("data.idsTooPlain", { id: sample || "—" })}
      </p>
    );
  }

  return (
    <div className="space-y-2" onPointerUp={finishDrag} onPointerLeave={finishDrag}>
      <div className="flex items-center gap-1">
        <select
          className="h-7 flex-1 rounded border bg-background px-1 text-[11px]"
          value={mode}
          onChange={(e) => setMode(e.target.value as "position" | "separator")}
        >
          <option value="position">{t("data.byPosition")}</option>
          <option value="separator">{t("data.bySeparator")}</option>
        </select>
        {mode === "separator" && (
          <Input
            className="h-7 w-12 text-center font-mono text-xs"
            value={separator}
            onChange={(e) => setSeparator(e.target.value)}
            title={t("data.separator")}
          />
        )}
      </div>

      {mode === "position" ? (
        <>
          <p className="text-[11px] text-muted-foreground">{t("data.dragHint")}</p>
          <div className="flex select-none flex-wrap gap-0.5">
            {Array.from({ length: width }, (_, i) => {
              const pos = i + 1;
              const marked = inDrag(pos);
              const owner = fieldAt(pos);
              const colour = owner >= 0 ? fieldColour(owner) : null;
              return (
                <button
                  key={pos}
                  onPointerDown={() => setDrag({ from: pos, to: pos })}
                  onPointerEnter={() => drag && setDrag((d) => (d ? { ...d, to: pos } : d))}
                  // Each field gets its own colour so neighbouring spans stay
                  // apart at a glance — "MA" next to "3" reads as two fields.
                  style={colour && !marked
                    ? { borderColor: colour, backgroundColor: `${colour}22`, color: colour }
                    : undefined}
                  className={`flex h-8 w-5 shrink-0 flex-col items-center justify-center rounded border text-[11px] leading-none transition-colors ${
                    marked ? "border-primary bg-primary text-primary-foreground" : colour ? "" : "hover:bg-muted"
                  }`}
                >
                  <span className="font-mono">{sample[i] ?? "·"}</span>
                  <span className="mt-0.5 text-[8px] opacity-60">{pos}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : parts > 1 ? (
        <>
          <p className="text-[11px] text-muted-foreground">{t("data.clickPart")}</p>
          <div className="flex select-none flex-wrap items-center gap-0.5">
            {sample.split(separator).map((part, i) => (
              <button
                key={i}
                onClick={() => addField({ name: "", by: "separator", separator, part: i })}
                disabled={partTaken(i)}
                style={partOwner(i) >= 0
                  ? {
                      borderColor: fieldColour(partOwner(i)),
                      backgroundColor: `${fieldColour(partOwner(i))}22`,
                      color: fieldColour(partOwner(i)),
                    }
                  : undefined}
                className={`rounded border px-1.5 py-1 font-mono text-[11px] transition-colors ${
                  partTaken(i) ? "" : "hover:bg-muted"
                }`}
              >
                {part || "∅"}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {t("data.noParts", { s: separator })}
        </p>
      )}

      {/* One row per field */}
      {fields.map((f, i) => (
        <div key={f.key} className="flex items-center gap-1.5">
          <span
            className="h-5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: fieldColour(i) }}
          />
          <Input
            className="h-7 flex-1 text-xs"
            placeholder={t("data.fieldName")}
            autoFocus={i === fields.length - 1 && !f.name}
            value={f.name}
            onChange={(e) => rename(i, e.target.value)}
          />
          <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
            <span className="font-mono text-foreground">{idFieldValue(sample, f) || "∅"}</span>
            {" · "}{groupCount(f)} {t("data.groupsFound")}
          </span>
          <button
            onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))}
            className="shrink-0 px-0.5 text-muted-foreground hover:text-destructive"
            title={t("data.removeField")}
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {fields.length > 0 && (
        <Button size="sm" className="w-full" onClick={apply}>
          {t("data.applyScheme")}
        </Button>
      )}
    </div>
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
      toast.error(t("msg.subsetFailed"), { description: res.error });
      return;
    }
    setSubsetOpen(false);
    toast.success(t("msg.keptLandmarks", { n: res.kept }), { description: t("msg.rerunProcrustes") });
  };

  const applyAverage = () => {
    const res = onAverage(avgBy);
    if ("error" in res) {
      toast.error(t("msg.averageFailed"), { description: res.error });
      return;
    }
    toast.success(t("msg.averaged", { n: res.groups }), { description: t("msg.averagedDesc", { a: avgBy }) });
  };

  return (
    <>
      <CollapsibleCard
        title={<><Wand2 size={13} /> {t("data.transform")}</>}
        contentClassName="space-y-2"
      >
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
      </CollapsibleCard>

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
