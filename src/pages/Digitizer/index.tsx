import { useCallback, useEffect, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDigitizerStore, type LandmarkPoint } from "@/store/digitizerStore";
import { useNavStore } from "@/store/navStore";
import { useDatasetStore } from "@/store/datasetStore";
import { useAnalysisStore } from "@/store/analysisStore";
import { parseTPS, writeTPS } from "@/lib/parsers";
import { readFileB64, writeTextFile } from "@/lib/ipc";
import {
  ChevronLeft, ChevronRight, Undo2, Trash2, Download, FolderOpen,
  CheckCircle2, Circle, MousePointerClick, Import,
} from "lucide-react";

// ── Canvas drawing ────────────────────────────────────────────────────────────

interface Transform { scale: number; ox: number; oy: number }

function drawCanvas(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  landmarks: LandmarkPoint[],
  nLandmarks: number,
  nSemi: number,
  xform: React.MutableRefObject<Transform>
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

  ctx.drawImage(img, ox, oy, iw, ih);

  const firstSemiIdx = nLandmarks - nSemi;

  // Connect semilandmarks
  const semiPts = landmarks.filter((_, i) => i >= firstSemiIdx);
  if (semiPts.length >= 2) {
    ctx.beginPath();
    semiPts.forEach((lm, j) => {
      const cx = lm.x * scale + ox;
      const cy = lm.y * scale + oy;
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
    const cx = lm.x * scale + ox;
    const cy = lm.y * scale + oy;
    const isSemi = lm.isSemi || i >= firstSemiIdx;

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

function basename(p: string) {
  return p.replace(/\\/g, "/").split("/").pop() ?? p;
}

function dirname(p: string) {
  const norm = p.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx === -1 ? "" : norm.slice(0, idx);
}

function extMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "tif" || ext === "tiff") return "image/tiff";
  if (ext === "bmp") return "image/bmp";
  return "image/png";
}

export default function Digitizer() {
  const {
    specimens, currentIdx, nLandmarks, nSemi, sourceFile,
    addLandmark, undoLandmark, clearSpecimen, navigate, setSession,
  } = useDigitizerStore();

  const navNavigate = useNavStore((s) => s.navigate);
  const setDataset = useDatasetStore((s) => s.setDataset);
  const clearAnalyses = useAnalysisStore((s) => s.clearAll);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const xformRef = useRef<Transform>({ scale: 1, ox: 0, oy: 0 });
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  const current = specimens[currentIdx];
  const isComplete = current ? current.landmarks.length >= nLandmarks : false;
  const allComplete = specimens.length > 0 && specimens.every((sp) => sp.landmarks.length >= nLandmarks);
  const firstSemiIdx = nLandmarks - nSemi;

  // Resize canvas to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      if (imgRef.current) drawCanvas(canvas, imgRef.current, current?.landmarks ?? [], nLandmarks, nSemi, xformRef);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [current?.landmarks, nLandmarks, nSemi]);

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
        toast.error("Cannot load image", { description: String(e) });
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
      if (canvas) drawCanvas(canvas, img, current?.landmarks ?? [], nLandmarks, nSemi, xformRef);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  // Redraw on landmark change (image already loaded)
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    drawCanvas(canvas, img, current?.landmarks ?? [], nLandmarks, nSemi, xformRef);
  }, [current?.landmarks, nLandmarks, nSemi]);

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
    if (!current || isComplete) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const { scale, ox, oy } = xformRef.current;
    const imgX = (px - ox) / scale;
    const imgY = (py - oy) / scale;
    const img = imgRef.current;
    if (!img || imgX < 0 || imgX > img.naturalWidth || imgY < 0 || imgY > img.naturalHeight) return;
    const nextIdx = current.landmarks.length;
    const isSemi = e.shiftKey || nextIdx >= firstSemiIdx;
    addLandmark(imgX, imgY, isSemi);
  }, [current, isComplete, firstSemiIdx, addLandmark]);

  // ── Open TPS for digitizing ─────────────────────────────────────────────────
  const handleOpenTPS = useCallback(async () => {
    const result = await open({
      filters: [{ name: "TPS files", extensions: ["tps"] }],
    });
    if (!result || Array.isArray(result)) return;
    const filePath = result as string;
    try {
      const b64 = await readFileB64(filePath);
      const content = atob(b64);
      const parsed = parseTPS(content);
      const dir = dirname(filePath);
      const digiSpecimens = parsed.specimens.map((sp, i) => {
        const imgBase = sp.image ?? null;
        const imgPath = imgBase ? (dir ? `${dir}/${imgBase}` : imgBase) : "";
        return {
          id: sp.id ?? String(i + 1),
          imagePath: imgPath,
          imageBase: imgBase ?? "",
          landmarks: sp.landmarks.map((pt, j) => ({
            x: pt[0],
            y: pt[1],
            isSemi: j >= (parsed.n_landmarks - 0), // preserve existing, no semi info in plain TPS
          })),
        };
      });
      const hasImages = digiSpecimens.some((sp) => sp.imagePath);
      if (!hasImages) {
        toast.warning("TPS file has no IMAGE= references", {
          description: "Landmark coordinates were loaded but images cannot be displayed without IMAGE= fields.",
        });
      }
      setSession(digiSpecimens, parsed.n_landmarks, 0, dir, filePath);
      toast.success(`Loaded ${basename(filePath)}`, {
        description: `${parsed.specimens.length} specimens · ${parsed.n_landmarks} landmarks`,
      });
    } catch (e) {
      toast.error("Failed to load TPS", { description: String(e) });
    }
  }, [setSession]);

  // ── Export TPS ──────────────────────────────────────────────────────────────
  const handleExportTPS = useCallback(async () => {
    const savePath = await save({
      defaultPath: sourceFile ? basename(sourceFile).replace(/\.tps$/i, "_digitized.tps") : "landmarks_digitized.tps",
      filters: [{ name: "TPS", extensions: ["tps"] }],
    });
    if (!savePath) return;
    try {
      const semiIndices = Array.from({ length: nSemi }, (_, i) => firstSemiIdx + i);
      const tpsSpecimens = specimens.map((sp) => ({
        id: sp.id,
        image: sp.imageBase || undefined,
        landmarks: sp.landmarks.map((lm) => [lm.x, lm.y]),
        semiLandmarkIndices: nSemi > 0 ? semiIndices : undefined,
      }));
      const content = writeTPS(tpsSpecimens);
      await writeTextFile(savePath, content);
      toast.success("TPS exported", { description: savePath });
    } catch (e) {
      toast.error("Export failed", { description: String(e) });
    }
  }, [specimens, nSemi, firstSemiIdx, sourceFile]);

  // ── Load into DataManager ───────────────────────────────────────────────────
  const handleLoadAsDataset = useCallback(() => {
    if (!allComplete) {
      toast.error("Not all specimens are fully digitized.");
      return;
    }
    clearAnalyses();
    setDataset({
      specimens: specimens.map((sp) => ({
        id: sp.id,
        landmarks: sp.landmarks.map((lm) => [lm.x, lm.y]),
        include: true,
      })),
      n_landmarks: nLandmarks,
      dimensions: 2,
      filename: sourceFile ? basename(sourceFile) : "digitized.tps",
    });
    toast.success("Dataset loaded from digitizer");
    navNavigate("data");
  }, [allComplete, specimens, nLandmarks, sourceFile, setDataset, clearAnalyses, navNavigate]);

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (specimens.length === 0) {
    return (
      <PanelLayout
        title="Landmark Digitizer"
        description="Place landmarks on images and export as TPS"
      >
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <MousePointerClick size={48} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No digitizing session active</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navNavigate("image-import")}>
              <Import size={14} /> Start from Images
            </Button>
            <Button variant="outline" onClick={handleOpenTPS}>
              <FolderOpen size={14} /> Open TPS File…
            </Button>
          </div>
        </div>
      </PanelLayout>
    );
  }

  // ── Main digitizer UI ───────────────────────────────────────────────────────
  const placed = current?.landmarks.length ?? 0;
  const total = nLandmarks;
  const pct = total > 0 ? Math.round((placed / total) * 100) : 0;

  return (
    <PanelLayout
      title="Landmark Digitizer"
      description={`${specimens.length} specimens · ${nLandmarks} landmarks${nSemi > 0 ? ` (${nSemi} semi)` : ""}`}
      actions={
        <>
          <Button variant="outline" size="sm" onClick={handleOpenTPS}>
            <FolderOpen size={14} /> Open TPS…
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportTPS} disabled={specimens.every((sp) => sp.landmarks.length === 0)}>
            <Download size={14} /> Export TPS
          </Button>
          {allComplete && (
            <Button size="sm" onClick={handleLoadAsDataset}>
              <Import size={14} /> Load as Dataset
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
                Loading image…
              </div>
            )}
            {!loadingImage && !imageDataUrl && current?.imagePath && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-400">
                <p>Image not found:</p>
                <p className="font-mono text-xs">{current.imagePath}</p>
              </div>
            )}
            {!current?.imagePath && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                No image for this specimen
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 cursor-crosshair"
              style={{ touchAction: "none" }}
              onClick={handleCanvasClick}
            />
            {/* Mode badge */}
            {!isComplete && (
              <div className="absolute bottom-3 left-3 flex gap-2">
                <Badge variant={placed < firstSemiIdx ? "default" : "secondary"} className="text-xs">
                  {placed < firstSemiIdx ? "Fixed LM" : "Semi-LM"} #{placed + 1}
                </Badge>
                <Badge variant="outline" className="text-xs bg-black/60 text-white border-white/20">
                  Shift+click = semilandmark
                </Badge>
              </div>
            )}
            {isComplete && (
              <div className="absolute bottom-3 left-3">
                <Badge className="bg-emerald-600 text-xs">
                  <CheckCircle2 size={11} className="mr-1" /> All {nLandmarks} landmarks placed
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex w-56 flex-col gap-3">
          {/* Controls */}
          <Card>
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Controls</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full" onClick={undoLandmark} disabled={placed === 0}>
                <Undo2 size={13} /> Undo (Ctrl+Z)
              </Button>
              <Button variant="outline" size="sm" className="w-full text-destructive" onClick={clearSpecimen} disabled={placed === 0}>
                <Trash2 size={13} /> Clear Specimen
              </Button>
            </CardContent>
          </Card>

          {/* Progress */}
          <Card>
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Progress</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">This specimen</span>
                <span className="font-medium">{placed}/{total}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-muted-foreground">All specimens</span>
                <span className="font-medium">{specimens.filter((sp) => sp.landmarks.length >= nLandmarks).length}/{specimens.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Landmark list */}
          <Card className="flex flex-1 flex-col overflow-hidden">
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Landmarks</CardTitle></CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="space-y-0.5 px-3 pb-3">
                  {Array.from({ length: nLandmarks }, (_, i) => {
                    const lm = current?.landmarks[i];
                    const isSemi = i >= firstSemiIdx;
                    return (
                      <div key={i} className={`flex items-center gap-2 rounded px-1 py-1 text-xs ${lm ? "" : "opacity-40"}`}>
                        {lm ? (
                          <CheckCircle2 size={11} className={isSemi ? "text-amber-500" : "text-emerald-500"} />
                        ) : (
                          <Circle size={11} className="text-muted-foreground" />
                        )}
                        <span className="font-mono w-5">{i + 1}</span>
                        {isSemi && <Badge variant="outline" className="text-[9px] px-1 py-0">semi</Badge>}
                        {lm && (
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                            {lm.x.toFixed(0)},{lm.y.toFixed(0)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Specimen overview */}
          <Card>
            <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">All Specimens</CardTitle></CardHeader>
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
    </PanelLayout>
  );
}
