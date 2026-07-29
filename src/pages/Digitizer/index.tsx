import { useCallback, useEffect, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useDigitizerStore, type LandmarkPoint, type PendingTemplate } from "@/store/digitizerStore";
import { useNavStore } from "@/store/navStore";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { writeTPS } from "@/lib/parsers";
import { readFileB64, writeTextFile, listDirImages } from "@/lib/ipc";
import { resolveSpecimenId } from "@/lib/specimenId";
import { basename, dirname, openTPSForDigitizing } from "@/lib/digitizeSession";
import {
  ChevronLeft, ChevronRight, Undo2, Trash2, Download, FolderOpen, Images,
  CheckCircle2, Circle, Import, Spline, Ruler, PanelsTopLeft,
} from "lucide-react";

// ── Canvas drawing ────────────────────────────────────────────────────────────

interface Transform { scale: number; ox: number; oy: number }

function drawCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  landmarks: LandmarkPoint[],
  nSemi: number,
  xform: React.MutableRefObject<Transform>,
  showLine: boolean,
  scalePts: { x: number; y: number }[] = []
) {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, width, height);

  if (!img.complete || !img.naturalWidth) return;

  const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight) * 0.96;
  const iw = img.naturalWidth * scale;
  const ih = img.naturalHeight * scale;
  const ox = (width - iw) / 2;
  const oy = (height - ih) / 2;
  xform.current = { scale, ox, oy };

  // Landmarks are stored in TPS coordinates (origin bottom-left, y upwards);
  // the canvas has its origin top-left, so y is flipped on the way out.
  const px = (x: number) => x * scale + ox;
  const py = (y: number) => (img.naturalHeight - y) * scale + oy;

  ctx.drawImage(img, ox, oy, iw, ih);

  // Scale-reference measurement segment (cyan)
  if (scalePts.length > 0) {
    scalePts.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(px(pt.x), py(pt.y), 5, 0, Math.PI * 2);
      ctx.fillStyle = "#06b6d4";
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    if (scalePts.length === 2) {
      const [a, b] = scalePts;
      ctx.beginPath();
      ctx.moveTo(px(a.x), py(a.y));
      ctx.lineTo(px(b.x), py(b.y));
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.stroke();
    }
  }

  // Line through all landmarks in order — green for fixed, amber for semi
  if (showLine && landmarks.length >= 2) {
    for (let j = 1; j < landmarks.length; j++) {
      const prev = landmarks[j - 1];
      const curr = landmarks[j];
      const isSemiSeg = prev.isSemi || curr.isSemi;
      ctx.beginPath();
      ctx.moveTo(px(prev.x), py(prev.y));
      ctx.lineTo(px(curr.x), py(curr.y));
      ctx.strokeStyle = isSemiSeg ? "rgba(245,158,11,0.75)" : "rgba(34,197,94,0.75)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.stroke();
    }
  }

  // Connect semilandmarks with dashed curve
  const semiPts = landmarks.filter((lm) => lm.isSemi);
  if (semiPts.length >= 2) {
    ctx.beginPath();
    semiPts.forEach((lm, j) => {
      const cx = px(lm.x);
      const cy = py(lm.y);
      j === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
    });
    ctx.strokeStyle = "rgba(251,191,36,0.5)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw each landmark
  landmarks.forEach((lm, i) => {
    const cx = px(lm.x);
    const cy = py(lm.y);
    const isSemi = nSemi > 0 && lm.isSemi;

    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = isSemi ? "#f59e0b" : "#22c55e";
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), cx, cy);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

function extMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "tif" || ext === "tiff") return "image/tiff";
  if (ext === "bmp") return "image/bmp";
  return "image/png";
}

export default function Digitizer() {
  const t = useT();
  const {
    specimens, currentIdx, nLandmarks, nSemi, sourceFile, pendingTemplate,
    addLandmark, undoLandmark, clearSpecimen, setScale, navigate, setSession,
    appendSpecimens, setPendingTemplate,
  } = useDigitizerStore();

  const navNavigate = useNavStore((s) => s.navigate);
  const setDataset = useDatasetStore((s) => s.setDataset);
  const dataset = useDatasetStore((s) => s.dataset);
  const clearAnalyses = useAnalysisStore((s) => s.clearAll);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const xformRef = useRef<Transform>({ scale: 1, ox: 0, oy: 0 });
  const scalePtsRef = useRef<{ x: number; y: number }[]>([]);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [showLine, setShowLine] = useState(true);
  const [scaleMode, setScaleMode] = useState(false);
  const [scalePts, setScalePts] = useState<{ x: number; y: number }[]>([]);
  const [scaleDialog, setScaleDialog] = useState<{ pixelDist: number } | null>(null);
  const [scaleLength, setScaleLength] = useState("");
  const [scaleUnit, setScaleUnit] = useState("mm");
  const [templateLandmarks, setTemplateLandmarks] = useState(10);
  const [templateSemi, setTemplateSemi] = useState(0);

  // Keep a ref in sync so the resize/image-load redraws show the measurement too
  scalePtsRef.current = scalePts;

  const current = specimens[currentIdx];
  const isComplete = current ? current.landmarks.length >= nLandmarks : false;
  const allComplete = specimens.length > 0 && specimens.every((sp) => sp.landmarks.length >= nLandmarks);
  const nFixed = nLandmarks - nSemi;
  const placedFixed = current?.landmarks.filter((lm) => !lm.isSemi).length ?? 0;
  const placedSemi  = current?.landmarks.filter((lm) =>  lm.isSemi).length ?? 0;

  // Resize canvas to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      if (imgRef.current) drawCanvas(canvas, imgRef.current, current?.landmarks ?? [], nSemi, xformRef, showLine, scalePtsRef.current);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [current?.landmarks, nLandmarks, nSemi, showLine]);

  // Load image when specimen changes
  useEffect(() => {
    if (!current?.imagePath) {
      setImageDataUrl(null);
      imgRef.current = null;
      return;
    }
    setLoadingImage(true);
    readFileB64(current.imagePath)
      .then((b64) => {
        const dataUrl = `data:${extMime(current.imagePath)};base64,${b64}`;
        setImageDataUrl(dataUrl);
      })
      .catch((e) => {
        toast.error(t("digi.imageLoadFailed"), { description: String(e) });
        setImageDataUrl(null);
      })
      .finally(() => setLoadingImage(false));
  }, [current?.imagePath]);

  // Draw canvas when image or landmarks change
  useEffect(() => {
    if (!imageDataUrl) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) drawCanvas(canvas, img, current?.landmarks ?? [], nSemi, xformRef, showLine, scalePtsRef.current);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl, showLine]);

  // Redraw on landmark or scale-measurement change (image already loaded)
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    drawCanvas(canvas, img, current?.landmarks ?? [], nSemi, xformRef, showLine, scalePts);
  }, [current?.landmarks, nLandmarks, nSemi, showLine, scalePts]);

  // Reset any in-progress measurement when leaving scale mode or switching specimen
  useEffect(() => { setScalePts([]); }, [currentIdx]);
  useEffect(() => { if (!scaleMode) setScalePts([]); }, [scaleMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undoLandmark(); }
      if (e.key === "ArrowRight") navigate(currentIdx + 1);
      if (e.key === "ArrowLeft") navigate(currentIdx - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentIdx, navigate, undoLandmark]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!current) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const { scale, ox, oy } = xformRef.current;
    const img = imgRef.current;
    const imgX = (px - ox) / scale;
    const canvasY = (py - oy) / scale;
    if (!img || imgX < 0 || imgX > img.naturalWidth || canvasY < 0 || canvasY > img.naturalHeight) return;
    // Store in TPS coordinates (y upwards), the convention the rest of the app uses.
    const imgY = img.naturalHeight - canvasY;

    // Scale-measurement mode: collect two reference points, then ask for real length
    if (scaleMode) {
      const next = [...scalePts, { x: imgX, y: imgY }];
      if (next.length >= 2) {
        const [a, b] = next;
        const pixelDist = Math.hypot(b.x - a.x, b.y - a.y);
        setScalePts([a, b]);
        setScaleDialog({ pixelDist });
      } else {
        setScalePts(next);
      }
      return;
    }

    if (isComplete) return;
    const pFixed = current.landmarks.filter((lm) => !lm.isSemi).length;
    const pSemi  = current.landmarks.filter((lm) =>  lm.isSemi).length;
    const canFixed = pFixed < nFixed;
    const canSemi  = nSemi > 0 && pSemi < nSemi;
    // Shift = prefer semi; fall back to fixed if semi quota full (and vice versa)
    const isSemi = e.shiftKey ? (canSemi ? true : false) : (canFixed ? false : canSemi);
    if (!canFixed && !canSemi) return;
    addLandmark(imgX, imgY, isSemi);
  }, [current, isComplete, nFixed, nSemi, addLandmark, scaleMode, scalePts]);

  // Confirm the scale dialog: compute units-per-pixel and store it
  const confirmScale = useCallback(() => {
    if (!scaleDialog) return;
    const len = parseFloat(scaleLength);
    if (!isFinite(len) || len <= 0) {
      toast.error(t("digi.needLength"));
      return;
    }
    const scale = len / scaleDialog.pixelDist; // real units per pixel
    setScale(scale, scaleUnit.trim() || "unit");
    toast.success(t("digi.scaleSet"), {
      description: `${scale.toPrecision(4)} ${scaleUnit.trim() || "unit"}/px`,
    });
    setScaleDialog(null);
    setScaleLength("");
    setScalePts([]);
    setScaleMode(false);
  }, [scaleDialog, scaleLength, scaleUnit, setScale]);

  // ── Add more specimens to the session already open ──────────────────────────
  // Starting a session is the Data Manager's job; from here on the digitizer
  // only ever grows the one in progress.
  const reportAdded = useCallback((added: number) => {
    if (added === 0) toast.info(t("digi.nothingNew"));
    else toast.success(t("digi.addedSpecimens", { n: added }));
  }, [t]);

  const addImagePaths = useCallback((paths: string[]) => {
    const { added } = appendSpecimens(
      paths.map((p, i) => ({
        id: String(specimens.length + i + 1),
        imagePath: p,
        imageBase: basename(p),
        landmarks: [],
      }))
    );
    reportAdded(added);
  }, [appendSpecimens, specimens.length, reportAdded]);

  const handleAddImages = useCallback(async () => {
    const result = await open({
      multiple: true,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "tif", "tiff", "bmp"] }],
    });
    if (!result) return;
    addImagePaths(Array.isArray(result) ? result : [result]);
  }, [addImagePaths]);

  const handleAddFolder = useCallback(async () => {
    const folder = await open({ directory: true, multiple: false });
    if (!folder || Array.isArray(folder)) return;
    try {
      const found = await listDirImages(folder);
      if (found.length === 0) {
        toast.error(t("imgimp.noneInFolder"), { description: t("imgimp.lookedFor") });
        return;
      }
      addImagePaths(found);
    } catch (e) {
      toast.error(t("imgimp.folderFailed"), { description: e instanceof Error ? e.message : String(e) });
    }
  }, [addImagePaths, t]);

  const handleAddFromTPS = useCallback(async () => {
    const result = await open({ filters: [{ name: "TPS files", extensions: ["tps"] }] });
    if (!result || Array.isArray(result)) return;
    try {
      const opened = await openTPSForDigitizing(result as string);
      // Merging a file digitized at a different landmark count would leave the
      // session with specimens that can never be completed.
      if (opened.nLandmarks > 0 && opened.nLandmarks !== nLandmarks) {
        toast.error(t("digi.countMismatch", { a: opened.nLandmarks, b: nLandmarks }));
        return;
      }
      if (opened.missingImages.length > 0) {
        toast.warning(
          t("digi.tpsMissingImages", { n: opened.missingImages.length }),
          { description: t("digi.tpsSameFolder") }
        );
      }
      reportAdded(appendSpecimens(opened.specimens).added);
    } catch (e) {
      toast.error(t("digi.tpsFailed"), { description: String(e) });
    }
  }, [appendSpecimens, nLandmarks, reportAdded, t]);

  /**
   * Rebuild a session from the dataset currently loaded.
   *
   * Projects saved before the session was part of the file come back with the
   * dataset but nothing to digitize on; this puts the images back under the
   * landmarks. `imageDir` is only ever set by the hand-off at the bottom of
   * this page, which multiplies every coordinate by the specimen's scale, so
   * that multiplication is undone here to get back to image pixels.
   */
  const rebuildFromDataset = useCallback(() => {
    if (!dataset?.imageDir) return;
    const dir = dataset.imageDir;
    setSession(
      dataset.specimens.map((sp) => {
        const k = sp.scale ?? 0;
        const toPx = (v: number) => (k > 0 ? v / k : v);
        return {
          id: sp.id,
          imagePath: sp.image ? `${dir}/${sp.image}` : "",
          imageBase: sp.image ?? "",
          scale: sp.scale ?? undefined,
          landmarks: sp.landmarks.map((pt) => ({ x: toPx(pt[0]), y: toPx(pt[1]), isSemi: false })),
        };
      }),
      dataset.n_landmarks, 0, dir, dataset.filename
    );
    toast.success(t("digi.rebuilt"), {
      description: `${dataset.specimens.length} ${t("status.specimens")} · ${dataset.n_landmarks} ${t("ui.landmarks")}`,
    });
  }, [dataset, setSession, t]);

  // A template opened in the Data Manager lands here with no landmark count;
  // the dialog asks for one, and then the session can start.
  const startPendingTemplate = useCallback(() => {
    if (!pendingTemplate) return;
    setSession(
      pendingTemplate.specimens, templateLandmarks, templateSemi,
      pendingTemplate.dir, pendingTemplate.filePath
    );
    toast.success(basename(pendingTemplate.filePath), {
      description: `${pendingTemplate.specimens.length} ${t("status.specimens")} · ${templateLandmarks} ${t("ui.landmarks")}`,
    });
    setPendingTemplate(null);
  }, [pendingTemplate, templateLandmarks, templateSemi, setSession, setPendingTemplate, t]);

  // ── Export TPS ──────────────────────────────────────────────────────────────
  const handleExportTPS = useCallback(async () => {
    const savePath = await save({
      defaultPath: sourceFile ? basename(sourceFile).replace(/\.tps$/i, "_digitized.tps") : "landmarks_digitized.tps",
      filters: [{ name: "TPS", extensions: ["tps"] }],
    });
    if (!savePath) return;
    try {
      const tpsSpecimens = specimens.map((sp) => ({
        id: sp.id,
        image: sp.imageBase || undefined,
        scale: sp.scale ?? undefined,
        landmarks: sp.landmarks.map((lm) => [lm.x, lm.y]),
        semiLandmarkIndices: nSemi > 0
          ? sp.landmarks.map((lm, i) => lm.isSemi ? i : -1).filter((i) => i >= 0)
          : undefined,
      }));
      const content = writeTPS(tpsSpecimens);
      await writeTextFile(savePath, content);
      toast.success(t("msg.exportedThing", { a: t("exp.tps") }), { description: savePath });
    } catch (e) {
      toast.error(t("msg.exportFailed"), { description: String(e) });
    }
  }, [specimens, nSemi, sourceFile]);

  // ── Load into DataManager ───────────────────────────────────────────────────
  const handleLoadAsDataset = useCallback(() => {
    if (!allComplete) {
      toast.error(t("digi.notAllDone"));
      return;
    }
    clearAnalyses();
    setDataset({
      specimens: specimens.map((sp, i) => {
        // Apply metric scale (units per pixel) to coordinates when available,
        // so centroid size and allometry are in real units.
        const k = sp.scale ?? 1;
        return {
          // A session started from Image Import numbers its specimens 1, 2, 3;
          // the file name is the informative label, and the one classifiers
          // get carved out of.
          id: resolveSpecimenId(sp.id, sp.imageBase, i),
          landmarks: sp.landmarks.map((lm) => [lm.x * k, lm.y * k]),
          scale: sp.scale ?? null,
          image: sp.imageBase || null,
          include: true,
        };
      }),
      n_landmarks: nLandmarks,
      dimensions: 2,
      filename: sourceFile ? basename(sourceFile) : "digitized.tps",
      // Carried over so PCA figures can show the specimen photos.
      imageDir: specimens[0]?.imagePath ? dirname(specimens[0].imagePath) : null,
    });
    toast.success(t("digi.loadedAsDataset"));
    navNavigate("data");
  }, [allComplete, specimens, nLandmarks, sourceFile, setDataset, clearAnalyses, navNavigate]);

  // ── Empty state ─────────────────────────────────────────────────────────────
  // No session, and no way to start one here: images and TPS files come in
  // through the Data Manager. The pending-template dialog still renders, since
  // that is how a template opened over there finishes setting itself up.
  if (specimens.length === 0) {
    return (
      <PanelLayout
        title={t("page.digitizer.title")}
        description={t("page.digitizer.desc")}
      >
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <Images size={36} className="text-muted-foreground" />
          <p className="text-sm font-medium">{t("digi.noSession")}</p>
          <p className="max-w-sm text-xs text-muted-foreground">{t("digi.noSessionDesc")}</p>
          <Button size="sm" onClick={() => navNavigate("data")}>
            <PanelsTopLeft size={14} /> {t("digi.goToData")}
          </Button>
          {/* A project saved before sessions were stored still knows where its
              images are, which is enough to carry on digitizing it. */}
          {dataset?.imageDir && dataset.specimens.some((sp) => sp.image) && (
            <div className="mt-2 flex max-w-sm flex-col items-center gap-1.5 border-t pt-3">
              <Button variant="outline" size="sm" onClick={rebuildFromDataset}>
                <Images size={14} /> {t("digi.rebuild")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("digi.rebuildHint")}</p>
            </div>
          )}
        </div>
        <TemplateDialog
          template={pendingTemplate}
          nLandmarks={templateLandmarks}
          nSemi={templateSemi}
          onNLandmarks={setTemplateLandmarks}
          onNSemi={setTemplateSemi}
          onCancel={() => setPendingTemplate(null)}
          onStart={startPendingTemplate}
        />
      </PanelLayout>
    );
  }

  // ── Main digitizer UI ───────────────────────────────────────────────────────
  const placed = current?.landmarks.length ?? 0;
  const total = nLandmarks;
  const pct = total > 0 ? Math.round((placed / total) * 100) : 0;

  return (
    <PanelLayout
      title={t("page.digitizer.title")}
      description={`${specimens.length} specimens · ${nLandmarks} landmarks${nSemi > 0 ? ` (${nSemi} semi)` : ""}`}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={handleExportTPS} disabled={specimens.every((sp) => sp.landmarks.length === 0)}>
            <Download size={14} /> {t("action.exportTPS")}
          </Button>
          {allComplete && (
            <Button size="sm" onClick={handleLoadAsDataset}>
              <Import size={14} /> {t("action.loadDataset")}
            </Button>
          )}
        </>
      }
    >
      <div className="flex h-full gap-3">
        {/* Canvas area */}
        <div className="flex flex-1 flex-col gap-2 overflow-hidden">
          {/* Specimen navigation */}
          <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => navigate(currentIdx - 1)} disabled={currentIdx === 0}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="flex-1 text-center font-medium">
              {currentIdx + 1} / {specimens.length}
              {current?.imageBase && (
                <span className="ml-2 font-normal text-muted-foreground">· {current.imageBase}</span>
              )}
            </span>
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => navigate(currentIdx + 1)} disabled={currentIdx === specimens.length - 1}
            >
              <ChevronRight size={16} />
            </Button>
          </div>

          {/* Canvas */}
          <div ref={containerRef} className="relative flex-1 overflow-hidden rounded-lg border bg-[#0f172a]">
            {loadingImage && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                {t("digi.loadingImage")}
              </div>
            )}
            {!loadingImage && !imageDataUrl && current?.imagePath && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-400">
                <p>{t("digi.imageNotFound")}</p>
                <p className="font-mono text-xs">{current.imagePath}</p>
              </div>
            )}
            {!current?.imagePath && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                {t("digi.noImageForSpecimen")}
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 cursor-crosshair"
              style={{ touchAction: "none" }}
              onClick={handleCanvasClick}
            />
            {/* Mode badge */}
            {scaleMode ? (
              <div className="absolute bottom-3 left-3">
                <Badge variant="outline" className="text-xs bg-cyan-950/70 text-cyan-100 border-cyan-400/30">
                  <Ruler size={11} className="mr-1" />
                  {scalePts.length === 0 ? t("digi.clickFirstRef") : t("digi.clickSecondRef")}
                </Badge>
              </div>
            ) : !isComplete ? (
              <div className="absolute bottom-3 left-3 flex gap-2">
                <Badge variant="outline" className="text-xs bg-black/60 text-white border-white/20">
                  LM #{placed + 1} · {placedFixed < nFixed ? t("digi.clickFixed") : t("digi.clickSemi")}
                  {nSemi > 0 && placedSemi < nSemi ? ` · ${t("digi.shiftSemi")}` : ""}
                </Badge>
              </div>
            ) : (
              <div className="absolute bottom-3 left-3">
                <Badge className="bg-emerald-600 text-xs">
                  <CheckCircle2 size={11} className="mr-1" /> {t("digi.allPlaced", { n: nLandmarks })}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex w-[320px] flex-col gap-3">
          {/* Controls */}
          <Card>
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">{t("ui.controls")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full" onClick={undoLandmark} disabled={placed === 0}>
                <Undo2 size={13} /> {t("digi.undo")}
              </Button>
              <Button variant="outline" size="sm" className="w-full text-destructive" onClick={clearSpecimen} disabled={placed === 0}>
                <Trash2 size={13} /> {t("digi.clearSpecimen")}
              </Button>
              <Button
                variant={scaleMode ? "default" : "outline"}
                size="sm"
                className="w-full"
                onClick={() => setScaleMode((m) => !m)}
              >
                <Ruler size={13} /> {scaleMode ? t("action.cancel") : t("digi.setScale")}
              </Button>
              <div className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2 text-sm">
                  <Spline size={13} className="text-muted-foreground" />
                  <span>{t("digi.connectLine")}</span>
                </div>
                <Switch checked={showLine} onCheckedChange={setShowLine} />
              </div>
            </CardContent>
          </Card>

          {/* Grow the session — starting one belongs to the Data Manager */}
          <Card>
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">{t("digi.addMore")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleAddImages}>
                <Images size={13} /> {t("digi.addImages")}
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleAddFolder}>
                <FolderOpen size={13} /> {t("digi.addFolder")}
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleAddFromTPS}>
                <FolderOpen size={13} /> {t("digi.addFromTPS")}
              </Button>
              <p className="text-[11px] text-muted-foreground">{t("digi.tpsSameFolder")}</p>
            </CardContent>
          </Card>

          {/* Progress */}
          <Card>
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">{t("ui.progress")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("digi.fixedLm")}</span>
                <span className="font-medium text-emerald-500">{placedFixed}/{nFixed}</span>
              </div>
              {nSemi > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("digi.semilandmarks")}</span>
                  <span className="font-medium text-amber-500">{placedSemi}/{nSemi}</span>
                </div>
              )}
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-muted-foreground">{t("digi.allSpecimens")}</span>
                <span className="font-medium">{specimens.filter((sp) => sp.landmarks.length >= nLandmarks).length}/{specimens.length}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-muted-foreground">{t("ui.scale")}</span>
                {current?.scale ? (
                  <span className="font-medium text-cyan-500">
                    {current.scale.toPrecision(3)} {current.scaleUnit ?? "unit"}/px
                  </span>
                ) : (
                  <span className="text-muted-foreground/70">{t("digi.notSet")}</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Landmark list */}
          <Card className="flex flex-1 flex-col overflow-hidden">
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">{t("ui.landmarks")}</CardTitle></CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="space-y-0.5 px-3 pb-3 pt-1">
                  {Array.from({ length: nLandmarks }, (_, i) => {
                    const lm = current?.landmarks[i];
                    return (
                      <div key={i} className={`flex items-center gap-2 rounded px-1 py-1 text-xs ${lm ? "" : "opacity-40"}`}>
                        {lm ? (
                          <CheckCircle2 size={11} className={lm.isSemi ? "text-amber-500" : "text-emerald-500"} />
                        ) : (
                          <Circle size={11} className="text-muted-foreground" />
                        )}
                        <span className="font-mono w-5">{i + 1}</span>
                        {lm && (
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${lm.isSemi ? "border-amber-500/40 text-amber-500" : "border-emerald-500/40 text-emerald-500"}`}>
                            {lm.isSemi ? t("digi.semiShort") : t("digi.fixedShort")}
                          </Badge>
                        )}
                        {lm && <span className="ml-auto font-mono text-[10px] text-muted-foreground">{lm.x.toFixed(0)},{lm.y.toFixed(0)}</span>}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Specimen overview */}
          <Card>
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">{t("digi.allSpecimens")}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-36">
                <div className="space-y-0.5 px-3 pb-2">
                  {specimens.map((sp, i) => {
                    const done = sp.landmarks.length >= nLandmarks;
                    return (
                      <button
                        key={i}
                        onClick={() => navigate(i)}
                        className={`flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs transition-colors hover:bg-muted/50 ${i === currentIdx ? "bg-muted" : ""}`}
                      >
                        {done
                          ? <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
                          : <Circle size={11} className="text-muted-foreground shrink-0" />
                        }
                        <span className="truncate">{sp.imageBase || sp.id}</span>
                        <span className="ml-auto shrink-0 text-muted-foreground">{sp.landmarks.length}/{nLandmarks}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      <TemplateDialog
        template={pendingTemplate}
        nLandmarks={templateLandmarks}
        nSemi={templateSemi}
        onNLandmarks={setTemplateLandmarks}
        onNSemi={setTemplateSemi}
        onCancel={() => setPendingTemplate(null)}
        onStart={startPendingTemplate}
      />

      {/* Scale reference dialog */}
      <Dialog open={scaleDialog !== null} onOpenChange={(o) => { if (!o) { setScaleDialog(null); setScalePts([]); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("digi.setScale")}</DialogTitle>
            <DialogDescription>
              {t("digi.scaleDialogDesc", { n: scaleDialog ? scaleDialog.pixelDist.toFixed(1) : "?" })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="scale-length">{t("digi.refLength")}</Label>
              <Input
                id="scale-length"
                type="number"
                min={0}
                step="any"
                autoFocus
                value={scaleLength}
                onChange={(e) => setScaleLength(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmScale(); }}
                placeholder="e.g. 10"
              />
            </div>
            <div className="w-24 space-y-1">
              <Label htmlFor="scale-unit">{t("digi.unit")}</Label>
              <Input
                id="scale-unit"
                value={scaleUnit}
                onChange={(e) => setScaleUnit(e.target.value)}
                placeholder="mm"
              />
            </div>
          </div>
          {scaleDialog && parseFloat(scaleLength) > 0 && (
            <p className="text-xs text-muted-foreground">
              = {(parseFloat(scaleLength) / scaleDialog.pixelDist).toPrecision(4)} {scaleUnit.trim() || "unit"}/px
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setScaleDialog(null); setScalePts([]); }}>
              {t("action.cancel")}
            </Button>
            <Button size="sm" onClick={confirmScale}>{t("digi.setScale")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelLayout>
  );
}

/**
 * Asks how many landmarks a TpsUtil-style template should get. Kept at module
 * scope so typing in the number inputs does not remount it and lose focus.
 */
function TemplateDialog({
  template, nLandmarks, nSemi, onNLandmarks, onNSemi, onCancel, onStart,
}: {
  template: PendingTemplate | null;
  nLandmarks: number;
  nSemi: number;
  onNLandmarks: (n: number) => void;
  onNSemi: (n: number) => void;
  onCancel: () => void;
  onStart: () => void;
}) {
  const t = useT();
  return (
    <Dialog open={template !== null} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("digi.templateTitle")}</DialogTitle>
          <DialogDescription>
            {template
              ? t("digi.templateDesc", { n: template.specimens.length })
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t("imgimp.totalLandmarks")}</Label>
            <NumberInput min={1} value={nLandmarks} onChange={onNLandmarks} />
          </div>
          <div className="space-y-1">
            <Label>{t("imgimp.semilandmarks")}</Label>
            <NumberInput min={0} max={nLandmarks - 1} value={nSemi} onChange={onNSemi} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>{t("action.cancel")}</Button>
          <Button size="sm" onClick={onStart}>{t("digi.startDigitizing")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
