import { useCallback, useEffect, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useDigitizerStore } from "@/store/digitizerStore";
import { writeTPS } from "@/lib/parsers";
import { writeTextFile, listDirImages } from "@/lib/ipc";
import { basename, dirname } from "@/lib/digitizeSession";
import { Images, FolderOpen, X, ArrowRight, AlertTriangle } from "lucide-react";

/**
 * Start a digitizing session: gather the images, say how many landmarks each
 * specimen gets, and write the TPS template.
 *
 * It belongs to the Data Manager because that is where data enters the app; the
 * digitizer itself only ever adds to a session that already exists.
 */
interface ImageEntry {
  path: string;
  base: string;
}

export function NewSessionDialog({
  open: isOpen, onOpenChange, initialImages, onStarted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Images the caller already picked, used to seed the list when opening. */
  initialImages: string[];
  onStarted: () => void;
}) {
  const t = useT();
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [nLandmarks, setNLandmarks] = useState(10);
  const [nSemi, setNSemi] = useState(0);
  const [tpsPath, setTpsPath] = useState("");
  const [busy, setBusy] = useState(false);
  const seeded = useRef<string[] | null>(null);

  const setSession = useDigitizerStore((s) => s.setSession);

  // Seed once per opening, so re-renders while the dialog is up do not undo
  // images the user removed by hand.
  useEffect(() => {
    if (!isOpen) {
      seeded.current = null;
      return;
    }
    if (seeded.current === initialImages) return;
    seeded.current = initialImages;
    setImages(initialImages.map((p) => ({ path: p, base: basename(p) })));
    setTpsPath("");
  }, [isOpen, initialImages]);

  // Add paths to the list, skipping any that are already there.
  const addPaths = useCallback((paths: string[]) => {
    let added = 0;
    setImages((prev) => {
      const existing = new Set(prev.map((e) => e.path));
      const newEntries = paths
        .filter((p) => !existing.has(p))
        .map((p) => ({ path: p, base: basename(p) }));
      added = newEntries.length;
      return [...prev, ...newEntries];
    });
    return added;
  }, []);

  const pickImages = useCallback(async () => {
    const result = await open({
      multiple: true,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "tif", "tiff", "bmp"] }],
    });
    if (!result) return;
    addPaths(Array.isArray(result) ? result : [result]);
  }, [addPaths]);

  // Pick a folder and take every image inside it, in file-name order.
  const pickFolder = useCallback(async () => {
    const folder = await open({ directory: true, multiple: false });
    if (!folder || Array.isArray(folder)) return;
    try {
      const found = await listDirImages(folder);
      if (found.length === 0) {
        toast.error(t("imgimp.noneInFolder"), { description: t("imgimp.lookedFor") });
        return;
      }
      const added = addPaths(found);
      toast.success(t("imgimp.addedImages", { n: added }), {
        description: added < found.length
          ? t("imgimp.alreadyListed", { n: found.length - added })
          : basename(folder),
      });
    } catch (e) {
      toast.error(t("imgimp.folderFailed"), { description: e instanceof Error ? e.message : String(e) });
    }
  }, [addPaths, t]);

  const removeImage = useCallback((path: string) => {
    setImages((prev) => prev.filter((e) => e.path !== path));
  }, []);

  const pickSavePath = useCallback(async () => {
    const result = await save({
      defaultPath: images[0] ? `${dirname(images[0].path)}/landmarks.tps` : "landmarks.tps",
      filters: [{ name: "TPS", extensions: ["tps"] }],
    });
    if (result) setTpsPath(result);
  }, [images]);

  // A TPS names its images, it does not path to them, so the two have to live
  // in the same folder or the session cannot find a single photo.
  const imagesDir = images[0] ? dirname(images[0].path) : "";
  const scattered = images.some((img) => dirname(img.path) !== imagesDir);
  const saveElsewhere = tpsPath !== "" && dirname(tpsPath) !== imagesDir;

  const handleCreate = useCallback(async () => {
    if (images.length === 0) {
      toast.error(t("imgimp.needImage"));
      return;
    }
    if (nSemi >= nLandmarks) {
      toast.error(t("imgimp.tooManySemi"));
      return;
    }

    let savePath = tpsPath;
    if (!savePath) {
      const result = await save({
        defaultPath: images[0] ? `${dirname(images[0].path)}/landmarks.tps` : "landmarks.tps",
        filters: [{ name: "TPS", extensions: ["tps"] }],
      });
      if (!result) return;
      savePath = result;
      setTpsPath(savePath);
    }

    setBusy(true);
    try {
      const tpsDir = dirname(savePath);
      // Written as a TpsUtil-style template: images listed, no coordinates yet.
      const content = writeTPS(
        images.map((img, i) => ({
          id: String(i + 1),
          image: img.base, // just the name — the images sit next to the TPS
          landmarks: [] as number[][],
        }))
      );
      await writeTextFile(savePath, content);

      setSession(
        images.map((img, i) => ({
          id: String(i + 1),
          imagePath: img.path,
          imageBase: img.base,
          landmarks: [],
        })),
        nLandmarks, nSemi, tpsDir, savePath
      );
      toast.success(t("imgimp.templateCreated"), {
        description: `${images.length} ${t("status.specimens")} · ${nLandmarks} ${t("ui.landmarks")}`,
      });
      onOpenChange(false);
      onStarted();
    } catch (e) {
      toast.error(t("imgimp.createFailed"), { description: String(e) });
    } finally {
      setBusy(false);
    }
  }, [images, nLandmarks, nSemi, tpsPath, setSession, onOpenChange, onStarted, t]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("digi.newSession")}</DialogTitle>
          <DialogDescription>{t("digi.newSessionDesc")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={pickImages}>
            <Images size={14} /> {t("action.pickFiles")}
          </Button>
          <Button variant="outline" size="sm" onClick={pickFolder}>
            <FolderOpen size={14} /> {t("action.pickFolder2")}
          </Button>
          {images.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {images.length} {t("imgimp.selected")}
              </span>
              <Button
                variant="ghost" size="sm"
                className="ml-auto text-xs text-muted-foreground"
                onClick={() => setImages([])}
              >
                {t("action.clear")}
              </Button>
            </>
          )}
        </div>

        {images.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 text-muted-foreground">
            <Images size={32} />
            <p className="text-sm">{t("imgimp.noImages")}</p>
          </div>
        ) : (
          <ScrollArea className="h-44 rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-card text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">{t("ui.filename")}</th>
                  <th className="px-3 py-2 text-left">{t("ui.fullPath")}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {images.map((img, i) => (
                  <tr key={img.path} className="border-b hover:bg-muted/30">
                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium">{img.base}</td>
                    <td className="max-w-xs truncate px-3 py-1.5 font-mono text-xs text-muted-foreground">
                      {img.path}
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => removeImage(img.path)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>{t("imgimp.totalLandmarks")}</Label>
            <NumberInput min={1} value={nLandmarks} onChange={setNLandmarks} />
            <p className="text-xs text-muted-foreground">{t("imgimp.combinedHint")}</p>
          </div>
          <div className="space-y-1">
            <Label>{t("imgimp.semilandmarks")}</Label>
            <NumberInput min={0} max={nLandmarks - 1} value={nSemi} onChange={setNSemi} />
            <p className="text-xs text-muted-foreground">
              {nSemi > 0
                ? `LM 1–${nLandmarks - nSemi} ${t("imgimp.fixedWord")} · LM ${nLandmarks - nSemi + 1}–${nLandmarks} ${t("imgimp.slidingWord")}`
                : t("imgimp.allFixed")}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("imgimp.outputTps")}</Label>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={pickSavePath}>
            <FolderOpen size={13} />
            {tpsPath ? t("imgimp.changeLocation") : t("imgimp.pickLocation")}
          </Button>
          {tpsPath && <p className="break-all text-xs text-muted-foreground">{tpsPath}</p>}
          <p className="text-xs text-muted-foreground">{t("imgimp.sameFolderRule")}</p>
          {(saveElsewhere || scattered) && (
            <p className="flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle size={13} className="mt-px shrink-0" />
              <span>{saveElsewhere ? t("imgimp.saveElsewhere") : t("imgimp.imagesScattered")}</span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("action.cancel")}
          </Button>
          <Button size="sm" disabled={images.length === 0 || busy} onClick={handleCreate}>
            <ArrowRight size={14} />
            {busy ? t("imgimp.creating") : t("imgimp.createAndDigitize")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
