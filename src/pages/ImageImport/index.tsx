import { useState, useCallback } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDigitizerStore } from "@/store/digitizerStore";
import { useNavStore } from "@/store/navStore";
import { writeTPS } from "@/lib/parsers";
import { writeTextFile } from "@/lib/ipc";
import { Images, FolderOpen, X, ArrowRight } from "lucide-react";

interface ImageEntry {
  path: string;
  base: string;
}

function basename(p: string) {
  return p.replace(/\\/g, "/").split("/").pop() ?? p;
}

function dirname(p: string) {
  const norm = p.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx === -1 ? "." : norm.slice(0, idx);
}

export default function ImageImport() {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [nLandmarks, setNLandmarks] = useState(10);
  const [nSemi, setNSemi] = useState(0);
  const [tpsPath, setTpsPath] = useState("");
  const [busy, setBusy] = useState(false);

  const setSession = useDigitizerStore((s) => s.setSession);
  const navigate = useNavStore((s) => s.navigate);

  const pickImages = useCallback(async () => {
    const result = await open({
      multiple: true,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "tif", "tiff", "bmp"] }],
    });
    if (!result) return;
    const paths = Array.isArray(result) ? result : [result];
    setImages((prev) => {
      const existing = new Set(prev.map((e) => e.path));
      const newEntries = paths
        .filter((p) => !existing.has(p))
        .map((p) => ({ path: p, base: basename(p) }));
      return [...prev, ...newEntries];
    });
  }, []);

  const removeImage = useCallback((path: string) => {
    setImages((prev) => prev.filter((e) => e.path !== path));
  }, []);

  const pickSavePath = useCallback(async () => {
    const result = await save({
      defaultPath: "landmarks.tps",
      filters: [{ name: "TPS", extensions: ["tps"] }],
    });
    if (result) setTpsPath(result);
  }, []);

  const handleCreate = useCallback(async () => {
    if (images.length === 0) {
      toast.error("Add at least one image first.");
      return;
    }
    if (nLandmarks < 1) {
      toast.error("Number of landmarks must be ≥ 1.");
      return;
    }
    if (nSemi >= nLandmarks) {
      toast.error("Semilandmarks must be fewer than total landmarks.");
      return;
    }

    let savePath = tpsPath;
    if (!savePath) {
      const result = await save({
        defaultPath: "landmarks.tps",
        filters: [{ name: "TPS", extensions: ["tps"] }],
      });
      if (!result) return;
      savePath = result;
      setTpsPath(savePath);
    }

    setBusy(true);
    try {
      // Compute relative image paths (relative to TPS file location)
      const tpsDir = dirname(savePath);
      const specimens = images.map((img, i) => ({
        id: String(i + 1),
        image: img.base, // store just the basename — user is expected to keep images in same folder
        landmarks: Array.from({ length: nLandmarks }, () => [0, 0] as number[]),
      }));

      const content = writeTPS(specimens);
      await writeTextFile(savePath, content);

      // Set up digitizer session
      const digiSpecimens = images.map((img, i) => ({
        id: String(i + 1),
        imagePath: img.path,
        imageBase: img.base,
        landmarks: [],
      }));

      setSession(digiSpecimens, nLandmarks, nSemi, tpsDir, savePath);
      toast.success(`TPS template created`, {
        description: `${images.length} specimens · ${nLandmarks} landmarks`,
      });
      navigate("digitizer");
    } catch (e) {
      toast.error("Failed to create TPS", { description: String(e) });
    } finally {
      setBusy(false);
    }
  }, [images, nLandmarks, nSemi, tpsPath, setSession, navigate]);

  return (
    <PanelLayout
      title="Image Import"
      description="Create a TPS template from PNG/JPG images, then place landmarks in the Digitizer"
    >
      <div className="flex h-full gap-4">
        {/* Left: image list */}
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={pickImages}>
              <FolderOpen size={14} /> Pick Images…
            </Button>
            {images.length > 0 && (
              <span className="text-sm text-muted-foreground">{images.length} image{images.length !== 1 ? "s" : ""} selected</span>
            )}
          </div>

          {images.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 text-muted-foreground">
              <Images size={36} />
              <p className="text-sm">No images yet — click "Pick Images" to add PNG / JPG files</p>
            </div>
          ) : (
            <Card className="flex flex-1 flex-col overflow-hidden">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm">Specimen list (order = digitizing order)</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 border-b bg-card text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Filename</th>
                        <th className="px-3 py-2 text-left">Full path</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {images.map((img, i) => (
                        <tr key={img.path} className="border-b hover:bg-muted/30">
                          <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium">{img.base}</td>
                          <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground truncate max-w-xs">{img.path}</td>
                          <td className="px-3 py-1.5">
                            <button onClick={() => removeImage(img.path)} className="text-muted-foreground hover:text-destructive">
                              <X size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: settings */}
        <div className="flex w-72 flex-col gap-3">
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm">Landmark Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Total landmarks per specimen</Label>
                <Input
                  type="number"
                  min={1}
                  value={nLandmarks}
                  onChange={(e) => setNLandmarks(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <p className="text-xs text-muted-foreground">Fixed + semilandmarks combined</p>
              </div>
              <div className="space-y-1">
                <Label>Semilandmarks (last N points)</Label>
                <Input
                  type="number"
                  min={0}
                  max={nLandmarks - 1}
                  value={nSemi}
                  onChange={(e) => setNSemi(Math.max(0, parseInt(e.target.value) || 0))}
                />
                <p className="text-xs text-muted-foreground">
                  {nSemi > 0
                    ? `LM 1–${nLandmarks - nSemi} fixed · LM ${nLandmarks - nSemi + 1}–${nLandmarks} sliding`
                    : "All landmarks are fixed"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm">Output TPS File</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full" onClick={pickSavePath}>
                <FolderOpen size={13} /> {tpsPath ? "Change save location…" : "Pick save location…"}
              </Button>
              {tpsPath && (
                <p className="break-all text-xs text-muted-foreground">{tpsPath}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Keep images in the same folder as the TPS file for relative paths to work.
              </p>
            </CardContent>
          </Card>

          <Button
            className="mt-auto"
            disabled={images.length === 0 || busy}
            onClick={handleCreate}
          >
            <ArrowRight size={14} />
            {busy ? "Creating…" : "Create Template & Digitize"}
          </Button>
        </div>
      </div>
    </PanelLayout>
  );
}
